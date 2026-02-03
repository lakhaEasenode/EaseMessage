// Test script to verify List and Contact models
require('dotenv').config();
const mongoose = require('mongoose');
const Contact = require('./models/Contact');
const List = require('./models/List');

async function testModels() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✓ MongoDB connected');

        // Create a test user ID (you can replace with actual user ID from your DB)
        const testUserId = new mongoose.Types.ObjectId();
        console.log(`\n✓ Using test user ID: ${testUserId}`);

        // 1. Create a List
        console.log('\n--- Testing List Model ---');
        const list = new List({
            name: 'VIP Customers',
            description: 'High-value customers',
            userId: testUserId
        });
        await list.save();
        console.log('✓ Created list:', list.name);

        // 2. Create a Contact
        console.log('\n--- Testing Contact Model ---');
        const contact = new Contact({
            userId: testUserId,
            firstName: 'John',
            lastName: 'Doe',
            countryCode: '+1',
            phoneNumber: '5551234567',
            email: 'john@example.com',
            optedIn: true,
            optInSource: 'manual',
            optInDate: new Date()
        });
        await contact.save();
        console.log('✓ Created contact:', contact.fullName);

        // 3. Add contact to list
        console.log('\n--- Testing Relationships ---');
        await list.addContact(contact._id);
        await contact.addToList(list._id);
        console.log('✓ Added contact to list');

        // 4. Verify relationships
        const updatedList = await List.findById(list._id);
        const updatedContact = await Contact.findById(contact._id);
        console.log(`✓ List now has ${updatedList.contactCount} contact(s)`);
        console.log(`✓ Contact belongs to ${updatedContact.lists.length} list(s)`);

        // 5. Test queries
        console.log('\n--- Testing Queries ---');
        const activeLists = await List.findActive({ userId: testUserId });
        console.log(`✓ Found ${activeLists.length} active list(s)`);

        const activeContacts = await Contact.findActive({ userId: testUserId, optedIn: true });
        console.log(`✓ Found ${activeContacts.length} opted-in contact(s)`);

        // 6. Test soft delete
        console.log('\n--- Testing Soft Delete ---');
        await contact.softDelete();
        const deletedContact = await Contact.findById(contact._id);
        console.log(`✓ Contact soft deleted: ${deletedContact.isDeleted}`);

        const activeContactsAfterDelete = await Contact.findActive({ userId: testUserId });
        console.log(`✓ Active contacts after delete: ${activeContactsAfterDelete.length}`);

        // Cleanup
        console.log('\n--- Cleanup ---');
        await Contact.deleteMany({ userId: testUserId });
        await List.deleteMany({ userId: testUserId });
        console.log('✓ Test data cleaned up');

        console.log('\n✅ All tests passed!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        process.exit(1);
    }
}

testModels();
