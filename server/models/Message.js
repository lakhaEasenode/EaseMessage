const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    contact: { type: mongoose.Schema.Types.ObjectId, ref: 'Contact' },
    content: { type: String },
    type: { type: String, enum: ['text', 'image', 'video', 'document', 'template'], default: 'text' },
    direction: { type: String, enum: ['inbound', 'outbound'], required: true },
    status: { type: String, enum: ['sent', 'delivered', 'read', 'failed'], default: 'sent' },
    timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Message', MessageSchema);
