const express = require('express');
const router = express.Router();
const analysisController = require('../controllers/analysisController');
const mentorController = require('../controllers/mentorController');
const progressController = require('../controllers/progressController');

// Routes for analyze requests
router.post('/analyze/scan', analysisController.analyzeScan);
router.post('/analyze/pattern', analysisController.analyzePattern);

// Route for mentor chat
router.post('/mentor', mentorController.mentorsChat);

// Route for progress events
router.post('/progress/event', progressController.progressEvent);

module.exports = router;
