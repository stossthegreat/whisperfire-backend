// controllers/mentorController.js
require('dotenv').config();
const { generateMentorResponse } = require('../utils/mentorResponse');

exports.mentorsChat = (req, res) => {
  try {
    const { mentor, user_text, userText, preset, options } = req.body;
    const actualUserText = (user_text ?? userText ?? '').toString().trim();

    if (!mentor || !actualUserText || !preset) {
      return res.status(400).json({
        error: 'Missing required fields: mentor, user_text, and preset are required',
        received: { mentor, user_text: actualUserText, preset }
      });
    }

    // ✅ Proper UTF-8 SSE headers (prevents Â/Ã junk)
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    // Keep-alive ping for proxies / load balancers
    const ping = setInterval(() => {
      try { res.write(': ping\n\n'); } catch (_) {}
    }, 15000);

    const stream = generateMentorResponse(mentor, actualUserText, preset, options);

    stream.on('data', (chunk) => {
      // chunk.text is already cleaned + paragraphized in utils/mentorResponse
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    });

    stream.on('end', () => {
      clearInterval(ping);
      res.write('data: {"done": true}\n\n');
      res.end();
    });

    stream.on('error', (err) => {
      clearInterval(ping);
      console.error('Mentor SSE error:', err);
      try {
        res.write(`data: ${JSON.stringify({ error: 'Failed to generate response' })}\n\n`);
        res.write('data: {"done": true}\n\n');
        res.end();
      } catch (_) {}
    });
  } catch (error) {
    console.error('Mentor chat fatal error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to generate mentor response' });
    }
    try {
      res.write(`data: ${JSON.stringify({ error: 'Failed to generate mentor response' })}\n\n`);
      res.write('data: {"done": true}\n\n');
      res.end();
    } catch (_) {}
  }
};
