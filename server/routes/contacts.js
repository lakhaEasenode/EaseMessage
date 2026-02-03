const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Contact = require('../models/Contact');

// @route   GET api/contacts
// @desc    Get all contacts for the logged-in user
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const contacts = await Contact.findActive({ userId: req.user.id })
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
    const { firstName, lastName, countryCode, phoneNumber, email, tags, optedIn } = req.body;

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
            countryCode: countryCode || '+1',
            phoneNumber,
            email,
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
    const { firstName, lastName, countryCode, phoneNumber, email, tags, optedIn } = req.body;

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
