require('dotenv').config();
const mongoose = require('mongoose');
const Contact = require('./models/Contact');
const Message = require('./models/Message');

async function seedFilters() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('MongoDB connected');

        // Fetch existing contacts
        const contacts = await Contact.findActive();

        if (contacts.length >= 3) {
            // Set 1st to Open (default)
            contacts[0].conversationStatus = 'open';
            await contacts[0].save();
            console.log(`Set ${contacts[0].firstName} to OPEN`);

            // Set 2nd to Pending
            contacts[1].conversationStatus = 'pending';
            await contacts[1].save();
            console.log(`Set ${contacts[1].firstName} to PENDING`);

            // Set 3rd to Resolved
            contacts[2].conversationStatus = 'resolved';
            await contacts[2].save();
            console.log(`Set ${contacts[2].firstName} to RESOLVED`);
        } else {
            console.log("Not enough contacts to seed all statuses. Please create more contacts.");
        }

        process.exit(0);

    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

seedFilters();
