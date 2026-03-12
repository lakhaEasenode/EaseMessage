const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Campaign = require('../models/Campaign');
const Contact = require('../models/Contact');
const Message = require('../models/Message');

// @route   GET api/dashboard
// @desc    Get dashboard stats
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const userId = req.scopeUserId || req.user.id;

        const userContacts = await Contact.find({ userId, isDeleted: { $ne: true } }).select('_id optInSource');
        const contactIds = userContacts.map(c => c._id);

        const totalContacts = userContacts.filter(c => c.optInSource !== 'whatsapp_inbound').length;
        const activeCampaigns = await Campaign.countDocuments({ user: userId, status: { $in: ['draft', 'scheduled', 'queued', 'running'] } });

        // Aggregate message stats for this user's contacts
        const messageStats = await Message.aggregate([
            { $match: { contact: { $in: contactIds } } },
            {
                $group: {
                    _id: null,
                    totalSent: { $sum: 1 },
                    delivered: {
                        $sum: { $cond: [{ $eq: ["$status", "delivered"] }, 1, 0] }
                    },
                    read: {
                        $sum: { $cond: [{ $eq: ["$status", "read"] }, 1, 0] }
                    }
                }
            }
        ]);

        const stats = messageStats[0] || { totalSent: 0, delivered: 0, read: 0 };

        // Calculate simple open rate
        const openRate = stats.totalSent > 0 ? Math.round((stats.read / stats.totalSent) * 100) : 0;

        // Get recent 7 days chart data (mock logic for now as we don't have historical seed data)
        // In a real app, this would aggregate by date
        const chartData = [
            { name: 'Mon', sent: 0, open: 0 },
            { name: 'Tue', sent: 0, open: 0 },
            { name: 'Wed', sent: 0, open: 0 },
            { name: 'Thu', sent: 0, open: 0 },
            { name: 'Fri', sent: 0, open: 0 },
            { name: 'Sat', sent: 0, open: 0 },
            { name: 'Sun', sent: 0, open: 0 },
        ];

        // Get recent campaigns
        const recentCampaigns = await Campaign.find({ user: userId }).sort({ createdAt: -1 }).limit(5);

        res.json({
            kpis: {
                totalContacts,
                activeCampaigns,
                totalSent: stats.totalSent,
                openRate
            },
            chartData,
            recentCampaigns
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
