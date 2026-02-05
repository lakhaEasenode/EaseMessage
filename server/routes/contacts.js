const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Contact = require('../models/Contact');
const List = require('../models/List');
const multer = require('multer');
const csv = require('csv-parser');
const stream = require('stream');

const upload = multer({ storage: multer.memoryStorage() });

// @route   POST api/contacts/upload
// @desc    Upload CSV and bulk create contacts
// @access  Private
router.post('/upload', [auth, upload.single('file')], async (req, res) => {
    if (!req.file) {
        console.log('Upload attempted but no file found in req.file');
        return res.status(400).json({ msg: 'No file uploaded' });
    }
    console.log('File received:', req.file.originalname, req.file.mimetype, req.file.size);

    // Parse listIds from body (sent as JSON string)
    let listIds = [];
    try {
        if (req.body.listIds) {
            listIds = JSON.parse(req.body.listIds);
            console.log('Assigning to lists:', listIds);
        }
    } catch (e) {
        console.error('Error parsing listIds:', e);
    }

    const results = [];
    const errors = [];
    let duplicates = 0;
    let imported = 0;

    // Helper to normalize phone numbers (basic)
    const normalizePhone = (p) => p.replace(/\D/g, '');

    // 1. Parse CSV
    const bufferStream = new stream.PassThrough();
    bufferStream.end(req.file.buffer);

    bufferStream
        .pipe(csv({ mapHeaders: ({ header }) => header.trim() }))
        .on('headers', (headers) => console.log('Parsed Headers:', headers))
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            console.log(`Parsed ${results.length} rows`);
            if (results.length > 0) console.log('Sample Row:', results[0]);
            try {
                const contactsToInsert = [];
                // optimization: fetch all existing phone numbers for this user
                const existingContacts = await Contact.find({ userId: req.user.id, isDeleted: false }).select('phoneNumber');
                const existingPhoneSet = new Set(existingContacts.map(c => normalizePhone(c.phoneNumber)));

                for (const row of results) {
                    // 2. Validate Row
                    const firstName = row.firstName || row.firstname || row['First Name'];
                    // Phone might be under different headers, try standard ones
                    let rawPhone = row.phoneNumber || row.phone || row['Phone Number'] || row['Phone'];

                    if (!firstName || !rawPhone) {
                        errors.push({ row, msg: 'Missing name or phone' });
                        continue;
                    }

                    const normalizedPhone = normalizePhone(rawPhone);
                    if (existingPhoneSet.has(normalizedPhone)) {
                        duplicates++;
                        continue;
                    }

                    // Avoid duplicates within the file itself
                    if (contactsToInsert.some(c => normalizePhone(c.phoneNumber) === normalizedPhone)) {
                        duplicates++;
                        continue;
                    }

                    contactsToInsert.push({
                        userId: req.user.id,
                        firstName: firstName,
                        lastName: row.lastName || row.lastname || row['Last Name'] || '',
                        countryCode: row.countryCode || '91', // Default to 91 as requested
                        phoneNumber: rawPhone,
                        email: row.email || row.Email || '',
                        companyName: row.companyName || row.company || row['Company Name'] || row['Company'] || '',
                        sheetName: row.sheetName || row.sheet || row['Sheet Name'] || row['Sheet'] || '',
                        optedIn: true,
                        optInSource: 'import',
                        optInDate: new Date(),
                        conversationStatus: 'open',
                        lists: listIds
                    });
                }

                if (contactsToInsert.length > 0) {
                    const insertedContacts = await Contact.insertMany(contactsToInsert);
                    imported = insertedContacts.length;

                    // Update lists to include the new contacts
                    if (listIds.length > 0) {
                        const newContactIds = insertedContacts.map(c => c._id);
                        await List.updateMany(
                            { _id: { $in: listIds } },
                            {
                                $push: { contacts: { $each: newContactIds } },
                                $inc: { contactCount: newContactIds.length }
                            }
                        );
                        console.log(`Updated ${listIds.length} lists with ${newContactIds.length} new contacts`);
                    }
                }

                res.json({
                    msg: 'Upload processed',
                    summary: {
                        totalRows: results.length,
                        imported,
                        duplicates,
                        errors: errors.length
                    }
                });

            } catch (err) {
                console.error('CSV Processing Error:', err);
                res.status(500).json({ msg: 'Error processing CSV file' });
            }
        });
});

// @route   GET api/contacts
// @desc    Get all contacts for the logged-in user (optionally filtered by listId)
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const query = { userId: req.user.id };

        // Optional list filter
        if (req.query.listId) {
            query.lists = req.query.listId;
        }

        const contacts = await Contact.findActive(query)
            .sort({ createdAt: -1 })
            .populate('lists', 'name');

        res.json(contacts);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET api/contacts/:id
// @desc    Get single contact by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
    try {
        const contact = await Contact.findOne({
            _id: req.params.id,
            userId: req.user.id,
            isDeleted: false
        }).populate('lists', 'name');

        if (!contact) {
            return res.status(404).json({ msg: 'Contact not found' });
        }

        res.json(contact);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'Contact not found' });
        }
        res.status(500).send('Server error');
    }
});

// @route   POST api/contacts
// @desc    Create a new contact
// @access  Private
router.post('/', auth, async (req, res) => {
    const { firstName, lastName, countryCode, phoneNumber, email, companyName, sheetName, tags, optedIn } = req.body;

    try {
        if (!firstName || !phoneNumber) {
            return res.status(400).json({ msg: 'First name and phone number are required' });
        }

        if (!optedIn) {
            return res.status(400).json({ msg: 'Contact must opt-in to receive messages' });
        }

        // Check for duplicate
        const existingContact = await Contact.findOne({
            userId: req.user.id,
            countryCode: countryCode || '+1',
            phoneNumber,
            isDeleted: false
        });

        if (existingContact) {
            return res.status(400).json({ msg: 'Contact with this phone number already exists' });
        }

        const newContact = new Contact({
            userId: req.user.id,
            firstName,
            lastName,
            countryCode: countryCode || '91',
            phoneNumber,
            email,
            companyName,
            sheetName,
            tags: tags || [],
            optedIn: true,
            optInSource: 'manual',
            optInDate: new Date()
        });

        const contact = await newContact.save();
        res.json(contact);
    } catch (err) {
        console.error(err.message);
        if (err.code === 11000) {
            return res.status(400).json({ msg: 'Contact with this phone number already exists' });
        }
        res.status(500).send('Server error');
    }
});

// @route   PUT api/contacts/:id
// @desc    Update contact
// @access  Private
router.put('/:id', auth, async (req, res) => {
    const { firstName, lastName, countryCode, phoneNumber, email, companyName, sheetName, tags, optedIn } = req.body;

    try {
        let contact = await Contact.findOne({
            _id: req.params.id,
            userId: req.user.id,
            isDeleted: false
        });

        if (!contact) {
            return res.status(404).json({ msg: 'Contact not found' });
        }

        if (firstName) contact.firstName = firstName;
        if (lastName !== undefined) contact.lastName = lastName;
        if (countryCode) contact.countryCode = countryCode;
        if (phoneNumber) contact.phoneNumber = phoneNumber;
        if (email !== undefined) contact.email = email;
        if (companyName !== undefined) contact.companyName = companyName;
        if (sheetName !== undefined) contact.sheetName = sheetName;
        if (tags) contact.tags = tags;
        if (optedIn !== undefined) contact.optedIn = optedIn;
        if (req.body.conversationStatus) contact.conversationStatus = req.body.conversationStatus;

        await contact.save();
        res.json(contact);
    } catch (err) {
        console.error(err.message);
        if (err.code === 11000) {
            return res.status(400).json({ msg: 'Contact with this phone number already exists' });
        }
        res.status(500).send('Server error');
    }
});

// @route   PUT api/contacts/:id/status
// @desc    Update conversation status
// @access  Private
router.put('/:id/status', auth, async (req, res) => {
    const { status } = req.body;
    if (!['open', 'pending', 'resolved'].includes(status)) {
        return res.status(400).json({ msg: 'Invalid status' });
    }

    try {
        const contact = await Contact.findOne({ _id: req.params.id, userId: req.user.id });
        if (!contact) return res.status(404).json({ msg: 'Contact not found' });

        contact.conversationStatus = status;
        await contact.save();
        res.json(contact);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   DELETE api/contacts/:id
// @desc    Soft delete contact
// @access  Private
router.delete('/:id', auth, async (req, res) => {
    try {
        const contact = await Contact.findOne({
            _id: req.params.id,
            userId: req.user.id,
            isDeleted: false
        });

        if (!contact) {
            return res.status(404).json({ msg: 'Contact not found' });
        }

        await contact.softDelete();
        res.json({ msg: 'Contact deleted successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
