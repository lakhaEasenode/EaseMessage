const Campaign = require('../models/Campaign');
const WhatsAppPhoneNumber = require('../models/WhatsAppPhoneNumber');
const Template = require('../models/Template');
const List = require('../models/List');

class CampaignService {
    /**
     * Create a new campaign with validation
     */
    async createCampaign(userId, campaignData) {
        const { name, phoneNumberId, templateId, listId, scheduledAt, sendingInterval } = campaignData;

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
            sendingInterval: sendingInterval || 0
        });

        return await newCampaign.save();
    }

    /**
     * Get verified templates for a specific phone number/WABA
     * Note: Templates are actually linked to WABA, not just phone number.
     * But we start from phone number to find the WABA.
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
            .populate('templateId', 'name components language category')
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

        const { name, phoneNumberId, templateId, listId, scheduledAt, sendingInterval } = updateData;

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
