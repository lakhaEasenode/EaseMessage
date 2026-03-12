const express = require('express');
const crypto = require('crypto');
const geoip = require('geoip-lite');
const auth = require('../middleware/auth');
const Workspace = require('../models/Workspace');
const WorkspaceInvite = require('../models/WorkspaceInvite');
const WorkspaceMember = require('../models/WorkspaceMember');
const User = require('../models/User');
const { buildAuthUserPayload, getWorkspaceContextForUser, serializeWorkspace } = require('../utils/workspace');
const { sendWorkspaceInvite } = require('../services/emailService');
const { ensureWorkspaceBilling } = require('../services/billingService');
const { getBillingCurrency } = require('../config/billingPlans');

const router = express.Router();

const canManageWorkspace = (role) => ['owner', 'admin'].includes(role);
const INVITE_EXPIRY_DAYS = 7;
const TIMEZONE_FALLBACKS = {
    'Asia/Kolkata': 'IN',
    'Asia/Calcutta': 'IN',
    'America/New_York': 'US',
    'America/Chicago': 'US',
    'America/Denver': 'US',
    'America/Los_Angeles': 'US',
    'Europe/London': 'GB',
    'Europe/Paris': 'FR',
    'Asia/Dubai': 'AE',
    'Asia/Singapore': 'SG',
    'Australia/Sydney': 'AU'
};

const getCurrentMembership = async (userId) => {
    const context = await getWorkspaceContextForUser(userId);
    if (!context?.activeMembership?.workspaceId) {
        return null;
    }

    return context.activeMembership;
};

const getRequestIp = (req) => {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded) {
        return forwarded.split(',')[0].trim();
    }
    return req.ip;
};

const detectCountryCode = (req) => {
    const requestIp = getRequestIp(req);
    const lookup = requestIp ? geoip.lookup(requestIp) : null;
    if (lookup?.country) {
        return { countryCode: lookup.country, source: 'ip' };
    }

    const timezone = req.headers['x-timezone'];
    if (timezone && TIMEZONE_FALLBACKS[timezone]) {
        return { countryCode: TIMEZONE_FALLBACKS[timezone], source: 'timezone' };
    }

    return { countryCode: 'IN', source: 'default' };
};

router.get('/', auth, async (req, res) => {
    try {
        const payload = await buildAuthUserPayload(req.user.id);
        res.json({
            currentWorkspace: payload.currentWorkspace,
            workspaces: payload.workspaces
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.put('/switch', auth, async (req, res) => {
    try {
        const { workspaceId } = req.body;
        if (!workspaceId) {
            return res.status(400).json({ msg: 'Workspace is required' });
        }

        const membership = await WorkspaceMember.findOne({
            workspaceId,
            userId: req.user.id,
            status: 'active'
        }).populate('workspaceId');

        if (!membership?.workspaceId) {
            return res.status(404).json({ msg: 'Workspace not found' });
        }

        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        user.activeWorkspaceId = membership.workspaceId._id;
        await user.save();

        const payload = await buildAuthUserPayload(req.user.id, membership.workspaceId._id);
        res.json({
            msg: 'Workspace switched successfully',
            currentWorkspace: payload.currentWorkspace,
            workspaces: payload.workspaces
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/current', auth, async (req, res) => {
    try {
        const membership = await getCurrentMembership(req.user.id);
        if (!membership) {
            return res.status(404).json({ msg: 'Workspace not found' });
        }

        const pendingInvites = await WorkspaceInvite.countDocuments({
            workspaceId: membership.workspaceId._id,
            status: 'pending'
        });

        res.json({
            workspace: {
                ...serializeWorkspace(membership.workspaceId),
                role: membership.role,
                pendingInvites
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/detect-country', auth, async (req, res) => {
    try {
        const suggestion = detectCountryCode(req);
        res.json(suggestion);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.put('/current', auth, async (req, res) => {
    try {
        const membership = await getCurrentMembership(req.user.id);
        if (!membership) {
            return res.status(404).json({ msg: 'Workspace not found' });
        }

        if (!canManageWorkspace(membership.role)) {
            return res.status(403).json({ msg: 'You do not have permission to update this workspace' });
        }

        const updates = {};
        if (typeof req.body.name === 'string' && req.body.name.trim()) {
            updates.name = req.body.name.trim();
        }
        if (typeof req.body.companyName === 'string') {
            updates.companyName = req.body.companyName.trim();
        }
        if (typeof req.body.addressLine1 === 'string') {
            updates.addressLine1 = req.body.addressLine1.trim();
        }
        if (typeof req.body.city === 'string') {
            updates.city = req.body.city.trim();
        }
        if (typeof req.body.state === 'string') {
            updates.state = req.body.state.trim();
        }
        if (typeof req.body.countryCode === 'string') {
            updates.countryCode = req.body.countryCode.trim().toUpperCase();
        }
        if (typeof req.body.postalCode === 'string') {
            updates.postalCode = req.body.postalCode.trim();
        }
        if (typeof req.body.taxId === 'string') {
            updates.taxId = req.body.taxId.trim();
        }

        const workspace = await Workspace.findByIdAndUpdate(
            membership.workspaceId._id,
            { $set: updates },
            { new: true }
        );

        if (Object.prototype.hasOwnProperty.call(updates, 'countryCode')) {
            const billing = await ensureWorkspaceBilling(workspace);
            billing.countryCode = workspace.countryCode || '';
            billing.currency = getBillingCurrency(workspace.countryCode || '');
            billing.collectionMode = workspace.countryCode === 'IN' ? 'manual_invoice' : 'autopay';
            await billing.save();
        }

        const payload = await buildAuthUserPayload(req.user.id, workspace._id);

        res.json({
            msg: 'Workspace updated successfully',
            workspace: {
                ...serializeWorkspace(workspace),
                role: membership.role
            },
            currentWorkspace: payload.currentWorkspace,
            workspaces: payload.workspaces
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/current/members', auth, async (req, res) => {
    try {
        const membership = await getCurrentMembership(req.user.id);
        if (!membership) {
            return res.status(404).json({ msg: 'Workspace not found' });
        }

        const members = await WorkspaceMember.find({
            workspaceId: membership.workspaceId._id,
            status: 'active'
        }).populate('userId', 'firstName email');

        res.json({
            members: members.map((member) => ({
                id: member._id.toString(),
                role: member.role,
                status: member.status,
                joinedAt: member.createdAt,
                user: member.userId ? {
                    id: member.userId._id.toString(),
                    firstName: member.userId.firstName,
                    email: member.userId.email
                } : null
            }))
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/current/invitations', auth, async (req, res) => {
    try {
        const membership = await getCurrentMembership(req.user.id);
        if (!membership) {
            return res.status(404).json({ msg: 'Workspace not found' });
        }

        const invitations = await WorkspaceInvite.find({
            workspaceId: membership.workspaceId._id,
            status: 'pending'
        }).sort({ createdAt: -1 });

        res.json({
            invitations: invitations.map((invite) => ({
                id: invite._id.toString(),
                email: invite.email,
                role: invite.role,
                status: invite.status,
                createdAt: invite.createdAt
            }))
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.post('/current/invitations', auth, async (req, res) => {
    try {
        const membership = await getCurrentMembership(req.user.id);
        if (!membership) {
            return res.status(404).json({ msg: 'Workspace not found' });
        }

        if (!canManageWorkspace(membership.role)) {
            return res.status(403).json({ msg: 'You do not have permission to invite members' });
        }

        const email = req.body.email?.trim()?.toLowerCase();
        const role = req.body.role === 'admin' ? 'admin' : 'member';

        if (!email) {
            return res.status(400).json({ msg: 'Email is required' });
        }

        const existingUser = await User.findOne({ email }).select('_id');
        if (existingUser) {
            const existingMember = await WorkspaceMember.findOne({
                workspaceId: membership.workspaceId._id,
                userId: existingUser._id,
                status: 'active'
            });

            if (existingMember) {
                return res.status(400).json({ msg: 'This user is already a member of the workspace' });
            }
        }

        const existingInvite = await WorkspaceInvite.findOne({
            workspaceId: membership.workspaceId._id,
            email,
            status: 'pending'
        });

        if (existingInvite) {
            return res.status(400).json({ msg: 'An invitation is already pending for this email' });
        }

        const invitation = await WorkspaceInvite.create({
            workspaceId: membership.workspaceId._id,
            email,
            token: crypto.randomBytes(24).toString('hex'),
            role,
            invitedBy: req.user.id,
            expiresAt: new Date(Date.now() + INVITE_EXPIRY_DAYS * 24 * 60 * 60 * 1000)
        });

        const clientUrl = process.env.CLIENT_URL || 'http://localhost:3300';
        const acceptUrl = `${clientUrl}/accept-invite?token=${invitation.token}`;

        try {
            const inviter = await User.findById(req.user.id).select('firstName');
            await sendWorkspaceInvite({
                toEmail: invitation.email,
                inviterName: inviter?.firstName || 'A teammate',
                workspaceName: membership.workspaceId.name,
                acceptUrl
            });
        } catch (emailErr) {
            await WorkspaceInvite.findByIdAndDelete(invitation._id);
            console.error(emailErr.message);
            return res.status(500).json({ msg: 'Failed to send invitation email' });
        }

        res.status(201).json({
            msg: 'Invitation created successfully',
            invitation: {
                id: invitation._id.toString(),
                email: invitation.email,
                role: invitation.role,
                status: invitation.status,
                expiresAt: invitation.expiresAt,
                createdAt: invitation.createdAt
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.get('/invitations/:token', async (req, res) => {
    try {
        const invitation = await WorkspaceInvite.findOne({
            token: req.params.token,
            status: 'pending',
            expiresAt: { $gt: new Date() }
        }).populate('workspaceId', 'name companyName');

        if (!invitation?.workspaceId) {
            return res.status(404).json({ msg: 'Invitation not found or expired' });
        }

        res.json({
            invitation: {
                email: invitation.email,
                role: invitation.role,
                expiresAt: invitation.expiresAt,
                workspace: {
                    id: invitation.workspaceId._id.toString(),
                    name: invitation.workspaceId.name,
                    companyName: invitation.workspaceId.companyName || ''
                }
            }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.post('/invitations/:token/accept', auth, async (req, res) => {
    try {
        const invitation = await WorkspaceInvite.findOne({
            token: req.params.token,
            status: 'pending',
            expiresAt: { $gt: new Date() }
        }).populate('workspaceId');

        if (!invitation?.workspaceId) {
            return res.status(404).json({ msg: 'Invitation not found or expired' });
        }

        const user = await User.findById(req.user.id).select('email activeWorkspaceId');
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }

        if (user.email.toLowerCase() !== invitation.email.toLowerCase()) {
            return res.status(403).json({ msg: 'Please log in with the invited email address to accept this invitation' });
        }

        const existingMember = await WorkspaceMember.findOne({
            workspaceId: invitation.workspaceId._id,
            userId: req.user.id,
            status: 'active'
        });

        if (!existingMember) {
            await WorkspaceMember.create({
                workspaceId: invitation.workspaceId._id,
                userId: req.user.id,
                role: invitation.role,
                status: 'active'
            });
        }

        invitation.status = 'accepted';
        await invitation.save();

        user.activeWorkspaceId = invitation.workspaceId._id;
        await user.save();

        const payload = await buildAuthUserPayload(req.user.id);
        res.json({
            msg: 'Invitation accepted successfully',
            user: payload
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ msg: 'Server error' });
    }
});

module.exports = router;
