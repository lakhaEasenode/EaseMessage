const mongoose = require('mongoose');

const WorkspaceBillingSchema = new mongoose.Schema({
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, unique: true, index: true },
    stripeCustomerId: { type: String, default: '' },
    stripeSubscriptionId: { type: String, default: '' },
    stripeSubscriptionItemId: { type: String, default: '' },
    stripeDefaultPaymentMethodId: { type: String, default: '' },
    countryCode: { type: String, default: '' },
    currency: { type: String, enum: ['usd', 'inr'], default: 'usd' },
    billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    collectionMode: { type: String, enum: ['autopay', 'manual_invoice'], default: 'autopay' },
    plan: { type: String, enum: ['Free', 'Starter', 'Growth', 'Pro', 'Enterprise'], default: 'Free' },
    status: { type: String, default: 'inactive' },
    contactLimit: { type: Number, default: 100 },
    currentPeriodStart: { type: Date, default: null },
    currentPeriodEnd: { type: Date, default: null },
    cancelAtPeriodEnd: { type: Boolean, default: false },
    graceEndsAt: { type: Date, default: null },
    lastInvoiceId: { type: String, default: '' },
    lastInvoiceStatus: { type: String, default: '' },
    lastReminderSentAt: { type: Date, default: null },
    lastReminderCode: { type: String, default: '' },
    zohoCustomerId: { type: String, default: '' },
    isReadOnlyLocked: { type: Boolean, default: false },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

module.exports = mongoose.model('WorkspaceBilling', WorkspaceBillingSchema);
