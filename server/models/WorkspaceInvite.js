const mongoose = require('mongoose');

const WorkspaceInviteSchema = new mongoose.Schema({
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    token: { type: String, required: true, unique: true, index: true },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
    status: { type: String, enum: ['pending', 'accepted', 'revoked'], default: 'pending' },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    expiresAt: { type: Date, required: true },
    createdAt: { type: Date, default: Date.now }
});

WorkspaceInviteSchema.index({ workspaceId: 1, email: 1, status: 1 });

module.exports = mongoose.model('WorkspaceInvite', WorkspaceInviteSchema);
