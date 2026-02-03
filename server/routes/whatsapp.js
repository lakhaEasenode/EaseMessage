const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/auth');
const WhatsAppBusinessAccount = require('../models/WhatsAppBusinessAccount');
const WhatsAppPhoneNumber = require('../models/WhatsAppPhoneNumber');

// @route   POST api/whatsapp/connect
// @desc    Connect a WhatsApp Business Account
// @access  Private
router.post('/connect', auth, async (req, res) => {
    const { wabaId, accessToken } = req.body;

    if (!wabaId || !accessToken) {
        return res.status(400).json({ msg: 'WABA ID and Access Token are required' });
    }

    try {
        // 1. Fetch WABA Details
        const wabaResponse = await axios.get(`https://graph.facebook.com/v24.0/${wabaId}?access_token=${accessToken}`);
        const wabaData = wabaResponse.data;

        // Check if exists or create new
        let account = await WhatsAppBusinessAccount.findOne({ wabaId });

        if (account) {
            // Update existing
            account.accessToken = accessToken;
            account.name = wabaData.name;
            account.timezoneId = wabaData.timezone_id;
            account.messageTemplateNamespace = wabaData.message_template_namespace;
            await account.save();
        } else {
            // Create new
            account = new WhatsAppBusinessAccount({
                userId: req.user.id,
                wabaId: wabaData.id,
                name: wabaData.name,
                timezoneId: wabaData.timezone_id,
                messageTemplateNamespace: wabaData.message_template_namespace,
                accessToken
            });
            await account.save();
        }

        // 2. Fetch Phone Numbers
        const phoneResponse = await axios.get(`https://graph.facebook.com/v24.0/${wabaId}/phone_numbers`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });

        const phoneNumbers = phoneResponse.data.data;
        const savedNumbers = [];

        for (const phone of phoneNumbers) {
            let phoneRecord = await WhatsAppPhoneNumber.findOne({ phoneNumberId: phone.id });

            if (phoneRecord) {
                // Update
                phoneRecord.verifiedName = phone.verified_name;
                phoneRecord.displayPhoneNumber = phone.display_phone_number;
                phoneRecord.codeVerificationStatus = phone.code_verification_status;
                phoneRecord.qualityRating = phone.quality_rating;
                phoneRecord.platformType = phone.platform_type;
                phoneRecord.throughput = phone.throughput;
                await phoneRecord.save();
            } else {
                // Create
                phoneRecord = new WhatsAppPhoneNumber({
                    userId: req.user.id,
                    wabaId: account._id,
                    phoneNumberId: phone.id,
                    verifiedName: phone.verified_name,
                    displayPhoneNumber: phone.display_phone_number,
                    codeVerificationStatus: phone.code_verification_status,
                    qualityRating: phone.quality_rating,
                    platformType: phone.platform_type,
                    throughput: phone.throughput
                });
                await phoneRecord.save();
            }
            savedNumbers.push(phoneRecord);
        }

        res.json({
            msg: 'WhatsApp Account connected successfully',
            account,
            phoneNumbers: savedNumbers
        });

    } catch (err) {
        console.error(err.message);
        const errorMsg = err.response?.data?.error?.message || 'Failed to connect WhatsApp account';
        res.status(400).json({ msg: errorMsg });
    }
});

// @route   GET api/whatsapp/accounts
// @desc    Get connected accounts
// @access  Private
router.get('/accounts', auth, async (req, res) => {
    try {
        const accounts = await WhatsAppBusinessAccount.find({ userId: req.user.id });
        const result = [];

        for (const acc of accounts) {
            const numbers = await WhatsAppPhoneNumber.find({ wabaId: acc._id });
            result.push({
                ...acc.toObject(),
                phoneNumbers: numbers
            });
        }

        res.json(result);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   PUT api/whatsapp/phone/:phoneNumberId/set-default
// @desc    Set a phone number as default for sending messages
// @access  Private
router.put('/phone/:phoneNumberId/set-default', auth, async (req, res) => {
    try {
        const { phoneNumberId } = req.params;

        // Find the phone number
        const phoneNumber = await WhatsAppPhoneNumber.findOne({
            phoneNumberId,
            userId: req.user.id
        });

        if (!phoneNumber) {
            return res.status(404).json({ msg: 'Phone number not found' });
        }

        // Unset all other defaults for this user
        await WhatsAppPhoneNumber.updateMany(
            { userId: req.user.id },
            { isDefault: false }
        );

        // Set this one as default
        phoneNumber.isDefault = true;
        await phoneNumber.save();

        res.json({ msg: 'Default phone number updated', phoneNumber });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET api/whatsapp/webhook
// @desc    Webhook verification
// @access  Public
router.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    // In a real app, verify_token should be checked against env var or DB
    // For now, accept any token or a specific one 'antigravity_token'
    if (mode && token) {
        if (mode === 'subscribe' && token === (process.env.WEBHOOK_VERIFY_TOKEN || 'antigravity_token')) {
            console.log('WEBHOOK_VERIFIED');
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(400); // Bad Request if parameters missing
    }
});

// @route   POST api/whatsapp/webhook
// @desc    Receive incoming messages
// @access  Public
router.post('/webhook', async (req, res) => {
    const { body } = req;

    console.log('Incoming Webhook:', JSON.stringify(body, null, 2));

    try {
        if (body.object) {
            if (body.entry &&
                body.entry[0].changes &&
                body.entry[0].changes[0] &&
                body.entry[0].changes[0].value.messages &&
                body.entry[0].changes[0].value.messages[0]
            ) {
                const phoneNumberId = body.entry[0].changes[0].value.metadata.phone_number_id;
                const from = body.entry[0].changes[0].value.messages[0].from;
                const msgBody = body.entry[0].changes[0].value.messages[0];
                const msgText = msgBody.text ? msgBody.text.body : (msgBody.type === 'button' ? msgBody.button.text : `Attachment: ${msgBody.type}`);

                // Find or create contact
                // We need to assume which user this belongs to. 
                // Since this is a public webhook for multiple users, we ideally identify the user by phoneNumberId -> WABA -> User
                // But for now, we will try to find a WhatsAppPhoneNumber with this ID to find the User.

                const Contact = require('../models/Contact');
                const Message = require('../models/Message');

                const phoneRecord = await WhatsAppPhoneNumber.findOne({ phoneNumberId: phoneNumberId });

                if (phoneRecord) {
                    let contact = await Contact.findOne({
                        userId: phoneRecord.userId,
                        phoneNumber: { $regex: from.slice(-10) } // Simple match for now
                    });

                    if (!contact) {
                        // Create new contact
                        contact = new Contact({
                            userId: phoneRecord.userId,
                            firstName: body.entry[0].changes[0].value.contacts[0].profile.name || 'Unknown',
                            lastName: 'WhatsApp',
                            phoneNumber: from, // Store full number
                            countryCode: '', // Already included in 'from' usually
                            optedIn: true,
                            optInSource: 'whatsapp_inbound',
                            optInDate: new Date()
                        });
                        await contact.save();
                    }

                    // Save Message
                    const newMessage = new Message({
                        contact: contact._id,
                        content: msgText,
                        type: msgBody.type === 'text' ? 'text' : 'image', // simplified
                        direction: 'inbound',
                        status: 'read', // Auto-mark as read for now or 'delivered'
                        timestamp: new Date(parseInt(msgBody.timestamp) * 1000)
                    });
                    await newMessage.save();
                } else {
                    console.log(`Received message for unknown Phone Number ID: ${phoneNumberId}`);
                }
            }
            res.sendStatus(200);
        } else {
            res.sendStatus(404);
        }
    } catch (err) {
        console.error('Webhook Error:', err.message);
        res.sendStatus(500);
    }
});

module.exports = router;
