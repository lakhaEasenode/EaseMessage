// Script to add sample data for Lists and Contacts
require('dotenv').config();
const mongoose = require('mongoose');
const Contact = require('./models/Contact');
const List = require('./models/List');
const User = require('./models/User');

async function addSampleData() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✓ MongoDB connected\n');

        // Get the first user from the database (or use your test user)
        const user = await User.findOne({ email: 'test@test.com' });
        if (!user) {
            console.log('❌ No user found. Please create a user first.');
            process.exit(1);
        }
        console.log(`✓ Using user: ${user.email} (ID: ${user._id})\n`);

        // Clear existing data for this user
        await Contact.deleteMany({ userId: user._id });
        await List.deleteMany({ userId: user._id });
        console.log('✓ Cleared existing data\n');

        // Create Lists
        console.log('--- Creating Lists ---');
        const lists = await List.insertMany([
            {
                name: 'VIP Customers',
                description: 'High-value customers with premium service',
                userId: user._id
            },
            {
                name: 'Newsletter Subscribers',
                description: 'Users subscribed to weekly newsletter',
                userId: user._id
            },
            {
                name: 'Product Launch',
                description: 'Contacts interested in new product launches',
                userId: user._id
            },
            {
                name: 'Support Tickets',
                description: 'Customers who have opened support tickets',
                userId: user._id
            }
        ]);
        console.log(`✓ Created ${lists.length} lists:`);
        lists.forEach(list => console.log(`  - ${list.name}`));

        // Create Contacts
        console.log('\n--- Creating Contacts ---');
        const contacts = await Contact.insertMany([
            {
                userId: user._id,
                firstName: 'Sarah',
                lastName: 'Johnson',
                countryCode: '+1',
                phoneNumber: '5551234567',
                email: 'sarah.johnson@example.com',
                tags: ['vip', 'premium'],
                optedIn: true,
                optInSource: 'manual',
                optInDate: new Date()
            },
            {
                userId: user._id,
                firstName: 'Michael',
                lastName: 'Chen',
                countryCode: '+1',
                phoneNumber: '5559876543',
                email: 'michael.chen@example.com',
                tags: ['newsletter', 'tech'],
                optedIn: true,
                optInSource: 'csv',
                optInDate: new Date()
            },
            {
                userId: user._id,
                firstName: 'Emily',
                lastName: 'Rodriguez',
                countryCode: '+44',
                phoneNumber: '7700900123',
                email: 'emily.rodriguez@example.com',
                tags: ['vip', 'international'],
                optedIn: true,
                optInSource: 'manual',
                optInDate: new Date()
            },
            {
                userId: user._id,
                firstName: 'David',
                lastName: 'Kim',
                countryCode: '+1',
                phoneNumber: '5555551234',
                email: 'david.kim@example.com',
                tags: ['support', 'active'],
                optedIn: true,
                optInSource: 'manual',
                optInDate: new Date()
            },
            {
                userId: user._id,
                firstName: 'Priya',
                lastName: 'Patel',
                countryCode: '+91',
                phoneNumber: '9876543210',
                email: 'priya.patel@example.com',
                tags: ['newsletter', 'product-launch'],
                optedIn: true,
                optInSource: 'csv',
                optInDate: new Date()
            },
            {
                userId: user._id,
                firstName: 'James',
                lastName: 'Wilson',
                countryCode: '+1',
                phoneNumber: '5554443333',
                email: 'james.wilson@example.com',
                tags: ['vip', 'enterprise'],
                optedIn: true,
                optInSource: 'api',
                optInDate: new Date()
            },
            {
                userId: user._id,
                firstName: 'Lisa',
                lastName: 'Anderson',
                countryCode: '+1',
                phoneNumber: '5552221111',
                email: 'lisa.anderson@example.com',
                tags: ['newsletter'],
                optedIn: true,
                optInSource: 'manual',
                optInDate: new Date()
            },
            {
                userId: user._id,
                firstName: 'Ahmed',
                lastName: 'Hassan',
                countryCode: '+971',
                phoneNumber: '501234567',
                email: 'ahmed.hassan@example.com',
                tags: ['product-launch', 'international'],
                optedIn: true,
                optInSource: 'manual',
                optInDate: new Date()
            }
        ]);
        console.log(`✓ Created ${contacts.length} contacts:`);
        contacts.forEach(contact => console.log(`  - ${contact.fullName} (${contact.countryCode} ${contact.phoneNumber})`));

        // Assign contacts to multiple lists
        console.log('\n--- Assigning Contacts to Lists ---');

        // VIP Customers: Sarah, Emily, James
        const vipList = lists.find(l => l.name === 'VIP Customers');
        const vipContacts = [contacts[0], contacts[2], contacts[5]]; // Sarah, Emily, James
        for (const contact of vipContacts) {
            await vipList.addContact(contact._id);
            await contact.addToList(vipList._id);
        }
        console.log(`✓ Added ${vipContacts.length} contacts to "VIP Customers"`);

        // Newsletter Subscribers: Michael, Priya, Lisa
        const newsletterList = lists.find(l => l.name === 'Newsletter Subscribers');
        const newsletterContacts = [contacts[1], contacts[4], contacts[6]]; // Michael, Priya, Lisa
        for (const contact of newsletterContacts) {
            await newsletterList.addContact(contact._id);
            await contact.addToList(newsletterList._id);
        }
        console.log(`✓ Added ${newsletterContacts.length} contacts to "Newsletter Subscribers"`);

        // Product Launch: Priya, Ahmed, Sarah (Sarah is in multiple lists!)
        const productList = lists.find(l => l.name === 'Product Launch');
        const productContacts = [contacts[4], contacts[7], contacts[0]]; // Priya, Ahmed, Sarah
        for (const contact of productContacts) {
            await productList.addContact(contact._id);
            await contact.addToList(productList._id);
        }
        console.log(`✓ Added ${productContacts.length} contacts to "Product Launch"`);

        // Support Tickets: David, Emily (Emily is in multiple lists!)
        const supportList = lists.find(l => l.name === 'Support Tickets');
        const supportContacts = [contacts[3], contacts[2]]; // David, Emily
        for (const contact of supportContacts) {
            await supportList.addContact(contact._id);
            await contact.addToList(supportList._id);
        }
        console.log(`✓ Added ${supportContacts.length} contacts to "Support Tickets"`);

        // Display summary
        console.log('\n--- Summary ---');
        const allLists = await List.find({ userId: user._id });
        for (const list of allLists) {
            console.log(`\n${list.name} (${list.contactCount} contacts):`);
            const listContacts = await Contact.find({ _id: { $in: list.contacts } });
            listContacts.forEach(c => console.log(`  - ${c.fullName}`));
        }

        console.log('\n--- Contacts in Multiple Lists ---');
        const allContacts = await Contact.find({ userId: user._id });
        const multiListContacts = allContacts.filter(c => c.lists.length > 1);
        console.log(`Found ${multiListContacts.length} contacts in multiple lists:`);
        for (const contact of multiListContacts) {
            const contactLists = await List.find({ _id: { $in: contact.lists } });
            console.log(`\n${contact.fullName}:`);
            contactLists.forEach(l => console.log(`  - ${l.name}`));
        }

        console.log('\n✅ Sample data added successfully!');
        process.exit(0);
    } catch (err) {
        console.error('❌ Error:', err.message);
        console.error(err);
        process.exit(1);
    }
}

addSampleData();
