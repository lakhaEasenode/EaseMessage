const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected for migration'))
    .catch(err => console.error('MongoDB connection error:', err));

const Template = require('./models/Template');
const WhatsAppBusinessAccount = require('./models/WhatsAppBusinessAccount');

async function migrateTemplates() {
    try {
        console.log('Starting template migration...');

        // Find the WABA with wabaId '977626524563435'
        const waba = await WhatsAppBusinessAccount.findOne({ wabaId: '977626524563435' });

        if (!waba) {
            console.error('WABA with ID 977626524563435 not found!');
            console.log('Please check your database for the correct WABA ID.');
            process.exit(1);
        }

        console.log(`Found WABA: ${waba.name} (ObjectId: ${waba._id})`);

        // First, count templates that need migration
        const templatesToMigrate = await Template.find({}).lean();
        console.log(`Total templates found: ${templatesToMigrate.length}`);

        let migratedCount = 0;

        // Update templates one by one to handle different wabaId types
        for (const template of templatesToMigrate) {
            // Check if wabaId needs updating
            const needsUpdate = !template.wabaId ||
                template.wabaId.toString() !== waba._id.toString();

            if (needsUpdate) {
                await Template.findByIdAndUpdate(template._id, {
                    $set: { wabaId: waba._id }
                });
                migratedCount++;
            }
        }

        console.log(`Migration complete!`);
        console.log(`- Migrated: ${migratedCount} templates`);
        console.log(`- Already correct: ${templatesToMigrate.length - migratedCount} templates`);

        // Verify the migration
        const allTemplates = await Template.find().populate('wabaId', 'name wabaId');
        console.log(`\nTotal templates in database: ${allTemplates.length}`);
        console.log('Sample templates after migration:');
        allTemplates.slice(0, 3).forEach(t => {
            console.log(`- ${t.name} (WABA: ${t.wabaId?.name || 'Not populated'})`);
        });

        process.exit(0);
    } catch (error) {
        console.error('Migration error:', error);
        process.exit(1);
    }
}

migrateTemplates();
