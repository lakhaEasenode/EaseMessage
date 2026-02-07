const Campaign = require('../models/Campaign');
const WhatsAppPhoneNumber = require('../models/WhatsAppPhoneNumber');
const Template = require('../models/Template');
const List = require('../models/List');
const Contact = require('../models/Contact');
const Message = require('../models/Message');
const WhatsAppBusinessAccount = require('../models/WhatsAppBusinessAccount');
const axios = require('axios');

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
     * Start executing a campaign
     */
    async startCampaign(userId, campaignId) {
        // 1. Find and validate campaign
        const campaign = await Campaign.findOne({ _id: campaignId, user: userId });
        if (!campaign) throw new Error('Campaign not found');
        if (!['draft', 'scheduled'].includes(campaign.status)) {
            throw new Error('Campaign can only be started from draft or scheduled status');
        }

        // 2. Set status to running
        campaign.status = 'running';
        campaign.updatedAt = Date.now();
        await campaign.save();

        // 3. Get contacts from the target list
        const contacts = await Contact.findActive({
            lists: campaign.listId,
            userId: userId
        });

        // 4. Get phone number record and WABA for access token
        const phoneRecord = await WhatsAppPhoneNumber.findById(campaign.phoneNumberId);
        if (!phoneRecord) {
            campaign.status = 'failed';
            await campaign.save();
            throw new Error('Phone number not found');
        }

        const waba = await WhatsAppBusinessAccount.findById(phoneRecord.wabaId);
        if (!waba || !waba.accessToken) {
            campaign.status = 'failed';
            await campaign.save();
            throw new Error('WhatsApp Business Account not found or missing access token');
        }

        // 5. Get template data
        const template = await Template.findById(campaign.templateId);
        if (!template) {
            campaign.status = 'failed';
            await campaign.save();
            throw new Error('Template not found');
        }

        // 6. Send messages to each contact
        const sendUrl = `https://graph.facebook.com/v24.0/${phoneRecord.phoneNumberId}/messages`;

        for (const contact of contacts) {
            try {
                const phoneNumber = contact.countryCode + contact.phoneNumber;

                const payload = {
                    messaging_product: 'whatsapp',
                    recipient_type: 'individual',
                    to: phoneNumber,
                    type: 'template',
                    template: {
                        name: template.name,
                        language: { code: template.language || 'en_US' },
                        components: []
                    }
                };

                await axios.post(sendUrl, payload, {
                    headers: {
                        'Authorization': `Bearer ${waba.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                });

                // Save message record
                await new Message({
                    contact: contact._id,
                    content: `Template: ${template.name}`,
                    type: 'template',
                    direction: 'outbound',
                    status: 'sent',
                    timestamp: new Date()
                }).save();

                campaign.stats.sent += 1;
            } catch (err) {
                console.error(`Campaign ${campaignId}: Failed to send to ${contact._id}:`, err.message);
                campaign.stats.failed += 1;
            }

            // Save progress periodically
            campaign.updatedAt = Date.now();
            await campaign.save();

            // Wait between messages if interval is set
            if (campaign.sendingInterval > 0) {
                await new Promise(resolve => setTimeout(resolve, campaign.sendingInterval * 1000));
            }
        }

        // 7. Mark campaign as completed (or failed if ALL messages failed)
        campaign.status = campaign.stats.sent > 0 ? 'completed' : 'failed';
        campaign.updatedAt = Date.now();
        await campaign.save();

        return campaign;
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
