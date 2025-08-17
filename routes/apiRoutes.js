const express = require('express');
const router = express.Router();
const analysisController = require('../controllers/analysisController');
const mentorController = require('../controllers/mentorController');

// UNIFIED ANALYZE ROUTE - This is what your Flutter app calls
router.post('/analyze', analysisController.unifiedAnalyze);

// SEPARATE ANALYZE ROUTES - Keep for backward compatibility  
router.post('/analyze/scan', analysisController.analyzeScan);
router.post('/analyze/pattern', analysisController.analyzePattern);

// MENTOR ROUTE - This is what your Flutter app calls
router.post('/mentor', mentorController.mentorsChat);

module.exports = router;
