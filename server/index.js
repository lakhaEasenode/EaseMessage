const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Contact = require('./models/Contact');
const Campaign = require('./models/Campaign');
const Message = require('./models/Message');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to Database
// Note: connectDB() is not defined in the original document. Assuming it's meant to be added or is a placeholder.
// For now, keeping the original connection logic in startServer().
// If connectDB() is a new function, it needs to be defined.

// Init Middleware
app.use(express.json({ extended: false })); // Changed from app.use(express.json());
app.use(cors()); // Changed from specific cors config

// Register Models explicitly
require('./models/User');
require('./models/WhatsAppBusinessAccount');
require('./models/WhatsAppPhoneNumber');
require('./models/Contact');
require('./models/List');
require('./models/Message');
require('./models/Template');
require('./models/Campaign');

// Routes
app.use('/api/auth', require('./routes/auth')); // Changed from const authRoutes = require('./routes/auth'); app.use('/api/auth', authRoutes);
const contactRoutes = require('./routes/contacts');
const listRoutes = require('./routes/lists');
const statsRoutes = require('./routes/stats');
const campaignRoutes = require('./routes/campaigns');
const whatsappRoutes = require('./routes/whatsapp');
const templateRoutes = require('./routes/templates');
const dashboardRoutes = require('./routes/dashboard');

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/contacts', require('./routes/contacts'));
app.use('/api/lists', require('./routes/lists'));
app.use('/api/stats', require('./routes/stats'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/whatsapp', require('./routes/whatsapp'));
app.use('/api/templates', require('./routes/templates'));
app.use('/api/messages', require('./routes/messages'));
app.use('/api/dashboard', require('./routes/dashboard'));

const seedData = async () => {
  try {
    const contactCount = await Contact.countDocuments();
    if (contactCount > 0) return;

    console.log('Seeding data...');

    const contacts = await Contact.create([
      { name: 'John Doe', phoneNumber: '+1234567890', email: 'john@example.com', tags: ['lead'], source: 'manual' },
      { name: 'Jane Smith', phoneNumber: '+0987654321', email: 'jane@example.com', tags: ['vip'], source: 'csv' },
      { name: 'Alice Johnson', phoneNumber: '+1122334455', email: 'alice@example.com', tags: ['customer'], source: 'manual' },
      { name: 'Bob Brown', phoneNumber: '+5566778899', email: 'bob@example.com', tags: ['lead'], source: 'api' }
    ]);

    await Campaign.create([
      {
        name: 'Summer Sale',
        templateName: 'summer_promo',
        status: 'sent',
        stats: { sent: 120, delivered: 115, read: 90 },
        createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      },
      {
        name: 'Welcome Series',
        templateName: 'welcome_msg',
        status: 'scheduled',
        scheduledAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        createdAt: new Date()
      },
      {
        name: 'Black Friday',
        templateName: 'bf_promo',
        status: 'draft',
        createdAt: new Date()
      }
    ]);

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
    console.log('Data seeded successfully');
  } catch (err) {
    console.error('Seeding error:', err);
  }
};

const startServer = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI, {});
    console.log('MongoDB connected');

    await seedData();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error(err);
  }
};

// Routes Placeholders (root)
app.get('/', (req, res) => {
  res.send('B2B WhatsApp Marketing API is running');
});

startServer();
