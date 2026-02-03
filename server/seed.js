const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('./models/User');
const Contact = require('./models/Contact');
const Campaign = require('./models/Campaign');
const Message = require('./models/Message');

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
        // localized clear
        await Contact.deleteMany({});
        await Campaign.deleteMany({});
        await Message.deleteMany({});

        // Create Contacts
        const contacts = await Contact.create([
            { name: 'John Doe', phoneNumber: '+1234567890', email: 'john@example.com', tags: ['lead'], source: 'manual' },
            { name: 'Jane Smith', phoneNumber: '+0987654321', email: 'jane@example.com', tags: ['vip'], source: 'csv' },
            { name: 'Alice Johnson', phoneNumber: '+1122334455', email: 'alice@example.com', tags: ['customer'], source: 'manual' },
            { name: 'Bob Brown', phoneNumber: '+5566778899', email: 'bob@example.com', tags: ['lead'], source: 'api' }
        ]);

        console.log('Contacts created');

        // Create Campaigns
        const campaigns = await Campaign.create([
            {
                name: 'Summer Sale',
                templateName: 'summer_promo',
                status: 'sent',
                stats: { sent: 120, delivered: 115, read: 90 },
                createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
            },
            {
                name: 'Welcome Series',
                templateName: 'welcome_msg',
                status: 'scheduled',
                scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days future
                createdAt: new Date()
            },
            {
                name: 'Black Friday',
                templateName: 'bf_promo',
                status: 'draft',
                createdAt: new Date()
            }
        ]);

        console.log('Campaigns created');

        // Create History/Messages (Mock analytics data)
        // We need to verify that dashboard aggregation uses Message model
        // Let's create some dummy messages
        const messageDocs = [];
        const statuses = ['sent', 'delivered', 'read'];

        // Create random historical messages for the chart
        for (let i = 0; i < 50; i++) {
            const randomContact = contacts[Math.floor(Math.random() * contacts.length)];
            const status = statuses[Math.floor(Math.random() * statuses.length)];
            // Random date within last 7 days
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

    } catch (error) {
        console.error('Error seeding data:', error);
    }
};
