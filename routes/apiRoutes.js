// routes/apiRoutes.js

const express = require('express');
const router = express.Router();
const analysisController = require('../controllers/analysisController');

// Routes for analyze requests
router.post('/analyze/scan', analysisController.analyzeScan);
router.post('/analyze/pattern', analysisController.analyzePattern);
router.post('/mentors/chat', analysisController.mentorChat);

module.exports = router; 