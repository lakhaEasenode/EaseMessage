// Migration script to add userId to all existing lists and contacts
require('dotenv').config();
const mongoose = require('mongoose');
const Contact = require('./models/Contact');
const List = require('./models/List');

const USER_ID = '698125c7dfedb3d22f10761a'; // test@test.com user ID

async function migrateData() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✓ MongoDB connected\n');

        // Update all contacts without userId
        console.log('--- Updating Contacts ---');
        const contactsWithoutUser = await Contact.find({ userId: { $exists: false } });
        console.log(`Found ${contactsWithoutUser.length} contacts without userId`);

        if (contactsWithoutUser.length > 0) {
            const contactResult = await Contact.updateMany(
                { userId: { $exists: false } },
                { $set: { userId: USER_ID } }
            );
            console.log(`✓ Updated ${contactResult.modifiedCount} contacts with userId: ${USER_ID}`);
        }

        // Update all lists without userId
        console.log('\n--- Updating Lists ---');
        const listsWithoutUser = await List.find({ userId: { $exists: false } });
        console.log(`Found ${listsWithoutUser.length} lists without userId`);

        if (listsWithoutUser.length > 0) {
            const listResult = await List.updateMany(
                { userId: { $exists: false } },
                { $set: { userId: USER_ID } }
            );
            console.log(`✓ Updated ${listResult.modifiedCount} lists with userId: ${USER_ID}`);
        }

        // Verify the updates
        console.log('\n--- Verification ---');
        const totalContacts = await Contact.countDocuments({ userId: USER_ID });
        const totalLists = await List.countDocuments({ userId: USER_ID });

        console.log(`✓ Total contacts with userId: ${totalContacts}`);
        console.log(`✓ Total lists with userId: ${totalLists}`);

        // Show sample data
        console.log('\n--- Sample Data ---');
        const sampleContacts = await Contact.find({ userId: USER_ID }).limit(3);
        console.log('Sample contacts:');
        sampleContacts.forEach(c => {
            console.log(`  - ${c.firstName} ${c.lastName || ''} (${c.phoneNumber}) - userId: ${c.userId}`);
        });

        const sampleLists = await List.find({ userId: USER_ID }).limit(3);
        console.log('\nSample lists:');
        sampleLists.forEach(l => {
            console.log(`  - ${l.name} (${l.contactCount} contacts) - userId: ${l.userId}`);
        });

        console.log('\n✅ Migration completed successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        console.error(err);
        process.exit(1);
    }
}

migrateData();
