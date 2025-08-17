const express = require('express');
const router = express.Router();
const analysisController = require('../controllers/analysisController');
const mentorController = require('../controllers/mentorController');

// Analyze routes
router.post('/analyze/scan', analysisController.analyzeScan);
router.post('/analyze/pattern', analysisController.analyzePattern);

// Mentor chat route
router.post('/mentor', mentorController.mentorsChat); // Ensure this matches your route

module.exports = router;
