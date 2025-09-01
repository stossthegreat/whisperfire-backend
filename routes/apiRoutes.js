// routes/apiRoutes.js
const express = require('express');
const router = express.Router();

const analysisController = require('../controllers/analysisController');
const mentorController = require('../controllers/mentorController');

// UNIFIED (client passes { tab: 'scan' | 'pattern' })
router.post('/analyze', analysisController.unifiedAnalyze);

// explicit routes if you still use them
router.post('/analyze/scan', analysisController.analyzeScan);
router.post('/analyze/pattern', analysisController.analyzePattern);

// Mentor SSE route
router.post('/mentor', mentorController.mentorsChat);

module.exports = router;
