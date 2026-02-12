const { Worker } = require('bullmq');
const { getRedisConnection } = require('../config/redis');
const Campaign = require('../models/Campaign');
const Message = require('../models/Message');
const axios = require('axios');

/**
 * Process a single message-send job.
 * Each job sends one WhatsApp template message to one contact.
 */
async function processSendMessage(job) {
    const {
        campaignId,
        contactId,
        phoneNumber,
        sendUrl,
        accessToken,
        templateName,
        templateLanguage,
        templateComponents
    } = job.data;

    // 1. Check if campaign is still active (pause/cancel check)
    const campaign = await Campaign.findById(campaignId).select('status');
    if (!campaign) {
        console.log(`Campaign ${campaignId} not found, discarding job`);
        return;
    }

    if (campaign.status === 'cancelled') {
        // Campaign cancelled — discard this job, mark as processed
        await Campaign.updateOne(
            { _id: campaignId },
            { $inc: { 'stats.processed': 1 }, updatedAt: Date.now() }
        );
        await checkCompletion(campaignId);
        return;
    }

    if (campaign.status === 'paused') {
        // Campaign paused — throw to retry later (BullMQ will re-queue with backoff)
        throw new Error('CAMPAIGN_PAUSED');
    }

    // 2. Build Meta API payload
    const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: phoneNumber,
        type: 'template',
        template: {
            name: templateName,
            language: { code: templateLanguage },
            components: templateComponents || []
        }
    };

    // 3. Send via Meta Graph API
    try {
        const response = await axios.post(sendUrl, payload, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            timeout: 15000
        });

        // 4. Extract wamid from Meta's response
        const wamid = response.data?.messages?.[0]?.id || null;

        // 5. Save Message document
        await new Message({
            contact: contactId,
            campaignId: campaignId,
            wamid: wamid,
            content: `Template: ${templateName}`,
            type: 'template',
            direction: 'outbound',
            status: 'sent',
            timestamp: new Date()
        }).save();

        // 6. Atomically increment sent + processed
        await Campaign.updateOne(
            { _id: campaignId },
            { $inc: { 'stats.sent': 1, 'stats.processed': 1 }, updatedAt: Date.now() }
        );

        // 7. Check if campaign is complete
        await checkCompletion(campaignId);

    } catch (err) {
        if (err.response) {
            const status = err.response.status;

            if (status === 429) {
                // Rate limited by Meta — throw to trigger BullMQ retry with backoff
                throw new Error('META_RATE_LIMIT');
            }

            if (status >= 400 && status < 500) {
                // Permanent failure (invalid number, blocked, etc.) — don't retry
                const metaError = err.response.data?.error;
                console.error(`Campaign ${campaignId}: Permanent failure for contact ${contactId}:`,
                    metaError?.message || err.message);

                // Save failed message record
                await new Message({
                    contact: contactId,
                    campaignId: campaignId,
                    content: `Template: ${templateName}`,
                    type: 'template',
                    direction: 'outbound',
                    status: 'failed',
                    errorCode: metaError?.code,
                    errorMessage: metaError?.message || err.message,
                    timestamp: new Date()
                }).save();

                // Increment failed + processed
                await Campaign.updateOne(
                    { _id: campaignId },
                    { $inc: { 'stats.failed': 1, 'stats.processed': 1 }, updatedAt: Date.now() }
                );

                await checkCompletion(campaignId);
                return; // Don't throw — job completes normally (no retry)
            }
        }

        // Network error or 5xx — throw to trigger BullMQ retry
        console.error(`Campaign ${campaignId}: Retryable failure for contact ${contactId}:`, err.message);
        throw err;
    }
}

/**
 * Check if all messages for a campaign have been processed.
 * If so, mark campaign as completed or failed.
 */
async function checkCompletion(campaignId) {
    const campaign = await Campaign.findById(campaignId)
        .select('stats.processed stats.totalToSend stats.sent status');

    if (!campaign) return;

    // Only auto-complete if still running (not paused/cancelled)
    if (!['running', 'queued'].includes(campaign.status)) return;

    if (campaign.stats.processed >= campaign.stats.totalToSend) {
        campaign.status = campaign.stats.sent > 0 ? 'completed' : 'failed';
        campaign.completedAt = new Date();
        if (campaign.stats.sent === 0) {
            campaign.errorMessage = 'All messages failed to send';
        }
        campaign.updatedAt = Date.now();
        await campaign.save();
        console.log(`Campaign ${campaignId} completed: ${campaign.stats.sent} sent, ${campaign.stats.processed - campaign.stats.sent} failed`);
    }
}

/**
 * Start the message worker with rate limiting and concurrency.
 */
function createMessageWorker() {
    const concurrency = parseInt(process.env.CAMPAIGN_CONCURRENCY || '10');
    const rateLimit = parseInt(process.env.META_RATE_LIMIT_PER_SECOND || '50');

    const worker = new Worker('campaign-messages', async (job) => {
        await processSendMessage(job);
    }, {
        connection: getRedisConnection(),
        concurrency: concurrency,
        limiter: {
            max: rateLimit,
            duration: 1000
        }
    });

    // Handle jobs that exhausted all retries
    worker.on('failed', async (job, err) => {
        if (!job) return;

        // Only handle final failures (all retries exhausted)
        if (job.attemptsMade >= (job.opts?.attempts || 3)) {
            const { campaignId, contactId, templateName } = job.data;

            // Don't count CAMPAIGN_PAUSED as a real failure
            if (err.message === 'CAMPAIGN_PAUSED') return;

            console.error(`Campaign ${campaignId}: Final failure for contact ${contactId}:`, err.message);

            try {
                // Save failed message
                await new Message({
                    contact: contactId,
                    campaignId: campaignId,
                    content: `Template: ${templateName}`,
                    type: 'template',
                    direction: 'outbound',
                    status: 'failed',
                    errorMessage: err.message,
                    timestamp: new Date()
                }).save();

                // Increment failed + processed
                await Campaign.updateOne(
                    { _id: campaignId },
                    { $inc: { 'stats.failed': 1, 'stats.processed': 1 }, updatedAt: Date.now() }
                );

                await checkCompletion(campaignId);
            } catch (saveErr) {
                console.error(`Failed to record final failure for campaign ${campaignId}:`, saveErr.message);
            }
        }
    });

    worker.on('error', (err) => {
        console.error('Message worker error:', err.message);
    });

    return worker;
}

module.exports = { createMessageWorker };
