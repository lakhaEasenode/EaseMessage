const { Worker } = require('bullmq');
const { getRedisConnection } = require('../config/redis');
const { getMessageQueue, getOrchestratorQueue } = require('../queues/campaignQueue');
const Campaign = require('../models/Campaign');
const Contact = require('../models/Contact');
const WhatsAppPhoneNumber = require('../models/WhatsAppPhoneNumber');
const WhatsAppBusinessAccount = require('../models/WhatsAppBusinessAccount');
const Template = require('../models/Template');

const { resolveContactField } = require('../utils/contactFields');

/**
 * Build template components array from variable mapping and contact data.
 * Resolves {{1}}, {{2}} etc. to actual contact field values.
 * Supports both body and header variables.
 */
function buildTemplateComponents(contact, variableMapping) {
    if (!variableMapping || variableMapping.length === 0) return [];

    // Group mappings by component type
    const grouped = {};
    for (const mapping of variableMapping) {
        const type = mapping.componentType || 'body';
        if (!grouped[type]) grouped[type] = [];
        grouped[type].push(mapping);
    }

    const components = [];

    for (const [componentType, mappings] of Object.entries(grouped)) {
        const params = mappings
            .sort((a, b) => a.parameterIndex - b.parameterIndex)
            .map(mapping => {
                let value;
                if (mapping.source === 'static') {
                    value = mapping.staticValue || '';
                } else {
                    value = resolveContactField(contact, mapping.fieldName);
                }
                return { type: 'text', text: value || 'Customer' };
            });

        components.push({ type: componentType, parameters: params });
    }

    return components;
}

/**
 * Process a start-campaign job:
 * Validates resources, fetches contacts, filters opt-in, fans out message jobs.
 */
async function processStartCampaign(job) {
    const { campaignId, userId } = job.data;

    const campaign = await Campaign.findOne({ _id: campaignId, user: userId });
    if (!campaign) throw new Error(`Campaign ${campaignId} not found`);

    // Only process if status is queued (set by startCampaign API)
    if (campaign.status !== 'queued') {
        console.log(`Campaign ${campaignId} status is ${campaign.status}, skipping`);
        return;
    }

    try {
        // 1. Validate phone number
        const phoneRecord = await WhatsAppPhoneNumber.findById(campaign.phoneNumberId);
        if (!phoneRecord) {
            campaign.status = 'failed';
            campaign.errorMessage = 'Phone number not found';
            campaign.completedAt = new Date();
            await campaign.save();
            return;
        }

        // 2. Validate WABA and access token
        const waba = await WhatsAppBusinessAccount.findById(phoneRecord.wabaId);
        if (!waba || !waba.accessToken) {
            campaign.status = 'failed';
            campaign.errorMessage = 'WhatsApp Business Account not found or missing access token';
            campaign.completedAt = new Date();
            await campaign.save();
            return;
        }

        // 3. Validate template
        const template = await Template.findById(campaign.templateId);
        if (!template) {
            campaign.status = 'failed';
            campaign.errorMessage = 'Template not found';
            campaign.completedAt = new Date();
            await campaign.save();
            return;
        }

        if (template.status !== 'APPROVED') {
            campaign.status = 'failed';
            campaign.errorMessage = 'Template is no longer approved';
            campaign.completedAt = new Date();
            await campaign.save();
            return;
        }

        // 4. Set campaign to running
        campaign.status = 'running';
        campaign.startedAt = new Date();
        campaign.updatedAt = Date.now();

        // 5. Fetch all active contacts in the target list
        const allContacts = await Contact.findActive({
            lists: campaign.listId,
            userId: userId
        });

        // 6. Filter to only opted-in contacts
        const eligibleContacts = allContacts.filter(c => c.optedIn === true);
        const skippedCount = allContacts.length - eligibleContacts.length;

        // 7. Update campaign stats
        campaign.stats.totalContacts = allContacts.length;
        campaign.stats.skippedOptOut = skippedCount;
        campaign.stats.totalToSend = eligibleContacts.length;
        await campaign.save();

        // 8. If no eligible contacts, mark as completed
        if (eligibleContacts.length === 0) {
            campaign.status = 'completed';
            campaign.completedAt = new Date();
            campaign.errorMessage = skippedCount > 0
                ? 'No opted-in contacts to send to'
                : 'No contacts in the selected list';
            await campaign.save();
            return;
        }

        // 9. Pre-resolve data for message workers (zero DB reads per message)
        const sendUrl = `https://graph.facebook.com/v24.0/${phoneRecord.phoneNumberId}/messages`;
        const accessToken = waba.accessToken;
        const templateName = template.name;
        const templateLanguage = template.language || 'en_US';

        // 10. Enqueue individual message jobs
        const messageQueue = getMessageQueue();
        const jobs = eligibleContacts.map((contact, index) => {
            const phoneNumber = contact.countryCode + contact.phoneNumber;
            const templateComponents = buildTemplateComponents(contact, campaign.templateVariableMapping);

            const jobData = {
                campaignId: campaign._id.toString(),
                contactId: contact._id.toString(),
                phoneNumber,
                sendUrl,
                accessToken,
                templateName,
                templateLanguage,
                templateComponents
            };

            const jobOptions = {};
            // Apply sending interval as incremental delay
            if (campaign.sendingInterval > 0) {
                jobOptions.delay = index * campaign.sendingInterval * 1000;
            }

            return {
                name: `send-msg-${campaignId}-${contact._id}`,
                data: jobData,
                opts: jobOptions
            };
        });

        // Bulk add jobs (more efficient than individual adds)
        await messageQueue.addBulk(jobs);

        console.log(`Campaign ${campaign.name}: enqueued ${eligibleContacts.length} message jobs (skipped ${skippedCount} non-opted-in)`);

    } catch (err) {
        console.error(`Orchestrator error for campaign ${campaignId}:`, err.message);
        campaign.status = 'failed';
        campaign.errorMessage = err.message;
        campaign.completedAt = new Date();
        await campaign.save();
    }
}

/**
 * Process a check-scheduled job:
 * Finds due scheduled campaigns and queues them for execution.
 */
async function processCheckScheduled() {
    const dueCampaigns = await Campaign.find({
        status: 'scheduled',
        scheduledAt: { $lte: new Date() }
    });

    if (dueCampaigns.length === 0) return;

    const orchestratorQueue = getOrchestratorQueue();

    for (const campaign of dueCampaigns) {
        // Atomic update to prevent double-processing
        const updated = await Campaign.findOneAndUpdate(
            { _id: campaign._id, status: 'scheduled' },
            { status: 'queued', updatedAt: Date.now() },
            { new: true }
        );

        if (updated) {
            console.log(`Scheduling campaign: ${campaign.name} (${campaign._id})`);
            await orchestratorQueue.add('start-campaign', {
                campaignId: campaign._id.toString(),
                userId: campaign.user.toString()
            });
        }
    }
}

/**
 * Start the orchestrator worker.
 */
function createOrchestratorWorker() {
    const worker = new Worker('campaign-orchestrator', async (job) => {
        if (job.name === 'start-campaign') {
            await processStartCampaign(job);
        } else if (job.name === 'check-scheduled') {
            await processCheckScheduled();
        }
    }, {
        connection: getRedisConnection(),
        concurrency: 1 // Process one campaign at a time
    });

    worker.on('failed', (job, err) => {
        console.error(`Orchestrator job ${job?.name} failed:`, err.message);
    });

    worker.on('error', (err) => {
        console.error('Orchestrator worker error:', err.message);
    });

    return worker;
}

module.exports = { createOrchestratorWorker, buildTemplateComponents };
