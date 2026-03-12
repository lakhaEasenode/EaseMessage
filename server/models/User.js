const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    firstName: { type: String, required: true },
    businessName: { type: String },
    activeWorkspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', default: null },
    isVerified: { type: Boolean, default: false },
    subscription: {
        plan: { type: String, enum: ['Free', 'Starter', 'Growth', 'Pro', 'Enterprise'], default: 'Free' },
        status: { type: String, default: 'active' }, // active, canceled, past_due, etc.
        contactLimit: { type: Number, default: 100 },
        gateway: { type: String, enum: ['stripe', 'razorpay', 'none'], default: 'none' },
        stripeCustomerId: { type: String },
        razorpayCustomerId: { type: String },
        stripeSubscriptionId: { type: String },
        razorpaySubscriptionId: { type: String },
        currentPeriodEnd: { type: Date }
    },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('User', UserSchema);
