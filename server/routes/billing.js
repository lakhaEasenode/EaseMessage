const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Workspace = require('../models/Workspace');
const User = require('../models/User');
const BillingInvoice = require('../models/BillingInvoice');
const { sendEnterprisePlanRequest } = require('../services/emailService');
const {
    stripe,
    getBillingPlans,
    getWorkspaceBillingSummary,
    listWorkspaceInvoices,
    createStripeCheckoutSession,
    changeWorkspacePlan,
    createIndiaSubscription,
    createIndiaPlanChange,
    createPortalSession,
    cancelWorkspaceSubscription,
    resumeWorkspaceSubscription,
    createOrRefreshRazorpayPayLinkForInvoice,
    handleStripeWebhook,
    handleRazorpayWebhook,
    validateRazorpaySignature,
    runDailyBillingReconciliation
} = require('../services/billingService');
const { getWebhookUrls, getApiBaseUrl, getFrontendBaseUrl } = require('../config/publicUrls');

const getWorkspaceId = (req) => req.workspace?._id?.toString?.() || req.workspace?.toString?.();
const getErrorMessage = (err, fallback) => err?.error?.description || err?.raw?.message || err?.message || fallback;

router.get('/current', auth, async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        const billing = await getWorkspaceBillingSummary(workspaceId);
        res.json({ billing });
    } catch (err) {
        console.error('Billing current error:', err.message);
        res.status(500).json({ msg: 'Failed to load billing' });
    }
});

router.get('/plans', auth, async (_req, res) => {
    try {
        const plans = await getBillingPlans();
        res.json({ plans });
    } catch (err) {
        console.error('Billing plans error:', err.message);
        res.status(500).json({ msg: 'Failed to load billing plans' });
    }
});

router.get('/invoices', auth, async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        const invoices = await listWorkspaceInvoices(workspaceId);
        res.json({ invoices });
    } catch (err) {
        console.error('Billing invoices error:', err.message);
        res.status(500).json({ msg: 'Failed to load invoices' });
    }
});

router.get('/webhook-config', auth, async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        const workspace = await Workspace.findById(workspaceId).select('countryCode name');
        const webhookUrls = getWebhookUrls();

        res.json({
            publicApiUrl: getApiBaseUrl(),
            webhookUrls,
            workspace: workspace ? {
                id: workspace._id.toString(),
                name: workspace.name,
                countryCode: workspace.countryCode || ''
            } : null,
            stripe: {
                signingSecretEnv: 'STRIPE_WEBHOOK_SECRET',
                url: webhookUrls.stripe,
                events: [
                    'checkout.session.completed',
                    'customer.subscription.created',
                    'customer.subscription.updated',
                    'customer.subscription.deleted',
                    'invoice.created',
                    'invoice.finalized',
                    'invoice.updated',
                    'invoice.payment_failed',
                    'invoice.paid'
                ]
            },
            razorpay: {
                signingSecretEnv: 'RAZORPAY_WEBHOOK_SECRET',
                url: webhookUrls.razorpay,
                events: [
                    'payment_link.paid',
                    'payment_link.expired',
                    'payment.failed',
                    'payment.captured'
                ]
            }
        });
    } catch (err) {
        console.error('Webhook config error:', err.message);
        res.status(500).json({ msg: 'Failed to load webhook configuration' });
    }
});

router.post('/checkout/stripe-subscription', auth, async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        const workspace = await Workspace.findById(workspaceId);
        if (!workspace) {
            return res.status(404).json({ msg: 'Workspace not found' });
        }

        const { planName, billingCycle } = req.body;
        const frontendUrl = getFrontendBaseUrl();

        if ((workspace.countryCode || '') === 'IN') {
            const result = await createIndiaSubscription({ workspaceId, planName, billingCycle });
            return res.json({
                billing: result.billing,
                intentId: result.intent?._id?.toString?.() || null,
                paymentUrl: result.paymentUrl || result.intent?.razorpayPaymentLinkUrl || '',
                mode: 'manual_invoice'
            });
        }

        const session = await createStripeCheckoutSession({
            workspaceId,
            planName,
            billingCycle,
            successUrl: `${frontendUrl}/pricing?success=true&session_id={CHECKOUT_SESSION_ID}`,
            cancelUrl: `${frontendUrl}/pricing?canceled=true`
        });

        res.json({ url: session.url, mode: 'autopay' });
    } catch (err) {
        console.error('Billing checkout error:', err);
        res.status(500).json({ msg: getErrorMessage(err, 'Failed to create subscription checkout') });
    }
});

router.post('/change-plan', auth, async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        const result = await changeWorkspacePlan({
            workspaceId,
            planName: req.body.planName,
            billingCycle: req.body.billingCycle
        });

        res.json(result);
    } catch (err) {
        console.error('Billing change-plan error:', err.message);
        res.status(400).json({ msg: getErrorMessage(err, 'Failed to change plan') });
    }
});

router.post('/enterprise-request', auth, async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        const workspace = await Workspace.findById(workspaceId).select('name companyName');
        const requester = await User.findById(req.user.id).select('firstName email');

        if (!workspace) {
            return res.status(404).json({ msg: 'Workspace not found' });
        }

        await sendEnterprisePlanRequest({
            adminEmail: process.env.ENTERPRISE_REQUEST_EMAIL || 'lakhendra@easexpense.com',
            requesterName: requester?.firstName || 'EaseMessage user',
            requesterEmail: requester?.email || '',
            workspaceName: workspace.name,
            companyName: workspace.companyName || '',
            note: req.body?.note || ''
        });

        res.json({ msg: 'Enterprise request sent successfully' });
    } catch (err) {
        console.error('Enterprise request error:', err.message);
        res.status(500).json({ msg: 'Failed to send enterprise request' });
    }
});

router.post('/portal-session', auth, async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        const frontendUrl = getFrontendBaseUrl();
        const session = await createPortalSession({
            workspaceId,
            returnUrl: `${frontendUrl}/settings?tab=billing`
        });
        res.json({ url: session.url });
    } catch (err) {
        console.error('Billing portal error:', err.message);
        res.status(400).json({ msg: err.message || 'Failed to open billing portal' });
    }
});

router.post('/india/pay-link', auth, async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        const { stripeInvoiceId } = req.body;
        const invoice = await createOrRefreshRazorpayPayLinkForInvoice({ workspaceId, stripeInvoiceId });
        res.json({ invoice });
    } catch (err) {
        console.error('India pay-link error:', err.message);
        res.status(400).json({ msg: getErrorMessage(err, 'Failed to create payment link') });
    }
});

router.post('/india/change-plan', auth, async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        const result = await createIndiaPlanChange({
            workspaceId,
            planName: req.body.planName,
            billingCycle: req.body.billingCycle
        });
        res.json({
            billing: result.billing,
            intentId: result.intent?._id?.toString?.() || null,
            paymentUrl: result.paymentUrl || result.intent?.razorpayPaymentLinkUrl || ''
        });
    } catch (err) {
        console.error('India change-plan error:', err.message);
        res.status(400).json({ msg: getErrorMessage(err, 'Failed to change plan') });
    }
});

router.post('/cancel', auth, async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        const subscription = await cancelWorkspaceSubscription({ workspaceId });
        res.json({ subscription });
    } catch (err) {
        console.error('Billing cancel error:', err.message);
        res.status(400).json({ msg: err.message || 'Failed to cancel subscription' });
    }
});

router.post('/resume', auth, async (req, res) => {
    try {
        const workspaceId = getWorkspaceId(req);
        const subscription = await resumeWorkspaceSubscription({ workspaceId });
        res.json({ subscription });
    } catch (err) {
        console.error('Billing resume error:', err.message);
        res.status(400).json({ msg: err.message || 'Failed to resume subscription' });
    }
});

router.post('/run-daily-sync', auth, async (req, res) => {
    try {
        if (req.membership?.role !== 'owner') {
            return res.status(403).json({ msg: 'Only workspace owners can run billing sync' });
        }
        await runDailyBillingReconciliation();
        res.json({ msg: 'Billing reconciliation completed' });
    } catch (err) {
        console.error('Billing sync error:', err.message);
        res.status(500).json({ msg: 'Billing reconciliation failed' });
    }
});

router.post('/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
    const signature = req.headers['stripe-signature'];
    let event;

    try {
        event = stripe.webhooks.constructEvent(req.body, signature, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    try {
        await handleStripeWebhook(event);
        res.send();
    } catch (err) {
        console.error('Stripe webhook processing error:', err);
        res.status(500).send('Webhook handler error');
    }
});

router.post('/webhooks/razorpay', express.raw({ type: 'application/json' }), async (req, res) => {
    const signature = req.headers['x-razorpay-signature'];
    if (!validateRazorpaySignature(req.body, signature)) {
        console.error('Razorpay webhook signature mismatch', {
            hasSignature: Boolean(signature),
            bodyLength: req.body?.length || 0
        });
        return res.status(400).send('Invalid signature');
    }

    try {
        await handleRazorpayWebhook(JSON.parse(req.body.toString('utf8')));
        res.json({ status: 'ok' });
    } catch (err) {
        console.error('Razorpay webhook error:', err.message);
        res.status(500).send('Webhook handler error');
    }
});

module.exports = router;
