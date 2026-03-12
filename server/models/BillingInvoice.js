const mongoose = require('mongoose');

const BillingInvoiceSchema = new mongoose.Schema({
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true, index: true },
    stripeInvoiceId: { type: String, required: true, unique: true, index: true },
    stripeInvoiceNumber: { type: String, default: '' },
    stripeSubscriptionId: { type: String, default: '' },
    amountDue: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    currency: { type: String, default: 'usd' },
    dueDate: { type: Date, default: null },
    status: { type: String, default: 'draft' },
    hostedInvoiceUrl: { type: String, default: '' },
    invoicePdf: { type: String, default: '' },
    paymentLinkProvider: { type: String, enum: ['razorpay', 'stripe', 'none'], default: 'none' },
    razorpayPaymentLinkId: { type: String, default: '' },
    razorpayPaymentLinkUrl: { type: String, default: '' },
    razorpayPaymentId: { type: String, default: '' },
    razorpayPaymentStatus: { type: String, default: '' },
    lastPaymentLinkGeneratedAt: { type: Date, default: null },
    paidAt: { type: Date, default: null },
    paidOutOfBand: { type: Boolean, default: false },
    zohoInvoiceId: { type: String, default: '' },
    zohoInvoiceUrl: { type: String, default: '' },
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

module.exports = mongoose.model('BillingInvoice', BillingInvoiceSchema);
