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
