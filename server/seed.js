const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('./models/User');
const Contact = require('./models/Contact');
const Campaign = require('./models/Campaign');
const Message = require('./models/Message');
const List = require('./models/List');
const Template = require('./models/Template');
const WhatsAppBusinessAccount = require('./models/WhatsAppBusinessAccount');
const WhatsAppPhoneNumber = require('./models/WhatsAppPhoneNumber');

dotenv.config();

mongoose.connect(process.env.MONGO_URI, {})
    .then(async () => {
        console.log('MongoDB connected');
        await seedData();
        process.exit();
    })
    .catch(err => {
        console.log(err);
        process.exit(1);
    });

const seedData = async () => {
    try {
        // Clear existing seed data
        await Contact.deleteMany({});
        await Campaign.deleteMany({});
        await Message.deleteMany({});
        await List.deleteMany({});
        await Template.deleteMany({});
        await WhatsAppPhoneNumber.deleteMany({});
        await WhatsAppBusinessAccount.deleteMany({});

        // 1. Find or create a test user
        let testUser = await User.findOne({ email: 'test@example.com' });
        if (!testUser) {
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('password123', salt);
            testUser = await User.create({
                email: 'test@example.com',
                password: hashedPassword,
                firstName: 'Test',
                businessName: 'Test Business'
            });
        }
        console.log('Test user ready');

        // 2. Create a WhatsApp Business Account
        const waba = await WhatsAppBusinessAccount.create({
            userId: testUser._id,
            wabaId: 'seed_waba_001',
            name: 'Test Business WABA',
            accessToken: 'seed_access_token_placeholder'
        });
        console.log('WABA created');

        // 3. Create a WhatsApp Phone Number
        const phoneNumber = await WhatsAppPhoneNumber.create({
            userId: testUser._id,
            wabaId: waba._id,
            phoneNumberId: 'seed_phone_001',
            verifiedName: 'Test Business',
            displayPhoneNumber: '+1 234 567 8900',
            isDefault: true
        });
        console.log('Phone number created');

        // 4. Create Templates
        const templates = await Template.create([
            {
                userId: testUser._id,
                wabaId: waba._id,
                name: 'summer_promo',
                category: 'MARKETING',
                language: 'en_US',
                body: 'Hey {{1}}! Check out our summer deals. Use code SUMMER20 for 20% off!',
                variables: ['firstName'],
                status: 'APPROVED'
            },
            {
                userId: testUser._id,
                wabaId: waba._id,
                name: 'welcome_msg',
                category: 'MARKETING',
                language: 'en_US',
                body: 'Welcome to {{1}}, {{2}}! We are glad to have you on board.',
                variables: ['businessName', 'firstName'],
                status: 'APPROVED'
            },
            {
                userId: testUser._id,
                wabaId: waba._id,
                name: 'bf_promo',
                category: 'MARKETING',
                language: 'en_US',
                body: 'Black Friday is here, {{1}}! Massive discounts waiting for you.',
                variables: ['firstName'],
                status: 'APPROVED'
            }
        ]);
        console.log('Templates created');

        // 5. Create Contacts with correct schema fields
        const contacts = await Contact.create([
            {
                userId: testUser._id,
                firstName: 'John',
                lastName: 'Doe',
                countryCode: '1',
                phoneNumber: '234567890',
                email: 'john@example.com',
                tags: ['lead'],
                optedIn: true,
                optInSource: 'manual'
            },
            {
                userId: testUser._id,
                firstName: 'Jane',
                lastName: 'Smith',
                countryCode: '1',
                phoneNumber: '987654321',
                email: 'jane@example.com',
                tags: ['vip'],
                optedIn: true,
                optInSource: 'csv'
            },
            {
                userId: testUser._id,
                firstName: 'Alice',
                lastName: 'Johnson',
                countryCode: '1',
                phoneNumber: '122334455',
                email: 'alice@example.com',
                tags: ['customer'],
                optedIn: true,
                optInSource: 'manual'
            },
            {
                userId: testUser._id,
                firstName: 'Bob',
                lastName: 'Brown',
                countryCode: '1',
                phoneNumber: '566778899',
                email: 'bob@example.com',
                tags: ['lead'],
                optedIn: true,
                optInSource: 'api'
            }
        ]);
        console.log('Contacts created');

        // 6. Create a List and associate contacts
        const list = await List.create({
            name: 'All Contacts',
            description: 'Default list with all seed contacts',
            userId: testUser._id,
            contacts: contacts.map(c => c._id),
            contactCount: contacts.length
        });

        // Update contacts to reference the list
        await Contact.updateMany(
            { _id: { $in: contacts.map(c => c._id) } },
            { $push: { lists: list._id } }
        );
        console.log('List created');

        // 7. Create Campaigns with all required refs
        await Campaign.create([
            {
                user: testUser._id,
                name: 'Summer Sale',
                phoneNumberId: phoneNumber._id,
                templateId: templates[0]._id,
                listId: list._id,
                status: 'completed',
                stats: { sent: 120, delivered: 115, read: 90 },
                createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
            },
            {
                user: testUser._id,
                name: 'Welcome Series',
                phoneNumberId: phoneNumber._id,
                templateId: templates[1]._id,
                listId: list._id,
                status: 'scheduled',
                scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
                createdAt: new Date()
            },
            {
                user: testUser._id,
                name: 'Black Friday',
                phoneNumberId: phoneNumber._id,
                templateId: templates[2]._id,
                listId: list._id,
                status: 'draft',
                createdAt: new Date()
            }
        ]);
        console.log('Campaigns created');

        // 8. Create mock Messages for analytics
        const messageDocs = [];
        const statuses = ['sent', 'delivered', 'read'];

        for (let i = 0; i < 50; i++) {
            const randomContact = contacts[Math.floor(Math.random() * contacts.length)];
            const status = statuses[Math.floor(Math.random() * statuses.length)];
            const date = new Date(Date.now() - Math.floor(Math.random() * 7) * 24 * 60 * 60 * 1000);

            messageDocs.push({
                contact: randomContact._id,
                content: 'Hello, this is a test message',
                direction: 'outbound',
                status: status,
                timestamp: date
            });
        }

        await Message.insertMany(messageDocs);
        console.log('Messages created');

        console.log('Seeding completed successfully!');
    } catch (error) {
        console.error('Error seeding data:', error);
    }
};
