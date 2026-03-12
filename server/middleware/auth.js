const jwt = require('jsonwebtoken');
const { getWorkspaceContextForUser } = require('../utils/workspace');

module.exports = async function (req, res, next) {
    // Get token from header
    const token = req.header('x-auth-token');

    // Check if not token
    if (!token) {
        return res.status(401).json({ msg: 'No token, authorization denied' });
    }

    // Verify token
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded.user;
        req.scopeUserId = decoded.user.id;

        const preferredWorkspaceId = req.header('x-workspace-id');
        const workspaceContext = await getWorkspaceContextForUser(decoded.user.id, preferredWorkspaceId);

        if (workspaceContext?.activeMembership?.workspaceId) {
            req.workspace = workspaceContext.activeMembership.workspaceId;
            req.membership = workspaceContext.activeMembership;
            req.scopeUserId = workspaceContext.activeMembership.workspaceId.ownerUserId?.toString?.() || decoded.user.id;
        }

        next();
    } catch (err) {
        res.status(401).json({ msg: 'Token is not valid' });
    }
};
