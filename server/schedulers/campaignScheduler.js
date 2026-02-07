const Campaign = require('../models/Campaign');
const campaignService = require('../services/campaignService');

const startScheduler = () => {
    console.log('Campaign scheduler started (checking every 60s)');

    setInterval(async () => {
        try {
            const dueCampaigns = await Campaign.find({
                status: 'scheduled',
                scheduledAt: { $lte: new Date() }
            });

            for (const campaign of dueCampaigns) {
                console.log(`Starting scheduled campaign: ${campaign.name} (${campaign._id})`);
                try {
                    await campaignService.startCampaign(campaign.user.toString(), campaign._id.toString());
                } catch (err) {
                    console.error(`Failed to start campaign ${campaign._id}:`, err.message);
                }
            }
        } catch (err) {
            console.error('Scheduler error:', err.message);
        }
    }, 60000);
};

module.exports = { startScheduler };
