const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/auth');
const WhatsAppBusinessAccount = require('../models/WhatsAppBusinessAccount');
const WhatsAppPhoneNumber = require('../models/WhatsAppPhoneNumber');
const { emitToUser } = require('../socket');

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
                    // Normalize the sender number: strip leading '+' and any non-digits
                    const normalizedFrom = from.replace(/\D/g, '');
                    // Try exact match on full number, then fallback to last 10 digits
                    let contact = await Contact.findOne({
                        userId: phoneRecord.userId,
                        isDeleted: false,
                        $or: [
                            { phoneNumber: normalizedFrom },
                            { phoneNumber: from },
                            // Fallback: match stored countryCode+phoneNumber against the full 'from'
                            // by checking if the stored phone ends with the last 10 digits
                        ]
                    });

                    // If no exact match, try last-10-digit match as fallback
                    if (!contact && normalizedFrom.length >= 10) {
                        const last10 = normalizedFrom.slice(-10);
                        contact = await Contact.findOne({
                            userId: phoneRecord.userId,
                            isDeleted: false,
                            phoneNumber: { $regex: last10 + '$' }
                        });
                    }

                    if (!contact) {
                        // Create new contact with normalized number
                        const profileName = body.entry[0].changes[0].value.contacts?.[0]?.profile?.name || 'Unknown';
                        // Extract country code: for Indian numbers (91xxx) take first 2 digits,
                        // fallback to first 1-3 digits based on number length, store the rest as phoneNumber
                        let cc = '';
                        let pn = normalizedFrom;
                        if (normalizedFrom.length > 10) {
                            cc = normalizedFrom.slice(0, normalizedFrom.length - 10);
                            pn = normalizedFrom.slice(-10);
                        }
                        contact = new Contact({
                            userId: phoneRecord.userId,
                            firstName: profileName,
                            lastName: '',
                            phoneNumber: pn,
                            countryCode: cc || '0',
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
                        type: ['text', 'image', 'video', 'document'].includes(msgBody.type) ? msgBody.type : 'text',
                        direction: 'inbound',
                        status: 'read', // Auto-mark as read for now or 'delivered'
                        timestamp: new Date(parseInt(msgBody.timestamp) * 1000)
                    });
                    await newMessage.save();

                    // Emit real-time events to the user
                    emitToUser(phoneRecord.userId.toString(), 'message:new', {
                        message: newMessage,
                        contactId: contact._id.toString()
                    });
                    emitToUser(phoneRecord.userId.toString(), 'conversation:updated', {
                        contactId: contact._id.toString()
                    });
                } else {
                    console.log(`Received message for unknown Phone Number ID: ${phoneNumberId}`);
                }
            }

            // Handle delivery status updates (sent, delivered, read, failed)
            const value = body.entry[0]?.changes?.[0]?.value;
            const statuses = value?.statuses;
            if (statuses && statuses.length > 0) {
                const Message = require('../models/Message');
                const Campaign = require('../models/Campaign');
                const statusOrder = { failed: 0, sent: 1, delivered: 2, read: 3 };

                // Resolve userId once for status emissions
                const statusPhoneNumberId = value.metadata?.phone_number_id;
                let statusUserId = null;
                if (statusPhoneNumberId) {
                    const statusPhoneRecord = await WhatsAppPhoneNumber.findOne({ phoneNumberId: statusPhoneNumberId });
                    if (statusPhoneRecord) statusUserId = statusPhoneRecord.userId.toString();
                }

                for (const statusUpdate of statuses) {
                    const wamid = statusUpdate.id;
                    const newStatus = statusUpdate.status;

                    if (!wamid || !statusOrder.hasOwnProperty(newStatus)) continue;

                    const message = await Message.findOne({ wamid });
                    if (!message) continue;

                    // Only progress forward (sent → delivered → read), never backwards
                    if ((statusOrder[newStatus] || 0) > (statusOrder[message.status] || 0)) {
                        message.status = newStatus;
                        if (newStatus === 'failed' && statusUpdate.errors?.[0]) {
                            message.errorCode = statusUpdate.errors[0].code;
                            message.errorMessage = statusUpdate.errors[0].title;
                        }
                        await message.save();

                        // Emit status update to user
                        if (statusUserId) {
                            emitToUser(statusUserId, 'message:status', {
                                messageId: message._id.toString(),
                                contactId: message.contact.toString(),
                                status: newStatus,
                                wamid
                            });
                        }
                    }

                    // Update campaign stats if this message belongs to a campaign
                    if (message.campaignId && ['delivered', 'read'].includes(newStatus)) {
                        await Campaign.updateOne(
                            { _id: message.campaignId },
                            { $inc: { [`stats.${newStatus}`]: 1 } }
                        );
                    }
                    if (message.campaignId && newStatus === 'failed') {
                        await Campaign.updateOne(
                            { _id: message.campaignId },
                            { $inc: { 'stats.deliveryFailed': 1 } }
                        );
                    }
                }
            }

            // Handle template status updates from Meta
            const templateStatusUpdate = value?.message_template_status_update;
            if (templateStatusUpdate) {
                const Template = require('../models/Template');
                const { message_template_id, message_template_name, event, reason } = templateStatusUpdate;

                console.log(`Template status webhook: ${message_template_name} (${message_template_id}) → ${event}`);

                // Meta sends: event = "APPROVED" | "REJECTED" | "PAUSED" | "DISABLED" | "PENDING_DELETION"
                const statusMap = {
                    APPROVED: 'APPROVED',
                    REJECTED: 'REJECTED',
                    PAUSED: 'PAUSED',
                    DISABLED: 'DISABLED',
                    PENDING_DELETION: 'REJECTED',
                };
                const newStatus = statusMap[event];

                if (newStatus && message_template_id) {
                    const template = await Template.findOne({ template_id: String(message_template_id) });
                    if (template) {
                        template.status = newStatus;
                        await template.save();

                        emitToUser(template.userId.toString(), 'template:status', {
                            templateId: template._id.toString(),
                            templateName: template.name,
                            status: newStatus,
                            reason: reason || null,
                        });

                        console.log(`Template "${template.name}" status updated to ${newStatus}`);
                    } else {
                        console.log(`Template not found for Meta ID: ${message_template_id}`);
                    }
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
