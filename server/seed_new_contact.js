require('dotenv').config();
const mongoose = require('mongoose');
const Contact = require('./models/Contact');
const Message = require('./models/Message');

async function seedNewContact() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB connected');

        // Create a contact with NO messages
        const newContact = new Contact({
            firstName: 'Empty',
            lastName: 'Traction',
            phoneNumber: '+19998887777',
            countryCode: '+1',
            email: 'empty@example.com',
            optedIn: true,
            optInSource: 'manual',
            optInDate: new Date(),
            // Assuming we need a userId, picking first one found or dummy
            userId: (await Contact.findOne()).userId
        });

        await newContact.save();
        console.log('Created contact "Empty Traction" with no messages.');

        process.exit(0);

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

seedNewContact();
