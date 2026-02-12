const Campaign = require('../models/Campaign');
const WhatsAppPhoneNumber = require('../models/WhatsAppPhoneNumber');
const Template = require('../models/Template');
const List = require('../models/List');
const Message = require('../models/Message');
const { getOrchestratorQueue } = require('../queues/campaignQueue');

class CampaignService {
    /**
     * Create a new campaign with validation
     */
    async createCampaign(userId, campaignData) {
        const { name, phoneNumberId, templateId, listId, scheduledAt, sendingInterval, templateVariableMapping } = campaignData;

        // 1. Validate Phone Number
        const phone = await WhatsAppPhoneNumber.findOne({ _id: phoneNumberId, userId: userId });
        if (!phone) {
            throw new Error('Invalid or inaccessible phone number selected.');
        }

        // 2. Validate Template (Must be verified)
        const template = await Template.findById(templateId);
        if (!template) {
            throw new Error('Template not found.');
        }
        if (template.status !== 'APPROVED') {
            throw new Error('Only APPROVED templates can be used for campaigns.');
        }

        // 3. Validate Audience List
        const list = await List.findOne({ _id: listId, userId: userId });
        if (!list) {
            throw new Error('Invalid audience list selected.');
        }

        // 4. Create Campaign
        const newCampaign = new Campaign({
            user: userId,
            name,
            phoneNumberId,
            templateId,
            listId,
            status: scheduledAt ? 'scheduled' : 'draft',
            scheduledAt: scheduledAt || null,
            sendingInterval: sendingInterval || 0,
            templateVariableMapping: templateVariableMapping || []
        });

        return await newCampaign.save();
    }

    /**
     * Get verified templates for a specific phone number/WABA
     */
    async getVerifiedTemplatesForPhone(userId, phoneNumberId) {
        const phone = await WhatsAppPhoneNumber.findOne({ _id: phoneNumberId, userId: userId });
        if (!phone) {
            throw new Error('Phone number not found');
        }

        return await Template.find({
            userId: userId,
            wabaId: phone.wabaId,
            status: 'APPROVED'
        });
    }

    /**
     * Get a single campaign by ID
     */
    async getCampaign(userId, campaignId) {
        const campaign = await Campaign.findOne({ _id: campaignId, user: userId })
            .populate('phoneNumberId', 'displayPhoneNumber verifiedName')
            .populate('templateId', 'name components language category body variables')
            .populate('listId', 'name contactCount');
        if (!campaign) throw new Error('Campaign not found');
        return campaign;
    }

    /**
     * Update a draft or scheduled campaign
     */
    async updateCampaign(userId, campaignId, updateData) {
        const campaign = await Campaign.findOne({ _id: campaignId, user: userId });
        if (!campaign) throw new Error('Campaign not found');
        if (!['draft', 'scheduled'].includes(campaign.status)) {
            throw new Error('Can only edit draft or scheduled campaigns');
        }

        const { name, phoneNumberId, templateId, listId, scheduledAt, sendingInterval, templateVariableMapping } = updateData;

        if (phoneNumberId && phoneNumberId !== campaign.phoneNumberId.toString()) {
            const phone = await WhatsAppPhoneNumber.findOne({ _id: phoneNumberId, userId });
            if (!phone) throw new Error('Invalid phone number');
        }
        if (templateId && templateId !== campaign.templateId.toString()) {
            const template = await Template.findById(templateId);
            if (!template || template.status !== 'APPROVED') throw new Error('Invalid or unapproved template');
        }
        if (listId && listId !== campaign.listId.toString()) {
            const list = await List.findOne({ _id: listId, userId });
            if (!list) throw new Error('Invalid list');
        }

        if (name) campaign.name = name;
        if (phoneNumberId) campaign.phoneNumberId = phoneNumberId;
        if (templateId) campaign.templateId = templateId;
        if (listId) campaign.listId = listId;
        if (scheduledAt !== undefined) {
            campaign.scheduledAt = scheduledAt || null;
            campaign.status = scheduledAt ? 'scheduled' : 'draft';
        }
        if (sendingInterval !== undefined) campaign.sendingInterval = sendingInterval;
        if (templateVariableMapping !== undefined) campaign.templateVariableMapping = templateVariableMapping;
        campaign.updatedAt = Date.now();

        return await campaign.save();
    }

    /**
     * Delete a draft or scheduled campaign
     */
    async deleteCampaign(userId, campaignId) {
        const campaign = await Campaign.findOne({ _id: campaignId, user: userId });
        if (!campaign) throw new Error('Campaign not found');
        if (!['draft', 'scheduled'].includes(campaign.status)) {
            throw new Error('Can only delete draft or scheduled campaigns');
        }
        await Campaign.deleteOne({ _id: campaignId });
        return { msg: 'Campaign deleted' };
    }

    /**
     * Start executing a campaign — queues it for async processing.
     * Returns immediately (non-blocking).
     */
    async startCampaign(userId, campaignId) {
        // Atomic update: only transitions from draft/scheduled to queued.
        // Prevents race condition if two requests hit simultaneously.
        const campaign = await Campaign.findOneAndUpdate(
            { _id: campaignId, user: userId, status: { $in: ['draft', 'scheduled'] } },
            { status: 'queued', updatedAt: Date.now() },
            { new: true }
        );

        if (!campaign) {
            throw new Error('Campaign not found or already started');
        }

        // Enqueue for async processing by orchestrator worker
        const orchestratorQueue = getOrchestratorQueue();
        await orchestratorQueue.add('start-campaign', {
            campaignId: campaign._id.toString(),
            userId: userId
        });

        return campaign;
    }

    /**
     * Pause a running campaign
     */
    async pauseCampaign(userId, campaignId) {
        const campaign = await Campaign.findOneAndUpdate(
            { _id: campaignId, user: userId, status: 'running' },
            { status: 'paused', updatedAt: Date.now() },
            { new: true }
        );
        if (!campaign) throw new Error('Campaign not found or not running');
        return campaign;
    }

    /**
     * Resume a paused campaign
     */
    async resumeCampaign(userId, campaignId) {
        const campaign = await Campaign.findOneAndUpdate(
            { _id: campaignId, user: userId, status: 'paused' },
            { status: 'running', updatedAt: Date.now() },
            { new: true }
        );
        if (!campaign) throw new Error('Campaign not found or not paused');
        return campaign;
    }

    /**
     * Cancel a running/paused/queued campaign
     */
    async cancelCampaign(userId, campaignId) {
        const campaign = await Campaign.findOneAndUpdate(
            { _id: campaignId, user: userId, status: { $in: ['running', 'paused', 'queued'] } },
            { status: 'cancelled', completedAt: new Date(), updatedAt: Date.now() },
            { new: true }
        );
        if (!campaign) throw new Error('Campaign not found or cannot be cancelled');
        return campaign;
    }

    /**
     * Get paginated messages for a campaign
     */
    async getCampaignMessages(userId, campaignId, page = 1, limit = 50) {
        // Verify campaign belongs to user
        const campaign = await Campaign.findOne({ _id: campaignId, user: userId });
        if (!campaign) throw new Error('Campaign not found');

        const skip = (page - 1) * limit;
        const messages = await Message.find({ campaignId })
            .populate('contact', 'firstName lastName countryCode phoneNumber')
            .sort({ timestamp: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Message.countDocuments({ campaignId });

        return {
            messages,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        };
    }

    /**
     * Get all campaigns for a user
     */
    async getCampaigns(userId) {
        return await Campaign.find({ user: userId })
            .populate('phoneNumberId', 'displayPhoneNumber')
            .populate('templateId', 'name')
            .populate('listId', 'name contactCount')
            .sort({ createdAt: -1 });
    }
}

module.exports = new CampaignService();
