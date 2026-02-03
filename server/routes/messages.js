const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Message = require('../models/Message');
const Contact = require('../models/Contact');
const WhatsAppBusinessAccount = require('../models/WhatsAppBusinessAccount');
const axios = require('axios');

// @route   GET api/messages/conversations
// @desc    Get all conversations (contacts with last message)
// @access  Private
router.get('/conversations', auth, async (req, res) => {
    try {
        // 1. Aggregate messages to find the last message for each contact
        const lastMessages = await Message.aggregate([
            { $sort: { timestamp: -1 } },
            {
                $group: {
                    _id: "$contact",
                    lastMessage: { $first: "$$ROOT" }
                }
            }
        ]);

        // 2. Map results to a dictionary for easy lookup
        const messageMap = {};
        lastMessages.forEach(item => {
            if (item._id) {
                messageMap[item._id.toString()] = item.lastMessage;
            }
        });

        // 3. Fetch only contacts that have messages
        const contactIds = Object.keys(messageMap);
        const contacts = await Contact.find({
            _id: { $in: contactIds },
            userId: req.user.id,
            isDeleted: false
        });

        // 4. Combine contact info with last message
        const conversations = contacts.map(contact => {
            const lastMsg = messageMap[contact._id.toString()];
            return {
                contact,
                lastMessage: lastMsg || null,
                // If no message, use contact creation date for sorting (fallback, though all should have message now)
                sortTime: lastMsg ? new Date(lastMsg.timestamp) : new Date(contact.createdAt)
            };
        });

        // 5. Sort by most recent activity
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
        const messages = await Message.find({ contact: req.params.contactId })
            .sort({ timestamp: 1 }); // Oldest first
        res.json(messages);
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
        const contact = await Contact.findById(contactId);
        if (!contact) {
            return res.status(404).json({ msg: 'Contact not found' });
        }

        // Get Connected WhatsApp Account
        const wabaAccount = await WhatsAppBusinessAccount.findOne({ userId: req.user.id });
        if (!wabaAccount || !wabaAccount.accessToken) {
            return res.status(400).json({ msg: 'No connected WhatsApp Business Account found' });
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
        const WhatsAppPhoneNumber = require('../models/WhatsAppPhoneNumber');
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

        // Call Graph API
        const response = await axios.post(sendUrl, payload, {
            headers: {
                'Authorization': `Bearer ${wabaAccount.accessToken}`,
                'Content-Type': 'application/json'
            }
        });

        // Save to Database
        const newMessage = new Message({
            contact: contactId,
            content: type === 'template' ? `Template: ${templateData.name}` : content,
            type: type,
            direction: 'outbound',
            status: 'sent',
            timestamp: new Date()
        });

        await newMessage.save();

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
