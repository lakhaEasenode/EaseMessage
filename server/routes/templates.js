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
        const scopeUserId = req.scopeUserId || req.user.id;
        // Fetch templates first
        const templates = await Template.find({ userId: scopeUserId }).sort({ createdAt: -1 }).lean();

        // Manually populate WABA info to avoid Mongoose populate issues
        const populatedTemplates = await Promise.all(templates.map(async (template) => {
            if (template.wabaId) {
                const waba = await WhatsAppBusinessAccount.findById(template.wabaId).select('name wabaId').lean();
                template.wabaId = waba || null;
            }
            return template;
        }));

        res.json(populatedTemplates);
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
        const scopeUserId = req.scopeUserId || req.user.id;
        // 1. Get All User's Connected WABAs
        const wabaAccounts = await WhatsAppBusinessAccount.find({ userId: scopeUserId });

        if (!wabaAccounts || wabaAccounts.length === 0) {
            return res.status(400).json({ msg: 'No connected WhatsApp Business Accounts found. Please connect one first.' });
        }

        const syncResults = {
            totalAccounts: wabaAccounts.length,
            totalTemplates: 0,
            created: 0,
            updated: 0,
            errors: []
        };

        // 2. Iterate through each WABA
        for (const wabaAccount of wabaAccounts) {
            if (!wabaAccount.accessToken) {
                syncResults.errors.push(`Skipping ${wabaAccount.name}: No access token`);
                continue;
            }

            try {
                // Call Facebook Graph API
                const response = await axios.get(
                    `https://graph.facebook.com/v24.0/${wabaAccount.wabaId}/message_templates`,
                    {
                        headers: {
                            'Authorization': `Bearer ${wabaAccount.accessToken}`
                        }
                    }
                );

                const fetchedTemplates = response.data.data || [];
                syncResults.totalTemplates += fetchedTemplates.length;

                // Update or create templates in database
                for (const tmpl of fetchedTemplates) {
                    // Extract body text & variables (logic remains same)
                    const bodyComponent = tmpl.components.find(c => c.type === 'BODY');
                    const bodyText = bodyComponent ? bodyComponent.text : '';

                    const variableRegex = /{{(\d+)}}/g;
                    const variables = [];
                    let match;
                    while ((match = variableRegex.exec(bodyText)) !== null) {
                        if (!variables.includes(match[0])) variables.push(match[0]);
                    }

                    // Find existing template by template_id AND wabaId (to handle same template name in diff accounts)
                    // Note: template_id is unique per WABA usually, but let's be safe.
                    // Actually, Meta template Ids are globally unique, but we should scope by user/waba just in case.
                    const existing = await Template.findOne({
                        template_id: tmpl.id,
                        wabaId: wabaAccount._id
                    });

                    if (existing) {
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
                        const newTemplate = new Template({
                            userId: scopeUserId,
                            wabaId: wabaAccount._id,
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
            } catch (wabaErr) {
                console.error(`Error syncing WABA ${wabaAccount.name}:`, wabaErr.message);
                syncResults.errors.push(`Failed to sync ${wabaAccount.name}: ${wabaErr.message}`);
            }
        }

        res.json({
            success: true,
            message: `Synced ${syncResults.totalTemplates} templates from ${syncResults.totalAccounts} accounts (${syncResults.created} created, ${syncResults.updated} updated)`,
            ...syncResults
        });

    } catch (err) {
        console.error('Global Template Sync Error:', err.message);
        res.status(500).send('Server error');
    }
});

// @route   POST api/templates
// @desc    Create a new template via Facebook Graph API
// @access  Private
router.post('/', auth, async (req, res) => {
    const scopeUserId = req.scopeUserId || req.user.id;
    const { name, category, language, body, components, wabaId, variableDefinitions } = req.body;

    if (!name || !category || !body) {
        return res.status(400).json({ msg: 'Please provide all required fields' });
    }

    // Meta requires: lowercase letters and underscores only
    const sanitizedName = name.trim().toLowerCase().replace(/[\s-]+/g, '_').replace(/[^a-z0-9_]/g, '');
    if (!sanitizedName) {
        return res.status(400).json({ msg: 'Template name must contain at least one letter.' });
    }

    try {
        // 1. Get User's Connected WABA — use specific wabaId if provided
        let wabaAccount;
        if (wabaId) {
            wabaAccount = await WhatsAppBusinessAccount.findOne({ _id: wabaId, userId: scopeUserId });
        } else {
            wabaAccount = await WhatsAppBusinessAccount.findOne({ userId: scopeUserId });
        }
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

        // 3. Construct Graph API Payload using components from the client
        let graphComponents = components && components.length > 0
            ? JSON.parse(JSON.stringify(components)) // deep clone
            : [{ type: "BODY", text: body }];

        // 4. Handle media headers — client already uploaded to Meta and has the handle
        const MEDIA_FORMATS = ['IMAGE', 'VIDEO', 'DOCUMENT'];
        for (const comp of graphComponents) {
            if (comp.type === 'HEADER' && MEDIA_FORMATS.includes(comp.format) && comp.headerHandle) {
                comp.example = { header_handle: [comp.headerHandle] };
                delete comp.headerHandle;
            }
        }

        // 4b. Add example sample values for components with variables (required by Meta)
        for (const comp of graphComponents) {
            const varMatches = (comp.text || '').match(/{{(\d+)}}/g);
            if (!varMatches || varMatches.length === 0) continue;

            // Build sample values from variableDefinitions or use generic placeholders
            const samples = varMatches.map(v => {
                const idx = parseInt(v.replace(/[{}]/g, ''));
                const def = (variableDefinitions || []).find(d => d.index === idx);
                return def?.fallback || def?.attribute || `Sample${idx}`;
            });

            if (comp.type === 'BODY' && !comp.example) {
                comp.example = { body_text: [samples] };
            } else if (comp.type === 'HEADER' && comp.format === 'TEXT' && !comp.example) {
                comp.example = { header_text: samples };
            }
        }

        const graphPayload = {
            name: sanitizedName,
            category: category,
            language: language,
            components: graphComponents
        };

        // 5. Call Facebook Graph API
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

        // 6. Save to Database
        const newTemplate = new Template({
            userId: scopeUserId,
            wabaId: wabaAccount._id,
            template_id: fbData.id,
            name: sanitizedName,
            category,
            language,
            body,
            variables,
            variableDefinitions: variableDefinitions || [],
            components: graphComponents,
            status: fbData.status || 'PENDING'
        });

        const template = await newTemplate.save();
        res.json(template);

    } catch (err) {
        console.error('Template Creation Error:', err.message);
        // Handle Axios Error
        if (err.response) {
            console.error('Graph API Error Data:', err.response.data);
            const errorData = err.response.data.error;
            const errorMsg = errorData?.error_user_msg || errorData?.message || 'Failed to create template on WhatsApp.';
            return res.status(400).json({ msg: errorMsg });
        }
        res.status(500).send('Server error');
    }
});

// @route   GET api/templates/contact-fields
// @desc    Get available contact fields for template variable mapping
// @access  Private
router.get('/contact-fields', auth, (req, res) => {
    const { CONTACT_FIELDS } = require('../utils/contactFields');
    res.json(CONTACT_FIELDS);
});

module.exports = router;
