const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

require('../models/BillingPlan');
require('../models/Workspace');
require('../models/WorkspaceBilling');
require('../models/BillingInvoice');

const { syncBillingPlansToStripe } = require('../services/billingService');

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {});
        await syncBillingPlansToStripe();
        console.log('Billing plans synced to Stripe and MongoDB');
        process.exit(0);
    } catch (err) {
        console.error('Failed to sync billing plans:', err);
        process.exit(1);
    }
};

run();
