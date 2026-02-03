const express = require('express');
const router = express.Router();
const axios = require('axios');
const auth = require('../middleware/auth');
const Template = require('../models/Template');
const WhatsAppBusinessAccount = require('../models/WhatsAppBusinessAccount');

// @route   GET api/templates
// @desc    Get all templates for user
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const templates = await Template.find({ userId: req.user.id }).sort({ createdAt: -1 });
        res.json(templates);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET api/templates/sync
// @desc    Sync templates from Facebook Graph API
// @access  Private
router.get('/sync', auth, async (req, res) => {
    try {
        // 1. Get User's Connected WABA
        const wabaAccount = await WhatsAppBusinessAccount.findOne({ userId: req.user.id });
        if (!wabaAccount || !wabaAccount.accessToken) {
            return res.status(400).json({ msg: 'No connected WhatsApp Business Account found. Please connect one first.' });
        }

        // 2. Call Facebook Graph API to get all templates
        const response = await axios.get(
            `https://graph.facebook.com/v24.0/${wabaAccount.wabaId}/message_templates`,
            {
                headers: {
                    'Authorization': `Bearer ${wabaAccount.accessToken}`
                }
            }
        );

        const fetchedTemplates = response.data.data || [];

        // 3. Update or create templates in database based on template_id
        const syncResults = {
            updated: 0,
            created: 0,
            total: fetchedTemplates.length
        };

        for (const tmpl of fetchedTemplates) {
            // Extract body text from components
            const bodyComponent = tmpl.components.find(c => c.type === 'BODY');
            const bodyText = bodyComponent ? bodyComponent.text : '';

            // Extract variables from body text
            const variableRegex = /{{(\d+)}}/g;
            const variables = [];
            let match;
            while ((match = variableRegex.exec(bodyText)) !== null) {
                if (!variables.includes(match[0])) {
                    variables.push(match[0]);
                }
            }

            // Try to find existing template by template_id
            const existing = await Template.findOne({ template_id: tmpl.id });

            if (existing) {
                // Update existing template
                existing.name = tmpl.name;
                existing.category = tmpl.category;
                existing.language = tmpl.language;
                existing.body = bodyText;
                existing.variables = variables;
                existing.status = tmpl.status;
                existing.components = tmpl.components;
                existing.parameter_format = tmpl.parameter_format;
                await existing.save();
                syncResults.updated++;
            } else {
                // Create new template
                const newTemplate = new Template({
                    userId: req.user.id,
                    wabaId: wabaAccount.wabaId,
                    template_id: tmpl.id,
                    name: tmpl.name,
                    category: tmpl.category,
                    language: tmpl.language,
                    body: bodyText,
                    variables,
                    status: tmpl.status,
                    components: tmpl.components,
                    parameter_format: tmpl.parameter_format
                });
                await newTemplate.save();
                syncResults.created++;
            }
        }

        res.json({
            success: true,
            message: `Synced ${syncResults.total} templates (${syncResults.created} created, ${syncResults.updated} updated)`,
            ...syncResults
        });

    } catch (err) {
        console.error('Template Sync Error:', err.message);
        if (err.response) {
            console.error('Graph API Error Data:', err.response.data);
            const errorMsg = err.response.data.error?.message || 'Failed to sync templates from WhatsApp.';
            return res.status(400).json({ msg: errorMsg });
        }
        res.status(500).send('Server error');
    }
});

// @route   POST api/templates
// @desc    Create a new template via Facebook Graph API
// @access  Private
router.post('/', auth, async (req, res) => {
    const { name, category, language, body } = req.body;

    if (!name || !category || !body) {
        return res.status(400).json({ msg: 'Please provide all required fields' });
    }

    try {
        // 1. Get User's Connected WABA
        const wabaAccount = await WhatsAppBusinessAccount.findOne({ userId: req.user.id });
        if (!wabaAccount || !wabaAccount.accessToken) {
            return res.status(400).json({ msg: 'No connected WhatsApp Business Account found. Please connect one first.' });
        }

        // 2. Extract variables {{1}}, {{2}} etc. for local storage
        const variableRegex = /{{(\d+)}}/g;
        const variables = [];
        let match;
        while ((match = variableRegex.exec(body)) !== null) {
            if (!variables.includes(match[0])) {
                variables.push(match[0]);
            }
        }

        // 3. Construct Graph API Payload
        // Note: For simple text text templates, we use type: BODY
        // The user provided structure implies 'components' array
        const graphPayload = {
            name: name,
            category: category,
            language: language,
            components: [
                {
                    type: "BODY",
                    text: body
                }
            ]
        };

        // 4. Call Facebook Graph API
        const response = await axios.post(
            `https://graph.facebook.com/v24.0/${wabaAccount.wabaId}/message_templates`,
            graphPayload,
            {
                headers: {
                    'Authorization': `Bearer ${wabaAccount.accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const fbData = response.data; // { id: "...", status: "...", category: "..." }

        // 5. Save to Database
        const newTemplate = new Template({
            userId: req.user.id,
            wabaId: wabaAccount.wabaId,
            template_id: fbData.id,
            name,
            category,
            language,
            body,
            variables,
            status: fbData.status || 'PENDING'
        });

        const template = await newTemplate.save();
        res.json(template);

    } catch (err) {
        console.error('Template Creation Error:', err.message);
        // Handle Axios Error
        if (err.response) {
            console.error('Graph API Error Data:', err.response.data);
            const errorMsg = err.response.data.error?.message || 'Failed to create template on WhatsApp.';
            return res.status(400).json({ msg: errorMsg });
        }
        res.status(500).send('Server error');
    }
});

module.exports = router;
