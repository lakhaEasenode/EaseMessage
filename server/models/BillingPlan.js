const mongoose = require('mongoose');

const PriceEntrySchema = new mongoose.Schema({
    amount: { type: Number, required: true },
    stripeProductId: { type: String, default: '' },
    stripePriceId: { type: String, default: '' }
}, { _id: false });

const BillingPlanSchema = new mongoose.Schema({
    key: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: '' },
    contactLimit: { type: Number, default: 100 },
    features: { type: [String], default: [] },
    sortOrder: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    isPublic: { type: Boolean, default: true },
    prices: {
        usd: {
            monthly: { type: PriceEntrySchema, required: true },
            yearly: { type: PriceEntrySchema, required: true }
        },
        inr: {
            monthly: { type: PriceEntrySchema, required: true },
            yearly: { type: PriceEntrySchema, required: true }
        }
    }
}, { timestamps: true });

module.exports = mongoose.model('BillingPlan', BillingPlanSchema);
