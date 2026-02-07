const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const campaignController = require('../controllers/campaignController');

// @route   GET api/campaigns
// @desc    Get all campaigns for user
// @access  Private
router.get('/', auth, campaignController.getCampaigns);

// @route   POST api/campaigns
// @desc    Create a new campaign
// @access  Private
router.post('/', auth, campaignController.createCampaign);

// @route   GET api/campaigns/templates/:phoneNumberId
// @desc    Get verified templates for a phone number
// @access  Private
router.get('/templates/:phoneNumberId', auth, campaignController.getVerifiedTemplates);

// @route   GET api/campaigns/:id
// @desc    Get single campaign
// @access  Private
router.get('/:id', auth, campaignController.getCampaign);

module.exports = router;
