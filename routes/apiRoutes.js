// routes/apiRoutes.js
const express = require('express');
const router = express.Router();

const analysisController = require('../controllers/analysisController');
const mentorController = require('../controllers/mentorController');

// Analyze
router.post('/analyze', analysisController.unifiedAnalyze);
router.post('/analyze/scan', analysisController.analyzeScan);
router.post('/analyze/pattern', analysisController.analyzePattern);

// Mentor (JSON fallback that always replies)
router.get('/mentor/health', mentorController.mentorHealth);
router.post('/mentor/json', mentorController.mentorJSON);

module.exports = router;
