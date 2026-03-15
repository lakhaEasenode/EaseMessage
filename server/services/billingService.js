const Stripe = require('stripe');
const Razorpay = require('razorpay');
const crypto = require('crypto');
const Workspace = require('../models/Workspace');
const WorkspaceMember = require('../models/WorkspaceMember');
const User = require('../models/User');
const BillingPlan = require('../models/BillingPlan');
const WorkspaceBilling = require('../models/WorkspaceBilling');
const BillingInvoice = require('../models/BillingInvoice');
const IndiaBillingIntent = require('../models/IndiaBillingIntent');
const { BILLING_PLANS, getPlanConfig, getPriceConfig, getBillingCurrency } = require('../config/billingPlans');
const { sendBillingReminderEmail } = require('./emailService');
const { StripeInvoiceDocumentProvider, ZohoInvoiceDocumentProvider } = require('./invoiceDocumentProvider');
const { getFrontendBaseUrl } = require('../config/publicUrls');

const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'dummy_id',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'dummy_secret'
});

const stripeInvoiceProvider = new StripeInvoiceDocumentProvider();
const zohoInvoiceProvider = new ZohoInvoiceDocumentProvider();

const REMINDER_DAY_CODES = [
    { key: 'due_in_3', offsetDays: 3 },
    { key: 'due_in_1', offsetDays: 1 },
    { key: 'due_today', offsetDays: 0 },
    { key: 'overdue_3', offsetDays: -3 },
    { key: 'overdue_6', offsetDays: -6 }
];

const normalizePlanKey = (planName = 'Free') => BILLING_PLANS[planName]?.key || planName || 'Free';

const toDate = (unixSeconds) => unixSeconds ? new Date(unixSeconds * 1000) : null;

const getSubscriptionPeriodStart = (subscription) => (
    subscription?.current_period_start
    || subscription?.latest_invoice?.lines?.data?.[0]?.period?.start
    || subscription?.latest_invoice?.period_start
    || null
);

const getSubscriptionPeriodEnd = (subscription) => (
    subscription?.current_period_end
    || subscription?.latest_invoice?.lines?.data?.[0]?.period?.end
    || subscription?.latest_invoice?.period_end
    || null
);

const getSubscriptionBillingCycle = (subscription) => {
    const interval = subscription?.items?.data?.[0]?.price?.recurring?.interval;
    if (interval === 'year') {
        return 'yearly';
    }
    if (interval === 'month') {
        return 'monthly';
    }
    return subscription?.metadata?.billingCycle || 'monthly';
};

const getPlanKeyFromPriceId = async (priceId = '') => {
    if (!priceId) {
        return null;
    }

    const dbPlan = await BillingPlan.findOne({
        $or: [
            { 'prices.usd.monthly.stripePriceId': priceId },
            { 'prices.usd.yearly.stripePriceId': priceId },
            { 'prices.inr.monthly.stripePriceId': priceId },
            { 'prices.inr.yearly.stripePriceId': priceId }
        ]
    }).select('key');

    if (dbPlan?.key) {
        return dbPlan.key;
    }

    for (const plan of Object.values(BILLING_PLANS)) {
        const matches =
            plan.prices?.usd?.monthly?.priceId === priceId
            || plan.prices?.usd?.yearly?.priceId === priceId
            || plan.prices?.inr?.monthly?.priceId === priceId
            || plan.prices?.inr?.yearly?.priceId === priceId;

        if (matches) {
            return plan.key;
        }
    }

    return null;
};

const normalizeStatus = (status = '') => {
    if (!status) return 'inactive';
    if (status === 'trialing') return 'active';
    return status;
};

const getWorkspaceOwner = async (workspaceId) => {
    const membership = await WorkspaceMember.findOne({ workspaceId, role: 'owner', status: 'active' }).populate('userId');
    return membership?.userId || null;
};

const ensureWorkspaceBilling = async (workspace) => {
    const workspaceId = workspace._id || workspace;
    let billing = await WorkspaceBilling.findOne({ workspaceId });
    if (!billing) {
        const actualWorkspace = workspace._id ? workspace : await Workspace.findById(workspaceId);
        billing = await WorkspaceBilling.create({
            workspaceId,
            countryCode: actualWorkspace?.countryCode || '',
            currency: getBillingCurrency(actualWorkspace?.countryCode || ''),
            collectionMode: actualWorkspace?.countryCode === 'IN' ? 'manual_invoice' : 'autopay',
            plan: 'Free',
            status: 'inactive',
            contactLimit: 100
        });
    }
    return billing;
};

const serializePlan = (plan) => ({
    id: plan?._id?.toString?.() || null,
    key: plan.key,
    name: plan.name,
    description: plan.description || '',
    contactLimit: plan.contactLimit,
    features: plan.features || [],
    sortOrder: plan.sortOrder || 0,
    prices: plan.prices
});

const getBillingPlans = async () => {
    const plans = await BillingPlan.find({ isActive: true, isPublic: true }).sort({ sortOrder: 1, createdAt: 1 });
    if (plans.length > 0) {
        return plans.map(serializePlan);
    }

    return Object.values(BILLING_PLANS)
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((plan) => ({
            key: plan.key,
            name: plan.name,
            description: plan.description || '',
            contactLimit: plan.contactLimit,
            features: plan.features || [],
            sortOrder: plan.sortOrder || 0,
            prices: plan.prices
        }));
};

const getCatalogPlan = async (planName = 'Free') => {
    const normalizedKey = normalizePlanKey(planName);
    const dbPlan = await BillingPlan.findOne({ key: normalizedKey, isActive: true });
    if (dbPlan) {
        return dbPlan;
    }

    const fallback = BILLING_PLANS[normalizedKey] || BILLING_PLANS.Free;
    return fallback;
};

const getCatalogPriceConfig = async ({ planName, countryCode, billingCycle }) => {
    const plan = await getCatalogPlan(planName);
    const currency = getBillingCurrency(countryCode);
    const planKey = plan.key || plan.name || planName;
    const priceEntry = plan.prices?.[currency]?.[billingCycle];

    if (!priceEntry) {
        throw new Error(`No price configured for ${planKey} (${currency}/${billingCycle})`);
    }

    return {
        plan,
        currency,
        billingCycle,
        amount: priceEntry.amount,
        priceId: priceEntry.stripePriceId || priceEntry.priceId || ''
    };
};

const serializeBilling = (billing, latestInvoice = null) => ({
    id: billing?._id?.toString?.() || null,
    workspaceId: billing?.workspaceId?.toString?.() || billing?.workspaceId || null,
    stripeCustomerId: billing?.stripeCustomerId || '',
    stripeSubscriptionId: billing?.stripeSubscriptionId || '',
    countryCode: billing?.countryCode || '',
    currency: billing?.currency || 'usd',
    billingCycle: billing?.billingCycle || 'monthly',
    collectionMode: billing?.collectionMode || 'autopay',
    plan: billing?.plan || 'Free',
    status: billing?.status || 'inactive',
    contactLimit: billing?.contactLimit ?? 100,
    currentPeriodStart: billing?.currentPeriodStart || null,
    currentPeriodEnd: billing?.currentPeriodEnd || null,
    cancelAtPeriodEnd: Boolean(billing?.cancelAtPeriodEnd),
    graceEndsAt: billing?.graceEndsAt || null,
    lastInvoiceId: billing?.lastInvoiceId || '',
    lastInvoiceStatus: billing?.lastInvoiceStatus || '',
    isReadOnlyLocked: Boolean(billing?.isReadOnlyLocked),
    latestInvoice: latestInvoice ? serializeInvoice(latestInvoice) : null
});

const serializeInvoice = (invoice) => ({
    id: invoice?._id?.toString?.() || null,
    stripeInvoiceId: invoice?.stripeInvoiceId || '',
    stripeInvoiceNumber: invoice?.stripeInvoiceNumber || '',
    stripeSubscriptionId: invoice?.stripeSubscriptionId || '',
    amountDue: invoice?.amountDue ?? 0,
    amountPaid: invoice?.amountPaid ?? 0,
    currency: invoice?.currency || 'usd',
    dueDate: invoice?.dueDate || null,
    status: invoice?.status || 'draft',
    hostedInvoiceUrl: invoice?.hostedInvoiceUrl || '',
    invoicePdf: invoice?.invoicePdf || '',
    paymentLinkProvider: invoice?.paymentLinkProvider || 'none',
    razorpayPaymentLinkId: invoice?.razorpayPaymentLinkId || '',
    razorpayPaymentLinkUrl: invoice?.razorpayPaymentLinkUrl || '',
    razorpayPaymentStatus: invoice?.razorpayPaymentStatus || '',
    paidAt: invoice?.paidAt || null,
    paidOutOfBand: Boolean(invoice?.paidOutOfBand),
    zohoInvoiceId: invoice?.zohoInvoiceId || '',
    zohoInvoiceUrl: invoice?.zohoInvoiceUrl || '',
    customerInvoiceUrl: invoice?.zohoInvoiceUrl || stripeInvoiceProvider.getInvoiceLink(invoice) || zohoInvoiceProvider.getInvoiceLink(invoice)
});

const syncWorkspaceBillingFromStripeSubscription = async ({ workspaceId, subscription, planName, countryCode }) => {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
        throw new Error('Workspace not found');
    }

    const billing = await ensureWorkspaceBilling(workspace);
    const activePriceId = subscription?.items?.data?.[0]?.price?.id || '';
    const detectedPlan = await getPlanKeyFromPriceId(activePriceId) || planName || subscription?.metadata?.planName || billing.plan || 'Free';
    const planConfig = await getCatalogPlan(detectedPlan);
    const contactLimit = planConfig.contactLimit || getPlanConfig(detectedPlan).contactLimit;
    const invoiceId = typeof subscription.latest_invoice === 'string'
        ? subscription.latest_invoice
        : subscription.latest_invoice?.id || '';

    billing.countryCode = countryCode || workspace.countryCode || billing.countryCode;
    billing.currency = subscription.currency || getBillingCurrency(billing.countryCode);
    billing.collectionMode = subscription.collection_method === 'send_invoice' ? 'manual_invoice' : 'autopay';
    billing.billingCycle = getSubscriptionBillingCycle(subscription);
    billing.plan = detectedPlan;
    billing.status = normalizeStatus(subscription.status);
    billing.contactLimit = contactLimit;
    billing.stripeCustomerId = subscription.customer?.id || subscription.customer || billing.stripeCustomerId;
    billing.stripeSubscriptionId = subscription.id;
    billing.stripeSubscriptionItemId = subscription.items?.data?.[0]?.id || billing.stripeSubscriptionItemId;
    billing.currentPeriodStart = toDate(getSubscriptionPeriodStart(subscription));
    billing.currentPeriodEnd = toDate(getSubscriptionPeriodEnd(subscription));
    billing.cancelAtPeriodEnd = Boolean(subscription.cancel_at_period_end);
    billing.lastInvoiceId = invoiceId;
    if (billing.status === 'past_due' && !billing.graceEndsAt) {
        billing.graceEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
    if (billing.status === 'active') {
        billing.graceEndsAt = null;
        billing.isReadOnlyLocked = false;
    }
    await billing.save();

    return billing;
};

const upsertInvoiceFromStripe = async (workspaceId, stripeInvoice) => {
    const invoice = await BillingInvoice.findOneAndUpdate(
        { stripeInvoiceId: stripeInvoice.id },
        {
            workspaceId,
            stripeInvoiceNumber: stripeInvoice.number || '',
            stripeSubscriptionId: stripeInvoice.subscription?.id || stripeInvoice.subscription || '',
            amountDue: stripeInvoice.amount_due ?? 0,
            amountPaid: stripeInvoice.amount_paid ?? 0,
            currency: stripeInvoice.currency || 'usd',
            dueDate: toDate(stripeInvoice.due_date),
            status: stripeInvoice.status || 'draft',
            hostedInvoiceUrl: stripeInvoice.hosted_invoice_url || '',
            invoicePdf: stripeInvoice.invoice_pdf || '',
            metadata: stripeInvoice.metadata || {}
        },
        { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    const billing = await ensureWorkspaceBilling(workspaceId);
    billing.lastInvoiceId = stripeInvoice.id;
    billing.lastInvoiceStatus = stripeInvoice.status || '';
    if (stripeInvoice.status === 'open' || stripeInvoice.status === 'past_due') {
        billing.status = 'past_due';
        billing.graceEndsAt = billing.graceEndsAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    }
    if (stripeInvoice.status === 'paid') {
        billing.status = 'active';
        billing.graceEndsAt = null;
        billing.isReadOnlyLocked = false;
    }
    await billing.save();

    return invoice;
};

const getOrCreateStripeCustomer = async (workspaceId) => {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
        throw new Error('Workspace not found');
    }

    const billing = await ensureWorkspaceBilling(workspace);
    if (billing.stripeCustomerId) {
        return { workspace, billing, customerId: billing.stripeCustomerId };
    }

    const owner = await getWorkspaceOwner(workspaceId);
    const customer = await stripe.customers.create({
        name: workspace.companyName || workspace.name,
        email: owner?.email,
        metadata: {
            workspaceId: workspace._id.toString(),
            countryCode: workspace.countryCode || ''
        },
        address: {
            city: workspace.city || undefined,
            state: workspace.state || undefined,
            country: workspace.countryCode || undefined,
            postal_code: workspace.postalCode || undefined,
            line1: workspace.addressLine1 || undefined
        }
    });

    billing.stripeCustomerId = customer.id;
    billing.countryCode = workspace.countryCode || billing.countryCode;
    billing.currency = getBillingCurrency(workspace.countryCode || '');
    billing.collectionMode = workspace.countryCode === 'IN' ? 'manual_invoice' : 'autopay';
    await billing.save();

    return { workspace, billing, customerId: customer.id };
};

const createStripeCheckoutSession = async ({ workspaceId, planName, billingCycle, successUrl, cancelUrl }) => {
    const { workspace, billing, customerId } = await getOrCreateStripeCustomer(workspaceId);
    const price = await getCatalogPriceConfig({ planName, countryCode: workspace.countryCode, billingCycle });
    if (!price.priceId) {
        throw new Error(`Stripe price not configured for ${planName} (${price.currency}/${billingCycle})`);
    }

    const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        customer: customerId,
        line_items: [{ price: price.priceId, quantity: 1 }],
        success_url: successUrl,
        cancel_url: cancelUrl,
        client_reference_id: workspace._id.toString(),
        metadata: {
            workspaceId: workspace._id.toString(),
            planName,
            billingCycle,
            countryCode: workspace.countryCode || ''
        },
        subscription_data: {
            metadata: {
                workspaceId: workspace._id.toString(),
                planName,
                billingCycle,
                countryCode: workspace.countryCode || ''
            }
        }
    });

    billing.billingCycle = billingCycle;
    billing.collectionMode = 'autopay';
    billing.currency = price.currency;
    await billing.save();

    return session;
};

const createIndiaPaymentLinkForIntent = async ({ workspaceId, planName, billingCycle, action }) => {
    const { workspace, billing, customerId } = await getOrCreateStripeCustomer(workspaceId);
    const price = await getCatalogPriceConfig({ planName, countryCode: 'IN', billingCycle });
    const owner = await getWorkspaceOwner(workspaceId);
    let amount = Math.round(Number(price.amount) * 100);

    if (action === 'change_plan' && billing.stripeSubscriptionId) {
        const currentSubscription = await stripe.subscriptions.retrieve(billing.stripeSubscriptionId);
        const itemId = currentSubscription.items?.data?.[0]?.id || billing.stripeSubscriptionItemId;
        const upcomingInvoice = await stripe.invoices.retrieveUpcoming({
            customer: customerId,
            subscription: billing.stripeSubscriptionId,
            subscription_items: [{ id: itemId, price: price.priceId }],
            subscription_proration_behavior: 'always_invoice'
        });

        amount = Math.max(upcomingInvoice.amount_due ?? 0, 0);
    }

    if (action === 'change_plan' && amount === 0) {
        const result = await processIndiaIntentAfterPayment({
            intentId: (await IndiaBillingIntent.create({
                workspaceId,
                stripeCustomerId: customerId,
                stripeSubscriptionId: billing.stripeSubscriptionId || '',
                stripeSubscriptionItemId: billing.stripeSubscriptionItemId || '',
                action,
                planName,
                billingCycle,
                amount: 0,
                currency: 'inr',
                status: 'paid',
                razorpayPaymentStatus: 'paid'
            }))._id,
            razorpayPaymentId: ''
        });

        return {
            billing: await getWorkspaceBillingSummary(workspaceId),
            intent: result.intent,
            paymentUrl: ''
        };
    }

    const intent = await IndiaBillingIntent.create({
        workspaceId,
        stripeCustomerId: customerId,
        stripeSubscriptionId: billing.stripeSubscriptionId || '',
        stripeSubscriptionItemId: billing.stripeSubscriptionItemId || '',
        action,
        planName,
        billingCycle,
        amount,
        currency: 'inr'
    });

    const paymentLink = await razorpay.paymentLink.create({
        amount: intent.amount,
        currency: 'INR',
        accept_partial: false,
        description: `EaseMessage ${planName} (${billingCycle})`,
        customer: {
            name: workspace.companyName || workspace.name,
            email: owner?.email || undefined,
            contact: owner?.phoneNumber || undefined
        },
        notify: {
            sms: false,
            email: Boolean(owner?.email)
        },
        expire_by: Math.floor((Date.now() + 7 * 24 * 60 * 60 * 1000) / 1000),
        notes: {
            workspaceId: workspace._id.toString(),
            indiaBillingIntentId: intent._id.toString(),
            action,
            planName,
            billingCycle
        },
        callback_url: `${getFrontendBaseUrl()}/settings?tab=billing`,
        callback_method: 'get'
    });

    intent.razorpayPaymentLinkId = paymentLink.id;
    intent.razorpayPaymentLinkUrl = paymentLink.short_url || '';
    intent.razorpayPaymentStatus = paymentLink.status || 'created';
    await intent.save();

    billing.billingCycle = billingCycle;
    billing.collectionMode = 'manual_invoice';
    billing.currency = 'inr';
    billing.countryCode = 'IN';
    billing.status = billing.stripeSubscriptionId ? billing.status : 'inactive';
    await billing.save();

    return {
        billing: await getWorkspaceBillingSummary(workspaceId),
        intent,
        paymentUrl: intent.razorpayPaymentLinkUrl
    };
};

const createIndiaSubscription = async ({ workspaceId, planName, billingCycle }) => {
    return createIndiaPaymentLinkForIntent({
        workspaceId,
        planName,
        billingCycle,
        action: 'create_subscription'
    });
};

const createIndiaPlanChange = async ({ workspaceId, planName, billingCycle }) => {
    const billing = await ensureWorkspaceBilling(workspaceId);
    if (!billing.stripeSubscriptionId) {
        return createIndiaPaymentLinkForIntent({
            workspaceId,
            planName,
            billingCycle,
            action: 'create_subscription'
        });
    }

    return createIndiaPaymentLinkForIntent({
        workspaceId,
        planName,
        billingCycle,
        action: 'change_plan'
    });
};

const changeWorkspacePlan = async ({ workspaceId, planName, billingCycle }) => {
    const billing = await ensureWorkspaceBilling(workspaceId);
    if (!billing.stripeSubscriptionId) {
        throw new Error('No Stripe subscription found');
    }

    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
        throw new Error('Workspace not found');
    }

    if ((workspace.countryCode || '') === 'IN') {
        return createIndiaPlanChange({ workspaceId, planName, billingCycle });
    }

    const price = await getCatalogPriceConfig({
        planName,
        countryCode: workspace.countryCode || '',
        billingCycle
    });

    if (!price.priceId) {
        throw new Error(`Stripe price not configured for ${planName} (${price.currency}/${billingCycle})`);
    }

    const currentSubscription = await stripe.subscriptions.retrieve(billing.stripeSubscriptionId, {
        expand: ['latest_invoice']
    });
    const itemId = currentSubscription.items?.data?.[0]?.id;

    const subscription = await stripe.subscriptions.update(billing.stripeSubscriptionId, {
        cancel_at_period_end: false,
        proration_behavior: 'always_invoice',
        items: [{ id: itemId, price: price.priceId }],
        metadata: {
            ...(currentSubscription.metadata || {}),
            workspaceId: workspaceId.toString(),
            planName,
            billingCycle,
            countryCode: workspace.countryCode || ''
        },
        expand: ['latest_invoice']
    });

    const synced = await syncWorkspaceBillingFromStripeSubscription({
        workspaceId,
        subscription,
        planName,
        countryCode: workspace.countryCode || ''
    });

    if (subscription.latest_invoice?.id) {
        await upsertInvoiceFromStripe(workspaceId, subscription.latest_invoice);
    }

    return {
        subscription,
        billing: serializeBilling(synced, subscription.latest_invoice ? await BillingInvoice.findOne({ stripeInvoiceId: subscription.latest_invoice.id }) : null)
    };
};

const createPortalSession = async ({ workspaceId, returnUrl }) => {
    const billing = await ensureWorkspaceBilling(workspaceId);
    if (!billing.stripeCustomerId) {
        throw new Error('No Stripe customer found for this workspace');
    }

    return stripe.billingPortal.sessions.create({
        customer: billing.stripeCustomerId,
        return_url: returnUrl
    });
};

const cancelWorkspaceSubscription = async ({ workspaceId }) => {
    const billing = await ensureWorkspaceBilling(workspaceId);
    if (!billing.stripeSubscriptionId) {
        throw new Error('No Stripe subscription found');
    }

    const subscription = await stripe.subscriptions.update(billing.stripeSubscriptionId, {
        cancel_at_period_end: true
    });

    await syncWorkspaceBillingFromStripeSubscription({
        workspaceId,
        subscription,
        planName: billing.plan,
        countryCode: billing.countryCode
    });

    return subscription;
};

const resumeWorkspaceSubscription = async ({ workspaceId }) => {
    const billing = await ensureWorkspaceBilling(workspaceId);
    if (!billing.stripeSubscriptionId) {
        throw new Error('No Stripe subscription found');
    }

    const subscription = await stripe.subscriptions.update(billing.stripeSubscriptionId, {
        cancel_at_period_end: false
    });

    await syncWorkspaceBillingFromStripeSubscription({
        workspaceId,
        subscription,
        planName: billing.plan,
        countryCode: billing.countryCode
    });

    return subscription;
};

const createOrRefreshRazorpayPayLinkForInvoice = async ({ workspaceId, stripeInvoiceId }) => {
    const workspace = await Workspace.findById(workspaceId);
    if (!workspace) {
        throw new Error('Workspace not found');
    }

    const billing = await ensureWorkspaceBilling(workspaceId);
    if (billing.countryCode !== 'IN') {
        throw new Error('Razorpay payment links are only available for India workspaces');
    }

    let invoice = await BillingInvoice.findOne({ stripeInvoiceId, workspaceId });
    if (!invoice) {
        const stripeInvoice = await stripe.invoices.retrieve(stripeInvoiceId);
        invoice = await upsertInvoiceFromStripe(workspaceId, stripeInvoice);
    }

    if (invoice.status === 'paid') {
        return invoice;
    }

    const owner = await getWorkspaceOwner(workspaceId);
    const paymentLink = await razorpay.paymentLink.create({
        amount: invoice.amountDue,
        currency: (invoice.currency || 'inr').toUpperCase(),
        accept_partial: false,
        description: `EaseMessage invoice ${invoice.stripeInvoiceNumber || invoice.stripeInvoiceId}`,
        customer: {
            name: workspace.companyName || workspace.name,
            email: owner?.email || undefined,
            contact: owner?.phoneNumber || undefined
        },
        notify: {
            sms: false,
            email: Boolean(owner?.email)
        },
        expire_by: Math.floor((invoice.dueDate?.getTime?.() || (Date.now() + 7 * 24 * 60 * 60 * 1000)) / 1000),
        notes: {
            workspaceId: workspace._id.toString(),
            stripeInvoiceId,
            stripeSubscriptionId: invoice.stripeSubscriptionId || '',
            plan: billing.plan
        },
        callback_url: `${getFrontendBaseUrl()}/settings?tab=billing`,
        callback_method: 'get'
    });

    invoice.paymentLinkProvider = 'razorpay';
    invoice.razorpayPaymentLinkId = paymentLink.id;
    invoice.razorpayPaymentLinkUrl = paymentLink.short_url || paymentLink.short_url || '';
    invoice.razorpayPaymentStatus = paymentLink.status || 'created';
    invoice.lastPaymentLinkGeneratedAt = new Date();
    await invoice.save();

    return invoice;
};

const markInvoicePaidFromRazorpay = async ({ stripeInvoiceId, razorpayPaymentId }) => {
    if (!stripeInvoiceId) {
        return null;
    }

    const invoice = await BillingInvoice.findOne({ stripeInvoiceId });
    if (!invoice) {
        return null;
    }

    if (invoice.status === 'paid') {
        return invoice;
    }

    try {
        await stripe.invoices.pay(stripeInvoiceId, { paid_out_of_band: true });
    } catch (error) {
        if (error?.code !== 'invoice_already_paid') {
            throw error;
        }
    }

    invoice.status = 'paid';
    invoice.amountPaid = invoice.amountDue;
    invoice.paidAt = new Date();
    invoice.paidOutOfBand = true;
    invoice.razorpayPaymentId = razorpayPaymentId || invoice.razorpayPaymentId;
    invoice.razorpayPaymentStatus = 'paid';
    await invoice.save();

    const billing = await ensureWorkspaceBilling(invoice.workspaceId);
    billing.lastInvoiceId = invoice.stripeInvoiceId;
    billing.lastInvoiceStatus = 'paid';
    billing.status = 'active';
    billing.graceEndsAt = null;
    billing.isReadOnlyLocked = false;
    await billing.save();

    return invoice;
};

const processIndiaIntentAfterPayment = async ({ intentId, razorpayPaymentId }) => {
    const existingIntent = await IndiaBillingIntent.findById(intentId);
    if (!existingIntent) {
        throw new Error('India billing intent not found');
    }

    if (existingIntent.status === 'processed' || existingIntent.status === 'processing') {
        return existingIntent;
    }

    const intent = await IndiaBillingIntent.findOneAndUpdate(
        { _id: intentId, status: { $in: ['pending', 'paid'] } },
        {
            $set: {
                status: 'processing',
                razorpayPaymentId: razorpayPaymentId || existingIntent.razorpayPaymentId || '',
                razorpayPaymentStatus: 'paid'
            }
        },
        { new: true }
    );

    if (!intent) {
        return IndiaBillingIntent.findById(intentId);
    }

    const billing = await ensureWorkspaceBilling(intent.workspaceId);
    const price = await getCatalogPriceConfig({
        planName: intent.planName,
        countryCode: 'IN',
        billingCycle: intent.billingCycle
    });

    if (!price.priceId) {
        throw new Error(`Stripe price not configured for ${intent.planName} (inr/${intent.billingCycle})`);
    }

    let subscription;
    if (intent.action === 'change_plan' && billing.stripeSubscriptionId) {
        const currentSubscription = await stripe.subscriptions.retrieve(billing.stripeSubscriptionId);
        const itemId = currentSubscription.items?.data?.[0]?.id;
        subscription = await stripe.subscriptions.update(billing.stripeSubscriptionId, {
            collection_method: 'send_invoice',
            days_until_due: 7,
            cancel_at_period_end: false,
            proration_behavior: 'always_invoice',
            items: [{ id: itemId, price: price.priceId }],
            metadata: {
                ...(currentSubscription.metadata || {}),
                workspaceId: intent.workspaceId.toString(),
                planName: intent.planName,
                billingCycle: intent.billingCycle,
                countryCode: 'IN'
            },
            expand: ['latest_invoice']
        }, {
            idempotencyKey: `india-intent:${intent._id.toString()}:update`
        });
    } else {
        subscription = await stripe.subscriptions.create({
            customer: intent.stripeCustomerId,
            collection_method: 'send_invoice',
            days_until_due: 7,
            items: [{ price: price.priceId }],
            metadata: {
                workspaceId: intent.workspaceId.toString(),
                planName: intent.planName,
                billingCycle: intent.billingCycle,
                countryCode: 'IN'
            },
            expand: ['latest_invoice']
        }, {
            idempotencyKey: `india-intent:${intent._id.toString()}:create`
        });
    }

    const synced = await syncWorkspaceBillingFromStripeSubscription({
        workspaceId: intent.workspaceId,
        subscription,
        planName: intent.planName,
        countryCode: 'IN'
    });

    let invoice = null;
    if (subscription.latest_invoice?.id) {
        invoice = await upsertInvoiceFromStripe(intent.workspaceId, subscription.latest_invoice);
        await markInvoicePaidFromRazorpay({
            stripeInvoiceId: subscription.latest_invoice.id,
            razorpayPaymentId
        });
    }

    intent.status = 'processed';
    intent.processedAt = new Date();
    intent.razorpayPaymentId = razorpayPaymentId || intent.razorpayPaymentId;
    intent.razorpayPaymentStatus = 'paid';
    await intent.save();

    return { intent, billing: synced, invoice };
};

const getWorkspaceBillingSummary = async (workspaceId) => {
    let billing = await ensureWorkspaceBilling(workspaceId);
    if (billing.stripeSubscriptionId) {
        try {
            const subscription = await stripe.subscriptions.retrieve(billing.stripeSubscriptionId, {
                expand: ['latest_invoice']
            });
            billing = await syncWorkspaceBillingFromStripeSubscription({
                workspaceId,
                subscription,
                planName: billing.plan,
                countryCode: billing.countryCode
            });
            if (subscription.latest_invoice?.id) {
                await upsertInvoiceFromStripe(workspaceId, subscription.latest_invoice);
            }
        } catch (_error) {
            // Keep the saved billing snapshot if Stripe refresh is unavailable.
        }
    }
    const latestInvoice = await BillingInvoice.findOne({ workspaceId }).sort({ createdAt: -1 });
    return serializeBilling(billing, latestInvoice);
};

const listWorkspaceInvoices = async (workspaceId) => {
    const invoices = await BillingInvoice.find({ workspaceId }).sort({ createdAt: -1 }).limit(25);
    return invoices.map(serializeInvoice);
};

const handleStripeWebhook = async (event) => {
    switch (event.type) {
        case 'checkout.session.completed': {
            const session = event.data.object;
            if (!session.metadata?.workspaceId) break;
            if (session.subscription) {
                const subscription = await stripe.subscriptions.retrieve(session.subscription, { expand: ['latest_invoice'] });
                await syncWorkspaceBillingFromStripeSubscription({
                    workspaceId: session.metadata.workspaceId,
                    subscription,
                    planName: session.metadata.planName,
                    countryCode: session.metadata.countryCode
                });
                if (subscription.latest_invoice?.id) {
                    await upsertInvoiceFromStripe(session.metadata.workspaceId, subscription.latest_invoice);
                }
            }
            break;
        }
        case 'customer.subscription.created':
        case 'customer.subscription.updated':
        case 'customer.subscription.deleted': {
            const subscription = event.data.object;
            const workspaceId = subscription.metadata?.workspaceId;
            if (!workspaceId) break;
            await syncWorkspaceBillingFromStripeSubscription({
                workspaceId,
                subscription,
                planName: subscription.metadata?.planName,
                countryCode: subscription.metadata?.countryCode
            });
            break;
        }
        case 'invoice.created':
        case 'invoice.finalized':
        case 'invoice.updated':
        case 'invoice.payment_failed':
        case 'invoice.paid': {
            const stripeInvoice = event.data.object;
            const subscription = stripeInvoice.subscription
                ? await stripe.subscriptions.retrieve(stripeInvoice.subscription)
                : null;
            const workspaceId = stripeInvoice.metadata?.workspaceId || subscription?.metadata?.workspaceId;
            if (!workspaceId) break;
            const invoice = await upsertInvoiceFromStripe(workspaceId, stripeInvoice);

            const billing = await ensureWorkspaceBilling(workspaceId);
            if ((stripeInvoice.status === 'open' || stripeInvoice.status === 'draft') && billing.countryCode === 'IN' && (stripeInvoice.amount_due || 0) > 0) {
                await createOrRefreshRazorpayPayLinkForInvoice({ workspaceId, stripeInvoiceId: invoice.stripeInvoiceId });
            }

            if (stripeInvoice.status === 'paid') {
                billing.status = 'active';
                billing.graceEndsAt = null;
                billing.isReadOnlyLocked = false;
                await billing.save();
            } else if (stripeInvoice.status === 'open' || stripeInvoice.status === 'uncollectible') {
                billing.status = 'past_due';
                billing.graceEndsAt = billing.graceEndsAt || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
                await billing.save();
            }
            break;
        }
        default:
            break;
    }
};

const validateRazorpaySignature = (rawBody, signature) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'dummy_webhook_secret';
    const expectedSignature = crypto.createHmac('sha256', secret)
        .update(rawBody)
        .digest('hex');

    return expectedSignature === signature;
};

const handleRazorpayWebhook = async (payload) => {
    const eventName = payload.event;
    const entity = payload.payload?.payment_link?.entity || payload.payload?.payment?.entity || {};
    const notes = entity.notes || payload.payload?.payment_link?.entity?.notes || {};
    const stripeInvoiceId = notes.stripeInvoiceId;
    const indiaBillingIntentId = notes.indiaBillingIntentId;

    if (eventName === 'payment_link.paid' || eventName === 'payment.captured') {
        const razorpayPaymentId = payload.payload?.payment?.entity?.id || entity.payment_id || '';
        if (indiaBillingIntentId) {
            await processIndiaIntentAfterPayment({
                intentId: indiaBillingIntentId,
                razorpayPaymentId
            });
            return;
        }

        if (stripeInvoiceId) {
            await markInvoicePaidFromRazorpay({
                stripeInvoiceId,
                razorpayPaymentId
            });
        }
        return;
    }

    if (eventName === 'payment_link.expired' || eventName === 'payment.failed') {
        if (!indiaBillingIntentId && !stripeInvoiceId) {
            return;
        }

        if (indiaBillingIntentId) {
            const intent = await IndiaBillingIntent.findById(indiaBillingIntentId);
            if (intent) {
                intent.status = eventName === 'payment_link.expired' ? 'expired' : 'failed';
                intent.razorpayPaymentStatus = 'failed';
                await intent.save();
            }
        }
        const invoice = await BillingInvoice.findOne({ stripeInvoiceId });
        if (invoice) {
            invoice.razorpayPaymentStatus = 'failed';
            await invoice.save();
        }
    }
};

const computeReminderCode = (dueDate) => {
    if (!dueDate) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dueDate);
    target.setHours(0, 0, 0, 0);
    const diffDays = Math.round((target.getTime() - today.getTime()) / (24 * 60 * 60 * 1000));
    const match = REMINDER_DAY_CODES.find((item) => item.offsetDays === diffDays);
    return match?.key || null;
};

const runDailyBillingReconciliation = async () => {
    const billings = await WorkspaceBilling.find({ countryCode: 'IN', plan: { $ne: 'Free' } });

    for (const billing of billings) {
        const latestInvoice = await BillingInvoice.findOne({
            workspaceId: billing.workspaceId,
            status: { $in: ['draft', 'open', 'uncollectible'] }
        }).sort({ createdAt: -1 });

        if (latestInvoice && !latestInvoice.razorpayPaymentLinkUrl && latestInvoice.amountDue > 0) {
            await createOrRefreshRazorpayPayLinkForInvoice({
                workspaceId: billing.workspaceId,
                stripeInvoiceId: latestInvoice.stripeInvoiceId
            });
        }

        const reminderCode = latestInvoice ? computeReminderCode(latestInvoice.dueDate) : null;
        if (latestInvoice && reminderCode && billing.lastReminderCode !== reminderCode) {
            const owner = await getWorkspaceOwner(billing.workspaceId);
            if (owner?.email) {
                await sendBillingReminderEmail({
                    toEmail: owner.email,
                    workspaceName: owner.businessName || undefined,
                    reminderCode,
                    dueDate: latestInvoice.dueDate,
                    amountDue: latestInvoice.amountDue,
                    currency: latestInvoice.currency,
                    paymentUrl: latestInvoice.razorpayPaymentLinkUrl || latestInvoice.hostedInvoiceUrl
                });
            }
            billing.lastReminderCode = reminderCode;
            billing.lastReminderSentAt = new Date();
        }

        if (billing.graceEndsAt && billing.graceEndsAt < new Date() && billing.status !== 'active') {
            billing.isReadOnlyLocked = true;
            billing.status = 'read_only';
        }

        await billing.save();
    }
};

const backfillWorkspaceBillingFromUsers = async () => {
    const workspaces = await Workspace.find({});

    for (const workspace of workspaces) {
        const billing = await ensureWorkspaceBilling(workspace);
        const owner = await User.findById(workspace.ownerUserId);
        if (!owner) continue;

        if (billing.plan !== 'Free' || billing.stripeCustomerId || billing.stripeSubscriptionId) {
            continue;
        }

        const legacy = owner.subscription || {};
        billing.countryCode = workspace.countryCode || billing.countryCode;
        billing.currency = getBillingCurrency(workspace.countryCode || '');
        billing.collectionMode = workspace.countryCode === 'IN' ? 'manual_invoice' : 'autopay';
        billing.plan = legacy.plan || 'Free';
        billing.status = legacy.status || 'inactive';
        const planConfig = await getCatalogPlan(legacy.plan || 'Free');
        billing.contactLimit = legacy.contactLimit || planConfig.contactLimit || getPlanConfig(legacy.plan || 'Free').contactLimit;
        billing.stripeCustomerId = legacy.stripeCustomerId || '';
        billing.stripeSubscriptionId = legacy.stripeSubscriptionId || '';
        billing.currentPeriodEnd = legacy.currentPeriodEnd || null;
        await billing.save();
    }
};

const syncBillingPlansToStripe = async () => {
    if (!stripe) {
        console.warn('STRIPE_SECRET_KEY not set — skipping Stripe billing plan sync');
        return;
    }
    const catalog = Object.values(BILLING_PLANS);

    for (const definition of catalog) {
        const planDoc = await BillingPlan.findOneAndUpdate(
            { key: definition.key },
            {
                key: definition.key,
                name: definition.name,
                description: definition.description || '',
                contactLimit: definition.contactLimit,
                features: definition.features || [],
                sortOrder: definition.sortOrder || 0,
                isActive: true,
                isPublic: true
            },
            { new: true, upsert: true, setDefaultsOnInsert: true }
        );

        if (definition.key === 'Enterprise') {
            for (const currency of ['usd', 'inr']) {
                for (const billingCycle of ['monthly', 'yearly']) {
                    const configuredPrice = definition.prices[currency][billingCycle];
                    planDoc.set(`prices.${currency}.${billingCycle}`, {
                        amount: configuredPrice.amount,
                        stripeProductId: '',
                        stripePriceId: ''
                    });
                }
            }
            await planDoc.save();
            continue;
        }

        const canonicalProductName = `EaseMessage ${definition.name}`;
        const candidateProducts = await stripe.products.list({
            active: true,
            limit: 100
        });

        let canonicalProduct = candidateProducts.data.find((product) =>
            product.metadata?.planKey === definition.key
            && !product.metadata?.currency
            && !product.metadata?.billingCycle
        );

        if (!canonicalProduct) {
            canonicalProduct = await stripe.products.create({
                name: canonicalProductName,
                description: definition.description || `${definition.name} plan`,
                metadata: {
                    planKey: definition.key
                }
            });
        } else if (canonicalProduct.name !== canonicalProductName || canonicalProduct.description !== (definition.description || `${definition.name} plan`)) {
            canonicalProduct = await stripe.products.update(canonicalProduct.id, {
                name: canonicalProductName,
                description: definition.description || `${definition.name} plan`,
                metadata: {
                    ...canonicalProduct.metadata,
                    planKey: definition.key
                }
            });
        }

        for (const currency of ['usd', 'inr']) {
            for (const billingCycle of ['monthly', 'yearly']) {
                const configuredPrice = definition.prices[currency][billingCycle];
                const unitAmount = Number(configuredPrice.amount) * 100;
                if (unitAmount < 0) continue;

                const productId = canonicalProduct.id;
                let priceId = planDoc.prices?.[currency]?.[billingCycle]?.stripePriceId || '';

                let validPriceId = '';
                if (priceId) {
                    try {
                        const existingPrice = await stripe.prices.retrieve(priceId);
                        const interval = billingCycle === 'monthly' ? 'month' : 'year';
                        if (
                            existingPrice.product === productId
                            && existingPrice.unit_amount === unitAmount
                            && existingPrice.currency === currency
                            && existingPrice.recurring?.interval === interval
                        ) {
                            validPriceId = existingPrice.id;
                        }
                    } catch (err) {
                        validPriceId = '';
                    }
                }

                if (!validPriceId) {
                    const recurring = { interval: billingCycle === 'monthly' ? 'month' : 'year' };
                    const createdPrice = await stripe.prices.create({
                        currency,
                        unit_amount: unitAmount,
                        product: productId,
                        recurring,
                        metadata: {
                            planKey: definition.key,
                            currency,
                            billingCycle
                        }
                    });
                    validPriceId = createdPrice.id;
                }

                planDoc.set(`prices.${currency}.${billingCycle}`, {
                    amount: configuredPrice.amount,
                    stripeProductId: productId,
                    stripePriceId: validPriceId
                });
            }
        }

        await planDoc.save();

        const legacyProducts = candidateProducts.data.filter((product) =>
            product.id !== canonicalProduct.id
            && (
                (product.metadata?.planKey === definition.key)
                || product.name === canonicalProductName
                || product.name.startsWith(`${canonicalProductName} `)
            )
        );

        for (const legacyProduct of legacyProducts) {
            if (legacyProduct.active) {
                await stripe.products.update(legacyProduct.id, { active: false });
            }
        }
    }
};

module.exports = {
    stripe,
    getBillingPlans,
    ensureWorkspaceBilling,
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
    markInvoicePaidFromRazorpay,
    handleStripeWebhook,
    handleRazorpayWebhook,
    validateRazorpaySignature,
    runDailyBillingReconciliation,
    backfillWorkspaceBillingFromUsers,
    syncBillingPlansToStripe,
    processIndiaIntentAfterPayment,
    serializeBilling,
    serializeInvoice,
    getOrCreateStripeCustomer
};
