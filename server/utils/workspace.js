const Workspace = require('../models/Workspace');
const WorkspaceInvite = require('../models/WorkspaceInvite');
const WorkspaceMember = require('../models/WorkspaceMember');
const User = require('../models/User');
const { getWorkspaceBillingSummary } = require('../services/billingService');

const DEFAULT_ROLE = 'owner';

const serializeWorkspace = (workspace) => ({
    id: workspace._id.toString(),
    name: workspace.name,
    companyName: workspace.companyName || '',
    addressLine1: workspace.addressLine1 || '',
    city: workspace.city || '',
    state: workspace.state || '',
    countryCode: workspace.countryCode || '',
    postalCode: workspace.postalCode || '',
    taxId: workspace.taxId || '',
    ownerUserId: workspace.ownerUserId?.toString?.() || workspace.ownerUserId,
    createdAt: workspace.createdAt
});

const serializeMembership = (membership, workspace) => ({
    id: membership._id.toString(),
    role: membership.role,
    status: membership.status,
    workspace: serializeWorkspace(workspace)
});

const ensureDefaultWorkspaceForUser = async (user) => {
    const existingMembership = await WorkspaceMember.findOne({ userId: user._id, status: 'active' })
        .sort({ createdAt: 1 })
        .populate('workspaceId');

    if (existingMembership?.workspaceId) {
        if (!user.activeWorkspaceId || user.activeWorkspaceId.toString() !== existingMembership.workspaceId._id.toString()) {
            user.activeWorkspaceId = existingMembership.workspaceId._id;
            await user.save();
        }

        return existingMembership.workspaceId;
    }

    const workspace = await Workspace.create({
        name: user.firstName,
        companyName: user.businessName || '',
        ownerUserId: user._id,
        createdBy: user._id
    });

    await WorkspaceMember.create({
        workspaceId: workspace._id,
        userId: user._id,
        role: DEFAULT_ROLE,
        status: 'active'
    });

    user.activeWorkspaceId = workspace._id;
    await user.save();

    return workspace;
};

const backfillExistingUsersWithWorkspace = async () => {
    const users = await User.find({
        $or: [
            { activeWorkspaceId: null },
            { activeWorkspaceId: { $exists: false } }
        ]
    });

    for (const user of users) {
        await ensureDefaultWorkspaceForUser(user);
    }
};

const getWorkspaceContextForUser = async (userId, preferredWorkspaceId = null) => {
    const user = await User.findById(userId);
    if (!user) {
        return null;
    }

    await ensureDefaultWorkspaceForUser(user);

    const memberships = await WorkspaceMember.find({ userId, status: 'active' })
        .sort({ createdAt: 1 })
        .populate('workspaceId');

    const validMemberships = memberships.filter((membership) => membership.workspaceId);

    let activeMembership = validMemberships.find((membership) => (
        preferredWorkspaceId && membership.workspaceId._id.toString() === preferredWorkspaceId.toString()
    ));

    if (!activeMembership) {
        activeMembership = validMemberships.find((membership) => (
            user.activeWorkspaceId && membership.workspaceId._id.toString() === user.activeWorkspaceId.toString()
        )) || validMemberships[0];
    }

    if (activeMembership && (!user.activeWorkspaceId || user.activeWorkspaceId.toString() !== activeMembership.workspaceId._id.toString())) {
        user.activeWorkspaceId = activeMembership.workspaceId._id;
        await user.save();
    }

    return {
        user,
        activeMembership,
        workspaces: validMemberships.map((membership) => serializeMembership(membership, membership.workspaceId))
    };
};

const buildAuthUserPayload = async (userId, preferredWorkspaceId = null) => {
    const context = await getWorkspaceContextForUser(userId, preferredWorkspaceId);
    if (!context) {
        return null;
    }

    const pendingInvites = context.activeMembership
        ? await WorkspaceInvite.countDocuments({ workspaceId: context.activeMembership.workspaceId._id, status: 'pending' })
        : 0;
    const billing = context.activeMembership
        ? await getWorkspaceBillingSummary(context.activeMembership.workspaceId._id)
        : null;

    return {
        id: context.user.id,
        firstName: context.user.firstName,
        businessName: context.user.businessName,
        email: context.user.email,
        subscription: context.user.subscription,
        billing,
        activeWorkspaceId: context.activeMembership?.workspaceId?._id?.toString?.() || null,
        currentWorkspace: context.activeMembership ? {
            ...serializeWorkspace(context.activeMembership.workspaceId),
            role: context.activeMembership.role,
            pendingInvites,
            billing
        } : null,
        workspaces: context.workspaces
    };
};

module.exports = {
    backfillExistingUsersWithWorkspace,
    buildAuthUserPayload,
    ensureDefaultWorkspaceForUser,
    getWorkspaceContextForUser,
    serializeWorkspace
};
