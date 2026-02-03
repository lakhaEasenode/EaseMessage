// Final Migration script to ensure data consistency
require('dotenv').config();
const mongoose = require('mongoose');
const Contact = require('./models/Contact');
const List = require('./models/List');

const USER_ID = '698125c7dfedb3d22f10761a'; // test@test.com user ID

async function migrateData() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✓ MongoDB connected\n');

        // 1. Update userId for all records
        console.log('--- Updating User IDs ---');
        await Contact.updateMany({ userId: { $exists: false } }, { $set: { userId: USER_ID } });
        await List.updateMany({ userId: { $exists: false } }, { $set: { userId: USER_ID } });
        console.log('✓ User IDs updated successfully');

        // 2. Fix names for old contacts (name -> firstName/lastName)
        console.log('\n--- Fixing Contact Names ---');
        // We need to find contacts that might have been created with the old schema which had 'name'
        // Mongoose doesn't show fields not in schema in find() results unless we use .lean() or access ._doc
        const allContacts = await Contact.find({ userId: USER_ID });
        let updatedCount = 0;

        for (const contact of allContacts) {
            // Check if firstName is missing/invalid but name exists on the raw document
            const rawDoc = await mongoose.connection.db.collection('contacts').findOne({ _id: contact._id });

            if ((!contact.firstName || contact.firstName === 'undefined') && rawDoc.name) {
                const parts = rawDoc.name.split(' ');
                const firstName = parts[0] || 'Unknown';
                const lastName = parts.slice(1).join(' ') || '';

                await Contact.updateOne(
                    { _id: contact._id },
                    {
                        $set: { firstName, lastName },
                        $unset: { name: 1 } // Remove the old field
                    }
                );
                updatedCount++;
            }
        }
        console.log(`✓ Updated ${updatedCount} contacts with proper firstName/lastName`);

        // 3. Ensure all contacts have optedIn: true (standard for this module)
        console.log('\n--- Ensuring Opt-In Status ---');
        const optInResult = await Contact.updateMany(
            { userId: USER_ID, optedIn: { $ne: true } },
            { $set: { optedIn: true, optInSource: 'manual', optInDate: new Date() } }
        );
        console.log(`✓ Updated ${optInResult.modifiedCount} contacts to optedIn: true`);

        // 4. Verification
        const finalContacts = await Contact.find({ userId: USER_ID });
        console.log('\n--- Final Verification ---');
        console.log(`Total Contacts: ${finalContacts.length}`);
        console.log('Sample Contacts:');
        for (let i = 0; i < Math.min(3, finalContacts.length); i++) {
            const c = finalContacts[i];
            console.log(`  - ${c.firstName} ${c.lastName || ''} (${c.phoneNumber})`);
        }

        console.log('\n✅ Data consistency migration completed!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error during migration:', err);
        process.exit(1);
    }
}

migrateData();
