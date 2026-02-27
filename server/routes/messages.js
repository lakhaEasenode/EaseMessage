const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const Message = require('../models/Message');
const Contact = require('../models/Contact');
const WhatsAppBusinessAccount = require('../models/WhatsAppBusinessAccount');
const WhatsAppPhoneNumber = require('../models/WhatsAppPhoneNumber');
const axios = require('axios');
const { emitToUser } = require('../socket');

// @route   GET api/messages/conversations
// @desc    Get all conversations (contacts with last message)
// @access  Private
router.get('/conversations', auth, async (req, res) => {
    try {
        // 1. Get the user's contact IDs first to scope the aggregation
        const userContacts = await Contact.find({
            userId: req.user.id,
            isDeleted: false
        }).select('_id');
        const userContactIds = userContacts.map(c => c._id);

        // 2. Aggregate messages scoped to only this user's contacts
        const lastMessages = await Message.aggregate([
            { $match: { contact: { $in: userContactIds } } },
            { $sort: { timestamp: -1 } },
            {
                $group: {
                    _id: "$contact",
                    lastMessage: { $first: "$$ROOT" },
                    unreadCount: {
                        $sum: {
                            $cond: [
                                { $and: [
                                    { $eq: ["$direction", "inbound"] },
                                    { $ne: ["$status", "read"] }
                                ]},
                                1,
                                0
                            ]
                        }
                    }
                }
            }
        ]);

        // 3. Map results to a dictionary for easy lookup
        const messageMap = {};
        lastMessages.forEach(item => {
            if (item._id) {
                messageMap[item._id.toString()] = {
                    lastMessage: item.lastMessage,
                    unreadCount: item.unreadCount
                };
            }
        });

        // 4. Fetch the full contact documents
        const contactIds = Object.keys(messageMap).map(id => new mongoose.Types.ObjectId(id));
        const contacts = await Contact.find({
            _id: { $in: contactIds },
            userId: req.user.id,
            isDeleted: false
        }).populate('lists', 'name');

        // 5. Combine contact info with last message and unread count
        const conversations = contacts.map(contact => {
            const data = messageMap[contact._id.toString()];
            return {
                contact,
                lastMessage: data?.lastMessage || null,
                unreadCount: data?.unreadCount || 0,
                sortTime: data?.lastMessage ? new Date(data.lastMessage.timestamp) : new Date(contact.createdAt)
            };
        });

        // 6. Sort by most recent activity
        conversations.sort((a, b) => b.sortTime - a.sortTime);

        res.json(conversations);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET api/messages/:contactId
// @desc    Get message history for a specific contact
// @access  Private
router.get('/:contactId', auth, async (req, res) => {
    try {
        // Verify the contact belongs to the authenticated user
        const contact = await Contact.findOne({
            _id: req.params.contactId,
            userId: req.user.id,
            isDeleted: false
        });
        if (!contact) {
            return res.status(404).json({ msg: 'Contact not found' });
        }

        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 50;
        const skip = (page - 1) * limit;

        const totalMessages = await Message.countDocuments({ contact: req.params.contactId });
        const totalPages = Math.ceil(totalMessages / limit);

        const messages = await Message.find({ contact: req.params.contactId })
            .sort({ timestamp: -1 }) // Newest first for pagination
            .skip(skip)
            .limit(limit);

        // Reverse so oldest is first in the returned page (for chat display order)
        messages.reverse();

        res.json({
            messages,
            pagination: {
                page,
                limit,
                totalMessages,
                totalPages,
                hasMore: page < totalPages
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   POST api/messages/send
// @desc    Send a message (text or template)
// @access  Private
router.post('/send', auth, async (req, res) => {
    const { contactId, type, content, templateData } = req.body;

    try {
        // Verify the contact belongs to the authenticated user
        const contact = await Contact.findOne({
            _id: contactId,
            userId: req.user.id,
            isDeleted: false
        });
        if (!contact) {
            return res.status(404).json({ msg: 'Contact not found' });
        }

        // Check 24-hour window if NOT a template message
        if (type !== 'template') {
            const lastInbound = await Message.findOne({
                contact: contactId,
                direction: 'inbound'
            }).sort({ timestamp: -1 });

            if (lastInbound) {
                const now = new Date();
                const diff = (now - new Date(lastInbound.timestamp)) / (1000 * 60 * 60); // hours
                if (diff > 24) {
                    return res.status(400).json({
                        msg: '24-hour reply window expired. You must send a template message.'
                    });
                }
            } else {
                return res.status(400).json({
                    msg: 'Cannot initiate conversation with free-form message. Send a template first.'
                });
            }
        }

        // Calculate Payload for Graph API
        const phoneNumber = contact.countryCode.replace('+', '') + contact.phoneNumber;

        // Find the DEFAULT phone number for this user
        const phoneRecord = await WhatsAppPhoneNumber.findOne({
            userId: req.user.id,
            isDefault: true
        });

        if (!phoneRecord) {
            return res.status(400).json({
                msg: 'No default WhatsApp phone number set. Please set a default phone number in Settings.'
            });
        }

        // Get the WABA account for this phone number to get the access token
        const phoneWaba = await WhatsAppBusinessAccount.findById(phoneRecord.wabaId);
        if (!phoneWaba || !phoneWaba.accessToken) {
            return res.status(400).json({ msg: 'WhatsApp Business Account not found or missing access token' });
        }

        const sendUrl = `https://graph.facebook.com/v24.0/${phoneRecord.phoneNumberId}/messages`;

        let payload = {
            messaging_product: "whatsapp",
            recipient_type: "individual",
            to: phoneNumber,
            type: type
        };

        if (type === 'text') {
            payload.text = { body: content };
        } else if (type === 'template') {
            payload.template = {
                name: templateData.name,
                language: { code: templateData.language },
                components: templateData.components || []
            };
        } else if (['image', 'video', 'document'].includes(type)) {
            // For media, we assume 'content' is the URL or ID. 
            // In a real app we might handle file uploads first.
            // Here we assume content is a link.
            payload[type] = { link: content };
        }

        // Call Graph API using the WABA associated with the default phone number
        const response = await axios.post(sendUrl, payload, {
            headers: {
                'Authorization': `Bearer ${phoneWaba.accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        // Extract wamid from Meta response for delivery tracking
        const wamid = response.data?.messages?.[0]?.id || null;

        // Save to Database
        const newMessage = new Message({
            contact: contactId,
            content: type === 'template' ? `Template: ${templateData.name}` : content,
            type: type,
            direction: 'outbound',
            status: 'sent',
            wamid: wamid,
            timestamp: new Date()
        });

        await newMessage.save();

        // Emit to other tabs/devices for this user
        emitToUser(req.user.id, 'message:sent', {
            message: newMessage,
            contactId: contactId
        });
        emitToUser(req.user.id, 'conversation:updated', {
            contactId: contactId
        });

        res.json(newMessage);

    } catch (err) {
        console.error('Send Message Error:', err.message);
        if (err.response) {
            console.error('Meta API Error:', err.response.data);
            return res.status(400).json({ msg: err.response.data.error?.message || 'Failed to send message' });
        }
        res.status(500).send('Server error');
    }
});

module.exports = router;
