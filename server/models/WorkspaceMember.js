const mongoose = require('mongoose');

const WorkspaceMemberSchema = new mongoose.Schema({
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['owner', 'admin', 'member'], default: 'member' },
    status: { type: String, enum: ['active', 'invited'], default: 'active' },
    createdAt: { type: Date, default: Date.now }
});

WorkspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });

module.exports = mongoose.model('WorkspaceMember', WorkspaceMemberSchema);
