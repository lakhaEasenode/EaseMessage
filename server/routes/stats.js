const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Contact = require('../models/Contact');
const List = require('../models/List');

// @route   GET api/stats
// @desc    Get stats for dashboard (total contacts, total lists)
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const scopeUserId = req.scopeUserId || req.user.id;
        const totalContacts = await Contact.countDocuments({
            userId: scopeUserId,
            isDeleted: false,
            optInSource: { $ne: 'whatsapp_inbound' }
        });

        const totalLists = await List.countDocuments({
            userId: scopeUserId,
            isDeleted: false
        });

        const optedInContacts = await Contact.countDocuments({
            userId: scopeUserId,
            isDeleted: false,
            optedIn: true,
            optInSource: { $ne: 'whatsapp_inbound' }
        });

        res.json({
            totalContacts,
            totalLists,
            optedInContacts
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
