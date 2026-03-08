const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const List = require('../models/List');
const Contact = require('../models/Contact');

// @route   GET api/lists
// @desc    Get all lists for the logged-in user
// @access  Private
router.get('/', auth, async (req, res) => {
    try {
        const lists = await List.findActive({ userId: req.user.id })
            .sort({ createdAt: -1 })
            .populate({
                path: 'contacts',
                match: { isDeleted: false },
                select: 'firstName lastName phoneNumber'
            });

        // Compute contactCount from active contacts only (fixes stale denormalized counter)
        const result = lists.map(list => {
            const obj = list.toObject();
            obj.contactCount = obj.contacts.length;
            return obj;
        });

        res.json(result);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   GET api/lists/:id
// @desc    Get single list by ID
// @access  Private
router.get('/:id', auth, async (req, res) => {
    try {
        const list = await List.findOne({
            _id: req.params.id,
            userId: req.user.id,
            isDeleted: false
        }).populate('contacts', 'firstName lastName phoneNumber email');

        if (!list) {
            return res.status(404).json({ msg: 'List not found' });
        }

        res.json(list);
    } catch (err) {
        console.error(err.message);
        if (err.kind === 'ObjectId') {
            return res.status(404).json({ msg: 'List not found' });
        }
        res.status(500).send('Server error');
    }
});

// @route   POST api/lists
// @desc    Create a new list
// @access  Private
router.post('/', auth, async (req, res) => {
    const { name, description } = req.body;

    try {
        if (!name) {
            return res.status(400).json({ msg: 'List name is required' });
        }

        const newList = new List({
            name,
            description,
            userId: req.user.id
        });

        const list = await newList.save();
        res.json(list);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   PUT api/lists/:id
// @desc    Update list
// @access  Private
router.put('/:id', auth, async (req, res) => {
    const { name, description } = req.body;

    try {
        let list = await List.findOne({
            _id: req.params.id,
            userId: req.user.id,
            isDeleted: false
        });

        if (!list) {
            return res.status(404).json({ msg: 'List not found' });
        }

        if (name) list.name = name;
        if (description !== undefined) list.description = description;

        await list.save();
        res.json(list);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// @route   DELETE api/lists/:id
// @desc    Soft delete list
// @access  Private
router.delete('/:id', auth, async (req, res) => {
    try {
        const list = await List.findOne({
            _id: req.params.id,
            userId: req.user.id,
            isDeleted: false
        });

        if (!list) {
            return res.status(404).json({ msg: 'List not found' });
        }

        await list.softDelete();
        res.json({ msg: 'List deleted successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
