const campaignService = require('../services/campaignService');

class CampaignController {
    /**
     * Create a new campaign
     */
    async createCampaign(req, res) {
        try {
            const campaign = await campaignService.createCampaign(req.user.id, req.body);
            res.status(201).json(campaign);
        } catch (err) {
            console.error('Error creating campaign:', err.message);
            res.status(400).json({ msg: err.message });
        }
    }

    /**
     * Get a single campaign
     */
    async getCampaign(req, res) {
        try {
            const campaign = await campaignService.getCampaign(req.user.id, req.params.id);
            res.json(campaign);
        } catch (err) {
            console.error('Error fetching campaign:', err.message);
            res.status(404).json({ msg: err.message });
        }
    }

    /**
     * Get all campaigns for logged in user
     */
    async getCampaigns(req, res) {
        try {
            const campaigns = await campaignService.getCampaigns(req.user.id);
            res.json(campaigns);
        } catch (err) {
            console.error('Error fetching campaigns:', err.message);
            res.status(500).json({ msg: 'Server Error' });
        }
    }

    /**
     * Update a campaign (draft/scheduled only)
     */
    async updateCampaign(req, res) {
        try {
            const campaign = await campaignService.updateCampaign(req.user.id, req.params.id, req.body);
            res.json(campaign);
        } catch (err) {
            console.error('Error updating campaign:', err.message);
            res.status(400).json({ msg: err.message });
        }
    }

    /**
     * Delete a campaign (draft/scheduled only)
     */
    async deleteCampaign(req, res) {
        try {
            const result = await campaignService.deleteCampaign(req.user.id, req.params.id);
            res.json(result);
        } catch (err) {
            console.error('Error deleting campaign:', err.message);
            res.status(400).json({ msg: err.message });
        }
    }

    /**
     * Get verified templates for a selected phone number
     */
    async getVerifiedTemplates(req, res) {
        try {
            const { phoneNumberId } = req.params;
            const templates = await campaignService.getVerifiedTemplatesForPhone(req.user.id, phoneNumberId);
            res.json(templates);
        } catch (err) {
            console.error('Error fetching verified templates:', err.message);
            res.status(400).json({ msg: err.message });
        }
    }
}

module.exports = new CampaignController();
