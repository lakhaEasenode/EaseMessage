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

// @route   POST api/campaigns/:id/start
// @desc    Start executing a campaign
// @access  Private
router.post('/:id/start', auth, campaignController.startCampaign);

// @route   GET api/campaigns/:id
// @desc    Get single campaign
// @access  Private
router.get('/:id', auth, campaignController.getCampaign);

// @route   PUT api/campaigns/:id
// @desc    Update a campaign (draft/scheduled only)
// @access  Private
router.put('/:id', auth, campaignController.updateCampaign);

// @route   DELETE api/campaigns/:id
// @desc    Delete a campaign (draft/scheduled only)
// @access  Private
router.delete('/:id', auth, campaignController.deleteCampaign);

module.exports = router;
