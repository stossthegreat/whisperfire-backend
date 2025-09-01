// routes/apiRoutes.js
const express = require('express');
const router = express.Router();

const analysisController = require('../controllers/analysisController');
const mentorController = require('../controllers/mentorController');

/**

UNIFIED ANALYZE ROUTE – primary entry the app should call

(keep your existing analysisController implementation)
*/
router.post('/analyze', analysisController.unifiedAnalyze);


// Back-compat separate routes (if the app still hits these)
router.post('/analyze/scan', analysisController.analyzeScan);
router.post('/analyze/pattern', analysisController.analyzePattern);

// Mentor SSE route (FIXED: call mentorController.mentorsChat)
router.post('/mentor', mentorController.mentorsChat);

module.exports = router;

