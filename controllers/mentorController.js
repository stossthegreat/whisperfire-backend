// controllers/mentorController.js

const { generateMentorResponse } = require('../utils/mentorResponse');

// Mentor chat route with SSE (Server-Sent Events) streaming
exports.mentorsChat = (req, res) => {
  try {
    // Accept both Flutter (user_text) and web (userText)
    const { mentor, user_text, userText, preset, options } = req.body || {};
    const actualUserText = user_text || userText;

    console.log('Mentor chat request received:', {
      mentor,
      preset,
      hasText: !!actualUserText
    });

    if (!mentor || !actualUserText || !preset) {
      return res.status(400).json({
        error:
          'Missing required fields: mentor, user_text (or userText), and preset are required',
        received: { mentor, user_text: actualUserText, preset }
      });
    }

    // SSE headers (UTF-8 & proxy-safe)
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // for Nginx
    res.flushHeaders?.();

    // Keep-alive heartbeat (prevents timeouts behind proxies)
    const heartbeat = setInterval(() => {
      try {
        res.write(': ping\n\n');
      } catch {}
    }, 15000);

    // Stream AI wisdom
    const stream = generateMentorResponse(mentor, actualUserText, preset, options);

    stream.on('data', (chunk) => {
      // normalize small payload shape for client
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
    });

    stream.on('end', () => {
      res.write('data: {"done": true}\n\n');
      clearInterval(heartbeat);
      res.end();
    });

    stream.on('error', (err) => {
      console.error('SSE stream error:', err);
      try {
        res.write(`data: ${JSON.stringify({ error: 'Failed to generate response' })}\n\n`);
        res.write('data: {"done": true}\n\n');
      } catch {}
      clearInterval(heartbeat);
      res.end();
    });
  } catch (error) {
    console.error('Mentor chat error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to generate mentor response' });
    }
    try {
      res.write(`data: ${JSON.stringify({ error: 'Failed to generate response' })}\n\n`);
      res.write('data: {"done": true}\n\n');
    } catch {}
    res.end();
  }
};
