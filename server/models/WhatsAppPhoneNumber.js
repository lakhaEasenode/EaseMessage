const mongoose = require('mongoose');

const WhatsAppPhoneNumberSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    wabaId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'WhatsAppBusinessAccount',
        required: true
    },
    phoneNumberId: {
        type: String,
        required: true,
        unique: true
    },
    verifiedName: {
        type: String
    },
    displayPhoneNumber: {
        type: String
    },
    codeVerificationStatus: {
        type: String
    },
    qualityRating: {
        type: String
    },
    platformType: {
        type: String
    },
    throughput: {
        type: mongoose.Schema.Types.Mixed
    },
    isDefault: {
        type: Boolean,
        default: false
    },
    metaData: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    lastSyncedAt: {
        type: Date
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('WhatsAppPhoneNumber', WhatsAppPhoneNumberSchema);
