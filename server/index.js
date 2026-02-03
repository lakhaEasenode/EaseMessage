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

// Middleware
app.use(cors({
  origin: [process.env.CLIENT_URL || 'http://localhost:3300'],
  credentials: true
})); // Restricted to specific origins with credentials
app.use(express.json());

// Routes
const authRoutes = require('./routes/auth');
const contactRoutes = require('./routes/contacts');
const listRoutes = require('./routes/lists');
const statsRoutes = require('./routes/stats');
const campaignRoutes = require('./routes/campaigns');
const whatsappRoutes = require('./routes/whatsapp');
const templateRoutes = require('./routes/templates');
const dashboardRoutes = require('./routes/dashboard');

app.use('/api/auth', authRoutes);
app.use('/api/contacts', contactRoutes);
app.use('/api/lists', listRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/campaigns', campaignRoutes);
app.use('/api/whatsapp', whatsappRoutes);
app.use('/api/templates', templateRoutes);
app.use('/api/messages', require('./routes/messages'));
app.use('/api/dashboard', dashboardRoutes);

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
