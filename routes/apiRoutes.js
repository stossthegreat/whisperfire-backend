// routes/apiRoutes.js
const express = require('express');
const router = express.Router();

const analysisController = require('../controllers/analysisController'); // keep if you have it
const mentorController = require('../controllers/mentorController');

// UNIFIED ANALYZE ROUTE (keep as-is if used)
router.post('/analyze', analysisController?.unifiedAnalyze || ((req, res) => res.status(501).json({ error: 'unifiedAnalyze not implemented' })));

// LEGACY ANALYZE ROUTES
router.post('/analyze/scan', analysisController?.analyzeScan || ((req, res) => res.status(501).json({ error: 'analyzeScan not implemented' })));
router.post('/analyze/pattern', analysisController?.analyzePattern || ((req, res) => res.status(501).json({ error: 'analyzePattern not implemented' })));

// ✅ MENTOR ROUTE — use the mentor controller (your previous file incorrectly pointed to analysisController)
router.post('/mentor', mentorController.mentorsChat);

module.exports = router;
