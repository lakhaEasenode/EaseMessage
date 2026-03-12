const { ensureWorkspaceBilling } = require('../services/billingService');

const getWorkspaceId = (req) => req.workspace?._id?.toString?.() || req.workspace?.toString?.();

const attachBilling = async (req, _res, next) => {
    try {
        const workspaceId = getWorkspaceId(req);
        if (!workspaceId) {
            return next();
        }
        req.workspaceBilling = await ensureWorkspaceBilling(workspaceId);
        next();
    } catch (err) {
        next(err);
    }
};

const requireBillingWriteAccess = async (req, res, next) => {
    try {
        const workspaceId = getWorkspaceId(req);
        if (!workspaceId) {
            return next();
        }

        const billing = await ensureWorkspaceBilling(workspaceId);
        req.workspaceBilling = billing;

        if (billing.isReadOnlyLocked || billing.status === 'read_only') {
            return res.status(402).json({
                msg: 'Billing is overdue for this workspace. Paid actions are disabled until the invoice is cleared.',
                code: 'BILLING_READ_ONLY'
            });
        }

        next();
    } catch (err) {
        console.error('Billing access middleware error:', err.message);
        res.status(500).json({ msg: 'Failed to validate billing access' });
    }
};

module.exports = {
    attachBilling,
    requireBillingWriteAccess
};
