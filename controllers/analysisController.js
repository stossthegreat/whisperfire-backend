const { WhisperfireResponse, validateResponse } = require('../utils/responseValidator');

// Analyze Scan route
exports.analyzeScan = async (req, res) => {
    try {
        const { message, tone, relationship, content_type, subject_name } = req.body;
        const response = await analyzeRequest({
            message, tone, relationship, content_type, subject_name
        });
        res.status(200).json(response);
    } catch (error) {
        res.status(500).json({ error: 'Error processing scan request.' });
    }
};

// Analyze Pattern route
exports.analyzePattern = async (req, res) => {
    try {
        const { messages, tone, relationship, content_type, subject_name } = req.body;
        const response = await analyzePatternRequest({
            messages, tone, relationship, content_type, subject_name
        });
        res.status(200).json(response);
    } catch (error) {
        res.status(500).json({ error: 'Error processing pattern request.' });
    }
};
