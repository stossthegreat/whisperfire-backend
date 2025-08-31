// routes/apiRoutes.js
const express = require('express');
const router = express.Router();

const analysisController = require('../controllers/analysisController');
const mentorController = require('../controllers/mentorController');

router.post('/analyze', analysisController.unifiedAnalyze);
router.post('/analyze/scan', analysisController.analyzeScan);
router.post('/analyze/pattern', analysisController.analyzePattern);

// Mentor route supports both GET (EventSource) and POST (fetch streaming)
router.get('/mentor', mentorController.mentorsChat);
router.post('/mentor', mentorController.mentorsChat);

module.exports = router;;
