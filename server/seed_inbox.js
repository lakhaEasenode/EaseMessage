require('dotenv').config();
const mongoose = require('mongoose');
const Message = require('./models/Message');
const Contact = require('./models/Contact');

async function seedInbox() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB connected');

        const contacts = await Contact.find().limit(3);
        if (contacts.length === 0) {
            console.log('No contacts found. Run seed.js first.');
            process.exit(1);
        }

        console.log(`Seeding messages for ${contacts.length} contacts...`);

        const messages = [];

        // Contact 1: Active conversation (Inbound < 24h)
        const c1 = contacts[0];
        messages.push(
            { contact: c1._id, direction: 'outbound', type: 'text', content: 'Hello! How can we help?', status: 'read', timestamp: new Date(Date.now() - 3600000 * 5) },
            { contact: c1._id, direction: 'inbound', type: 'text', content: 'I have a question about pricing', status: 'read', timestamp: new Date(Date.now() - 3600000 * 4) }
        );

        // Contact 2: Expired conversation (Inbound > 24h)
        if (contacts.length > 1) {
            const c2 = contacts[1];
            messages.push(
                { contact: c2._id, direction: 'inbound', type: 'text', content: 'Is this available?', status: 'read', timestamp: new Date(Date.now() - 3600000 * 25) }
            );
        }

        await Message.insertMany(messages);
        console.log('Messages seeded!');
        process.exit(0);

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

seedInbox();
