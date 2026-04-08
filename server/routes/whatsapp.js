const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/auth');
const WhatsAppBusinessAccount = require('../models/WhatsAppBusinessAccount');
const WhatsAppPhoneNumber = require('../models/WhatsAppPhoneNumber');
const { emitToUser } = require('../socket');

// Meta Graph API fields
const WABA_FIELDS = 'name,timezone_id,message_template_namespace,account_review_status,on_behalf_of_business_info,ownership_type,currency,country';
const PHONE_FIELDS = 'verified_name,display_phone_number,code_verification_status,quality_rating,platform_type,throughput,messaging_limit_tier,name_status,new_name_status,status,health_status,is_official_business_account,account_mode,certificate,last_onboarded_time';

// Shared helper: fetch WABA details + phone numbers from Meta and upsert into DB
async function syncWabaAndPhoneNumbers(scopeUserId, wabaId, accessToken) {
    // 1. Fetch WABA Details (including analytics fields)
    const wabaResponse = await axios.get(`https://graph.facebook.com/v24.0/${wabaId}`, {
        params: { fields: WABA_FIELDS, access_token: accessToken }
    });
    const wabaData = wabaResponse.data;

    const wabaMetaData = {
        account_review_status: wabaData.account_review_status,
        on_behalf_of_business_info: wabaData.on_behalf_of_business_info,
        ownership_type: wabaData.ownership_type,
        currency: wabaData.currency,
        country: wabaData.country,
    };

    // Fetch conversation analytics (last 30 days) — best-effort
    let conversationAnalytics = null;
    try {
        const now = Math.floor(Date.now() / 1000);
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
        const analyticsRes = await axios.get(
            `https://graph.facebook.com/v24.0/${wabaId}`,
            {
                params: {
                    fields: `conversation_analytics.start(${thirtyDaysAgo}).end(${now}).granularity(DAILY)`,
                    access_token: accessToken
                }
            }
        );
        const rawData = analyticsRes.data?.conversation_analytics?.data?.[0]?.data_points || [];
        let totalConversations = 0;
        let businessInitiated = 0;
        let userInitiated = 0;
        for (const point of rawData) {
            const count = point.conversation || 0;
            totalConversations += count;
            if (point.conversation_direction === 'BUSINESS_INITIATED') businessInitiated += count;
            if (point.conversation_direction === 'USER_INITIATED') userInitiated += count;
        }
        conversationAnalytics = { totalConversations, businessInitiated, userInitiated, periodDays: 30 };
    } catch (convErr) {
        console.warn(`Failed to fetch conversation analytics for WABA ${wabaId}:`, convErr.response?.data?.error?.message || convErr.message);
    }

    wabaMetaData.conversation_analytics = conversationAnalytics;

    // Check if exists or create new
    let account = await WhatsAppBusinessAccount.findOne({ wabaId });

    if (account) {
        account.accessToken = accessToken;
        account.name = wabaData.name;
        account.timezoneId = wabaData.timezone_id;
        account.messageTemplateNamespace = wabaData.message_template_namespace;
        account.metaData = wabaMetaData;
        account.lastSyncedAt = new Date();
        await account.save();
    } else {
        account = new WhatsAppBusinessAccount({
            userId: scopeUserId,
            wabaId: wabaData.id,
            name: wabaData.name,
            timezoneId: wabaData.timezone_id,
            messageTemplateNamespace: wabaData.message_template_namespace,
            accessToken,
            metaData: wabaMetaData,
            lastSyncedAt: new Date()
        });
        await account.save();
    }

    // 2. Fetch Phone Numbers
    const phoneResponse = await axios.get(`https://graph.facebook.com/v24.0/${wabaId}/phone_numbers`, {
        headers: { Authorization: `Bearer ${accessToken}` }
    });

    const phoneNumbers = phoneResponse.data.data;
    const savedNumbers = [];

    // 3. For each phone, fetch enriched details in parallel
    const phoneMetaResults = await Promise.all(
        phoneNumbers.map(phone =>
            axios.get(`https://graph.facebook.com/v24.0/${phone.id}`, {
                params: { fields: PHONE_FIELDS, access_token: accessToken }
            }).then(r => r.data).catch(err => {
                console.warn(`Failed to fetch Meta details for phone ${phone.id}:`, err.response?.data?.error?.message || err.message);
                return null;
            })
        )
    );

    for (let i = 0; i < phoneNumbers.length; i++) {
        const phone = phoneNumbers[i];
        const phoneMeta = phoneMetaResults[i];

        let phoneRecord = await WhatsAppPhoneNumber.findOne({ phoneNumberId: phone.id });

        const phoneFields = {
            verifiedName: phone.verified_name,
            displayPhoneNumber: phone.display_phone_number,
            codeVerificationStatus: phone.code_verification_status,
            qualityRating: phone.quality_rating,
            platformType: phone.platform_type,
            throughput: phone.throughput,
            metaData: phoneMeta,
            lastSyncedAt: new Date()
        };

        if (phoneRecord) {
            Object.assign(phoneRecord, phoneFields);
            await phoneRecord.save();
        } else {
            phoneRecord = new WhatsAppPhoneNumber({
                userId: scopeUserId,
                wabaId: account._id,
                phoneNumberId: phone.id,
                ...phoneFields
            });
            await phoneRecord.save();
        }
        savedNumbers.push(phoneRecord);
    }

    return { account, phoneNumbers: savedNumbers };
}

// @route   POST api/whatsapp/connect
// @desc    Connect a WhatsApp Business Account (manual token entry)
// @access  Private
router.post('/connect', auth, async (req, res) => {
    const { wabaId, accessToken } = req.body;
    const scopeUserId = req.scopeUserId || req.user.id;

    if (!wabaId || !accessToken) {
        return res.status(400).json({ msg: 'WABA ID and Access Token are required' });
    }

    try {
        const { account, phoneNumbers } = await syncWabaAndPhoneNumbers(scopeUserId, wabaId, accessToken);

        res.json({
            msg: 'WhatsApp Account connected successfully',
            account,
            phoneNumbers
        });
    } catch (err) {
        console.error(err.message);
        const errorMsg = err.response?.data?.error?.message || 'Failed to connect WhatsApp account';
        res.status(400).json({ msg: errorMsg });
    }
});

// @route   GET api/whatsapp/embedded-signup-config
// @desc    Return Meta App ID and Config ID for Embedded Signup SDK init
// @access  Private
router.get('/embedded-signup-config', auth, (req, res) => {
    const { META_APP_ID, META_CONFIG_ID } = process.env;
    if (!META_APP_ID || !META_CONFIG_ID) {
        return res.status(500).json({ msg: 'Embedded Signup is not configured on the server' });
    }
    res.json({ appId: META_APP_ID, configId: META_CONFIG_ID });
});

// @route   POST api/whatsapp/embedded-signup
// @desc    Complete Embedded Signup — exchange OAuth code for token, discover WABA, sync
// @access  Private
router.post('/embedded-signup', auth, async (req, res) => {
    const { code } = req.body;
    const scopeUserId = req.scopeUserId || req.user.id;

    if (!code) {
        return res.status(400).json({ msg: 'Authorization code is required' });
    }

    const { META_APP_ID, META_APP_SECRET } = process.env;
    if (!META_APP_ID || !META_APP_SECRET) {
        console.error('Missing META_APP_ID or META_APP_SECRET in environment');
        return res.status(500).json({ msg: 'Server configuration error' });
    }

    try {
        // Step 1: Exchange code for access token
        const tokenResponse = await axios.get('https://graph.facebook.com/v24.0/oauth/access_token', {
            params: {
                client_id: META_APP_ID,
                client_secret: META_APP_SECRET,
                code
            }
        });
        const userAccessToken = tokenResponse.data.access_token;
        console.log('Embedded Signup — access token obtained:', userAccessToken.slice(0, 10) + '...');

        // Step 2: Debug token to discover shared WABA and phone numbers
        const debugResponse = await axios.get('https://graph.facebook.com/v24.0/debug_token', {
            params: {
                input_token: userAccessToken,
                access_token: `${META_APP_ID}|${META_APP_SECRET}`
            }
        });
        const scopes = debugResponse.data.data?.granular_scopes || [];

        const wabaScope = scopes.find(s => s.scope === 'whatsapp_business_management');
        const wabaId = wabaScope?.target_ids?.[0];

        console.log('Embedded Signup — discovered WABA ID:', wabaId);

        if (!wabaId) {
            return res.status(400).json({
                msg: 'No WhatsApp Business Account was shared during signup. Please try again and complete the full signup flow.'
            });
        }

        // Step 3: Sync WABA details and phone numbers
        const { account, phoneNumbers } = await syncWabaAndPhoneNumbers(scopeUserId, wabaId, userAccessToken);

        // Step 4: Subscribe WABA to webhooks (best-effort)
        try {
            await axios.post(
                `https://graph.facebook.com/v24.0/${wabaId}/subscribed_apps`,
                {},
                { headers: { Authorization: `Bearer ${userAccessToken}` } }
            );
        } catch (subErr) {
            console.warn('Webhook subscription failed (non-fatal):', subErr.response?.data?.error?.message || subErr.message);
        }

        res.json({
            msg: 'WhatsApp Account connected via Embedded Signup',
            account,
            phoneNumbers
        });
    } catch (err) {
        console.error('Embedded Signup error:', err.response?.data || err.message);
        const errorMsg = err.response?.data?.error?.message || 'Failed to complete Embedded Signup';
        res.status(400).json({ msg: errorMsg });
    }
});

// @route   GET api/whatsapp/accounts
// @desc    Get connected accounts (served from DB — use POST /accounts/sync to refresh from Meta)
// @access  Private
router.get('/accounts', auth, async (req, res) => {
    try {
        const accounts = await WhatsAppBusinessAccount.find({ userId: req.scopeUserId || req.user.id });

        const result = await Promise.all(accounts.map(async (acc) => {
            const numbers = await WhatsAppPhoneNumber.find({ wabaId: acc._id });
            const { accessToken: _token, metaData: wabaMetaData, ...accObj } = acc.toObject();

            const enrichedNumbers = numbers.map(num => {
                const { metaData: phoneMetaData, ...numObj } = num.toObject();
                numObj.meta = phoneMetaData || null;
                return numObj;
            });

            return {
                ...accObj,
                analytics: wabaMetaData || null,
                phoneNumbers: enrichedNumbers
            };
        }));

        res.json(result);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   POST api/whatsapp/accounts/sync
// @desc    Re-sync all accounts from Meta Graph API and persist to DB
// @access  Private
router.post('/accounts/sync', auth, async (req, res) => {
    try {
        const scopeUserId = req.scopeUserId || req.user.id;
        const accounts = await WhatsAppBusinessAccount.find({ userId: scopeUserId });

        if (accounts.length === 0) {
            return res.json({ msg: 'No accounts to sync', accounts: [] });
        }

        const results = [];
        for (const acc of accounts) {
            try {
                const { account, phoneNumbers } = await syncWabaAndPhoneNumbers(scopeUserId, acc.wabaId, acc.accessToken);
                results.push({ wabaId: acc.wabaId, status: 'synced', phoneNumbers: phoneNumbers.length });
            } catch (err) {
                console.error(`Sync failed for WABA ${acc.wabaId}:`, err.response?.data?.error?.message || err.message);
                results.push({ wabaId: acc.wabaId, status: 'failed', error: err.response?.data?.error?.message || err.message });
            }
        }

        res.json({ msg: 'Sync complete', results });
    } catch (err) {
        console.error('Sync error:', err.message);
        res.status(500).json({ msg: 'Sync failed' });
    }
});

// @route   DELETE api/whatsapp/accounts/:wabaId
// @desc    Disconnect a WhatsApp Business Account and its phone numbers
// @access  Private
router.delete('/accounts/:wabaId', auth, async (req, res) => {
    try {
        const scopeUserId = req.scopeUserId || req.user.id;
        const account = await WhatsAppBusinessAccount.findOne({
            wabaId: req.params.wabaId,
            userId: scopeUserId
        });

        if (!account) {
            return res.status(404).json({ msg: 'Account not found' });
        }

        // Delete all phone numbers linked to this WABA
        await WhatsAppPhoneNumber.deleteMany({ wabaId: account._id });

        // Delete templates linked to this WABA
        const Template = require('../models/Template');
        await Template.deleteMany({ wabaId: account._id });

        // Delete the WABA record
        await WhatsAppBusinessAccount.deleteOne({ _id: account._id });

        res.json({ msg: 'WhatsApp Account disconnected successfully' });
    } catch (err) {
        console.error('Disconnect error:', err.message);
        res.status(500).json({ msg: 'Failed to disconnect account' });
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
            userId: req.scopeUserId || req.user.id
        });

        if (!phoneNumber) {
            return res.status(404).json({ msg: 'Phone number not found' });
        }

        // Unset all other defaults for this user
        await WhatsAppPhoneNumber.updateMany(
            { userId: req.scopeUserId || req.user.id },
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
            const changeField = body.entry[0]?.changes?.[0]?.field;
            if (changeField === 'message_template_status_update' && value) {
                const Template = require('../models/Template');
                const { message_template_id, message_template_name, event, reason } = value;

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
