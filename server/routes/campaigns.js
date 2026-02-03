const express = require('express');
const router = express.Router();
const Campaign = require('../models/Campaign');

router.get('/', (req, res) => {
    res.send('Get all campaigns');
});

router.post('/', (req, res) => {
    res.send('Create campaign');
});

module.exports = router;
