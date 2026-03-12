const mongoose = require('mongoose');

const WorkspaceSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 80 },
    companyName: { type: String, trim: true, maxlength: 120, default: '' },
    addressLine1: { type: String, trim: true, maxlength: 160, default: '' },
    city: { type: String, trim: true, maxlength: 80, default: '' },
    state: { type: String, trim: true, maxlength: 80, default: '' },
    countryCode: { type: String, trim: true, maxlength: 8, default: '' },
    postalCode: { type: String, trim: true, maxlength: 20, default: '' },
    taxId: { type: String, trim: true, maxlength: 40, default: '' },
    ownerUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Workspace', WorkspaceSchema);
