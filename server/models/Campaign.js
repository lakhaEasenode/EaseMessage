const mongoose = require('mongoose');

const CampaignSchema = new mongoose.Schema({
    name: { type: String, required: true },
    templateName: { type: String, required: true },
    templateVariables: { type: Map, of: String },
    contacts: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Contact' }],
    scheduledAt: { type: Date },
    status: { type: String, enum: ['draft', 'scheduled', 'sent', 'failed'], default: 'draft' },
    stats: {
        sent: { type: Number, default: 0 },
        delivered: { type: Number, default: 0 },
        read: { type: Number, default: 0 }
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Campaign', CampaignSchema);
