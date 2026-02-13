const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
    campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign', index: true },
    wamid: { type: String, index: true },
    content: { type: String },
    type: { type: String, enum: ['text', 'image', 'video', 'document', 'template'], default: 'text' },
    direction: { type: String, enum: ['inbound', 'outbound'], required: true },
    status: { type: String, enum: ['pending', 'sent', 'delivered', 'read', 'failed'], default: 'sent' },
    errorCode: { type: Number },
    errorMessage: { type: String },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', MessageSchema);
