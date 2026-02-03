require('dotenv').config();
const mongoose = require('mongoose');
const Contact = require('./models/Contact');

async function seedContactDetails() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB connected');

        // Create a contact with tags and full info
        const newContact = new Contact({
            firstName: 'Detailed',
            lastName: 'Persona',
            phoneNumber: '+15556667777',
            countryCode: '+1',
            email: 'details@example.com',
            optedIn: true,
            optInSource: 'api',
            optInDate: new Date(),
            tags: ['vip', 'interested', '2024'],
            conversationStatus: 'open',
            // Assuming we need a userId, picking first one found or dummy
            userId: (await Contact.findOne()).userId
        });

        await newContact.save();
        console.log('Created detailed contact.');

        // Also add a message so they appear in inbox
        const Message = require('./models/Message');
        const msg = new Message({
            contact: newContact._id,
            content: 'I have a lot of details!',
            type: 'text',
            direction: 'inbound',
            status: 'read',
            timestamp: new Date()
        });
        await msg.save();
        console.log('Added message for Detailed Persona.');

        process.exit(0);

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

seedContactDetails();
