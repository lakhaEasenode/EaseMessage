const mongoose = require('mongoose');

const IndiaBillingIntentSchema = new mongoose.Schema({
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    stripeCustomerId: { type: String, default: '' },
    stripeSubscriptionId: { type: String, default: '' },
    stripeSubscriptionItemId: { type: String, default: '' },
    action: { type: String, enum: ['create_subscription', 'change_plan'], required: true },
    planName: { type: String, enum: ['Free', 'Starter', 'Growth', 'Pro', 'Enterprise'], required: true },
    billingCycle: { type: String, enum: ['monthly', 'yearly'], required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'inr' },
    status: { type: String, enum: ['pending', 'processing', 'paid', 'failed', 'processed', 'expired'], default: 'pending', index: true },
    razorpayPaymentLinkId: { type: String, default: '', unique: true, sparse: true, index: true },
    razorpayPaymentLinkUrl: { type: String, default: '' },
    razorpayPaymentId: { type: String, default: '' },
    razorpayPaymentStatus: { type: String, default: '' },
    processedAt: { type: Date, default: null },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

module.exports = mongoose.model('IndiaBillingIntent', IndiaBillingIntentSchema);
