const mongoose = require('mongoose');

const TemplateSchema = new mongoose.Schema({
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
    template_id: {
        type: String
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    category: {
        type: String,
        enum: ['UTILITY', 'MARKETING', 'AUTHENTICATION'],
        required: true
    },
    language: {
        type: String,
        required: true,
        default: 'en_US'
    },
    body: {
        type: String,
        required: true
    },
    variables: [{
        type: String
    }],
    status: {
        type: String,
        enum: ['APPROVED', 'PENDING', 'REJECTED', 'PAUSED', 'DISABLED'],
        default: 'PENDING'
    },
    components: {
        type: Array,
        default: []
    },
    parameter_format: {
        type: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update timestamp on save
TemplateSchema.pre('save', function (next) {
    this.updatedAt = Date.now();
    next();
});

module.exports = mongoose.model('Template', TemplateSchema);
