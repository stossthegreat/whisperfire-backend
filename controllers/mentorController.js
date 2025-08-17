const { generateMentorResponse } = require('../utils/mentorResponse');

// Mentor chat route (SSE streaming)
exports.mentorsChat = (req, res) => {
    const { mentor, userText, preset, options } = req.body;

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Start stream
    let streamData = generateMentorResponse(mentor, userText, preset, options);

    streamData.on('data', (chunk) => {
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    });

    streamData.on('end', () => {
        res.write('data: {"done": true}\n\n');
        res.end();
    });

    streamData.on('error', (err) => {
        res.write('data: {"error": "Internal server error"}\n\n');
        res.end();
    });
};
