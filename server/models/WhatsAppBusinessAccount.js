const mongoose = require('mongoose');

const WhatsAppBusinessAccountSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    wabaId: {
        type: String,
        required: true,
        unique: true
    },
    name: {
        type: String,
        required: true
    },
    timezoneId: {
        type: String
    },
    messageTemplateNamespace: {
        type: String
    },
    accessToken: {
        type: String,
        required: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('WhatsAppBusinessAccount', WhatsAppBusinessAccountSchema);
