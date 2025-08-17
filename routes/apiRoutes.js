const express = require('express');
const router = express.Router();
const analysisController = require('../controllers/analysisController'); // Ensure this is correct
const mentorController = require('../controllers/mentorController'); // Ensure this is correct

// Routes for analyze requests
router.post('/analyze/scan', analysisController.analyzeScan);
router.post('/analyze/pattern', analysisController.analyzePattern);

// Route for mentor chat (SSE)
router.post('/mentor', mentorController.mentorsChat);  // Ensure this is the correct route

module.exports = router;
