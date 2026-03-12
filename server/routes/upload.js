const express = require('express');
const router = express.Router();
const multer = require('multer');
const axios = require('axios');
const auth = require('../middleware/auth');
const { validateMagicBytes } = require('../utils/validateFile');
const WhatsAppBusinessAccount = require('../models/WhatsAppBusinessAccount');

const ALLOWED_TYPES = {
    'image/jpeg': 'IMAGE',
    'image/png': 'IMAGE',
    'video/mp4': 'VIDEO',
    'application/pdf': 'DOCUMENT',
};

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 16 * 1024 * 1024 }, // 16 MB
    fileFilter: (req, file, cb) => {
        if (ALLOWED_TYPES[file.mimetype]) {
            cb(null, true);
        } else {
            cb(new Error('Unsupported file type. Allowed: JPG, PNG, MP4, PDF'));
        }
    },
});

// @route   POST /api/upload/media-handle
// @desc    Upload media to Meta via resumable upload, return header_handle
// @access  Private
router.post('/media-handle', auth, upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({ msg: 'No file uploaded' });
    }

    const { originalname, mimetype, buffer, size } = req.file;

    // Validate magic bytes
    const validation = validateMagicBytes(buffer, mimetype);
    if (!validation.valid) {
        return res.status(400).json({ msg: 'File content does not match its declared type. Upload rejected.' });
    }

    try {
        // Get user's WABA access token — use specific wabaId if provided
        const wabaQuery = { userId: req.user.id };
        if (req.body.wabaId) wabaQuery._id = req.body.wabaId;
        const wabaAccount = await WhatsAppBusinessAccount.findOne(wabaQuery);
        if (!wabaAccount || !wabaAccount.accessToken) {
            return res.status(400).json({ msg: 'No connected WhatsApp Business Account found.' });
        }

        const appId = process.env.META_APP_ID;
        if (!appId) {
            return res.status(500).json({ msg: 'Server misconfigured: META_APP_ID not set.' });
        }

        // Step 1: Create Meta upload session
        const sessionRes = await axios.post(
            `https://graph.facebook.com/v24.0/${appId}/uploads`,
            null,
            {
                params: {
                    file_length: size,
                    file_type: mimetype,
                    access_token: wabaAccount.accessToken,
                },
            }
        );
        const uploadSessionId = sessionRes.data.id;

        // Step 2: Upload file bytes to Meta
        const uploadRes = await axios.post(
            `https://graph.facebook.com/v24.0/${uploadSessionId}`,
            buffer,
            {
                headers: {
                    'Authorization': `OAuth ${wabaAccount.accessToken}`,
                    'file_offset': '0',
                    'Content-Type': mimetype,
                },
            }
        );

        const handle = uploadRes.data.h;

        res.json({
            handle,
            fileName: originalname,
            fileSize: size,
            mediaType: ALLOWED_TYPES[mimetype],
        });
    } catch (err) {
        console.error('Media upload error:', err.message);
        const metaMsg = err.response?.data?.error?.message;
        res.status(400).json({ msg: metaMsg || 'Failed to upload media to WhatsApp.' });
    }
});

module.exports = router;
