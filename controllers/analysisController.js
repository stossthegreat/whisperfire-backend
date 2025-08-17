// controllers/analysisController.js

const { analyzeWithAI } = require('../services/aiService'); // Your AI service
const { saveProgress } = require('../services/firebaseService'); // Firebase service for saving user progress

// Handle scan analysis
async function analyzeScan(req, res) {
  try {
    const { message, tone, userId } = req.body;

    // Process the scan using AI
    const scanResult = await analyzeWithAI(message, tone); // Call AI service for scan

    // Save the progress in the database (or Firestore if you had Firebase)
    await saveProgress(userId, { scanResult });

    res.json({ success: true, data: scanResult });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// Handle pattern analysis
async function analyzePattern(req, res) {
  try {
    const { messages, tone, userId } = req.body;

    // Process the pattern analysis using AI
    const patternResult = await analyzeWithAI(messages.join('\n'), tone); // Join messages and call AI

    // Save the pattern analysis progress (save it to Firestore or database)
    await saveProgress(userId, { patternResult });

    res.json({ success: true, data: patternResult });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

// Handle mentor chat (similar structure)
async function mentorChat(req, res) {
  try {
    const { mentor, userText, preset, options } = req.body;

    // Call AI service to get mentor response
    const mentorResponse = await getMentorResponse(mentor, userText, preset, options);

    res.json({ success: true, data: mentorResponse });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  analyzeScan,
  analyzePattern,
  mentorChat
}; 