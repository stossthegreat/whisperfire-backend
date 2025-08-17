const { WhisperfireResponse, validateResponse } = require('../utils/responseValidator');
const firebaseAdmin = require('firebase-admin');

// Analyze Scan route
exports.analyzeScan = async (req, res) => {
    try {
        const { message, tone, relationship, content_type, subject_name } = req.body;
        const response = await analyzeRequest({ message, tone, relationship, content_type, subject_name });
        res.status(200).json(response);
    } catch (error) {
        res.status(500).json({ error: 'Error processing scan request.' });
    }
};

// Analyze Pattern route
exports.analyzePattern = async (req, res) => {
    try {
        const { messages, tone, relationship, content_type, subject_name } = req.body;
        const response = await analyzePatternRequest({ messages, tone, relationship, content_type, subject_name });
        res.status(200).json(response);
    } catch (error) {
        res.status(500).json({ error: 'Error processing pattern request.' });
    }
};

// Helper function to process scan
async function analyzeRequest(data) {
    const { message, tone, relationship, content_type, subject_name } = data;
    const result = WhisperfireResponse.generateScanResult(message, tone, relationship);
    return validateResponse(result);
}

// Helper function to process pattern
async function analyzePatternRequest(data) {
    const { messages, tone, relationship, content_type, subject_name } = data;
    const result = WhisperfireResponse.generatePatternResult(messages, tone, relationship);
    return validateResponse(result);
}
