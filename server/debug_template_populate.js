const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(async () => {
        console.log('MongoDB connected for debugging');

        const Template = require('./models/Template');
        const WhatsAppBusinessAccount = require('./models/WhatsAppBusinessAccount');

        console.log('--- Checking Templates ---');
        const templates = await Template.find({}).limit(5);

        for (const t of templates) {
            console.log(`\nTemplate: ${t.name} (${t._id})`);
            console.log(`wabaId Value:`, t.wabaId);
            console.log(`wabaId Type:`, typeof t.wabaId);
            console.log(`Constructor:`, t.wabaId ? t.wabaId.constructor.name : 'N/A');

            // Try explicit populate
            const populated = await Template.findById(t._id).populate('wabaId');
            console.log(`Populated wabaId:`, populated.wabaId);

            if (!populated.wabaId) {
                console.log('!!! POPULATE FAILED !!!');
                // manual check
                if (t.wabaId) {
                    const waba = await WhatsAppBusinessAccount.findById(t.wabaId);
                    console.log('Manual lookup found:', waba ? waba.name : 'NOT FOUND');
                }
            }
        }

        process.exit(0);
    })
    .catch(err => {
        console.error('Debug error:', err);
        process.exit(1);
    });
