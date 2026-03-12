const mongoose = require('mongoose');
const dotenv = require('dotenv');
const { runDailyBillingReconciliation } = require('../services/billingService');

dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {});
        await runDailyBillingReconciliation();
        console.log('Daily billing reconciliation completed');
        process.exit(0);
    } catch (err) {
        console.error('Daily billing reconciliation failed:', err);
        process.exit(1);
    }
};

run();
