const mongoose = require('mongoose');

const CampaignSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true },
    phoneNumberId: { type: mongoose.Schema.Types.ObjectId, ref: 'WhatsAppPhoneNumber', required: true },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Template', required: true },
    listId: { type: mongoose.Schema.Types.ObjectId, ref: 'List', required: true },
    status: {
        type: String,
        enum: ['draft', 'scheduled', 'running', 'completed', 'failed'],
        default: 'draft'
    },
    scheduledAt: { type: Date },
    sendingInterval: { type: Number, default: 0 }, // Gap between messages in seconds
    stats: {
        sent: { type: Number, default: 0 },
        delivered: { type: Number, default: 0 },
        read: { type: Number, default: 0 },
        failed: { type: Number, default: 0 }
    },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

CampaignSchema.index({ user: 1 });
CampaignSchema.index({ status: 1, scheduledAt: 1 });

module.exports = mongoose.model('Campaign', CampaignSchema);
