// controllers/mentorController.js
const { generateMentorResponse } = require('../utils/mentorResponse');
const { normalizeMentorText, sanitizeForSSE } = require('../utils/textSanitizer');

exports.mentorsChat = (req, res) => {
  try {
    const { mentor, user_text, userText, preset, options } = req.body || {};
    const actualUserText = user_text || userText;

    if (!mentor || !actualUserText || !preset) {
      return res.status(400).json({
        error: 'Missing required fields: mentor, user_text, and preset are required',
        received: { mentor, user_text: actualUserText, preset }
      });
    }

    // SSE headers (ASCII/UTF-8 safe)
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // keep-alive
    const keepAlive = setInterval(() => { if (!res.writableEnded) res.write(`: ping\n\n`); }, 15000);

    const stream = generateMentorResponse(mentor, actualUserText, preset, options);

    stream.on('data', (chunk) => {
      try {
        const raw = typeof chunk === 'string' ? chunk : (chunk?.text || '');
        const cleaned = normalizeMentorText(raw);
        const safe = sanitizeForSSE(cleaned);

        const payload = {
          ...chunk,
          text: safe
        };
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch (e) {
        res.write(`data: ${JSON.stringify({ error: 'sanitize_failed' })}\n\n`);
      }
    });

    stream.on('end', () => {
      clearInterval(keepAlive);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    });

    stream.on('error', (err) => {
      clearInterval(keepAlive);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream error occurred', details: err?.message });
      } else {
        res.write(`data: ${JSON.stringify({ error: 'Stream error occurred' })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      }
    });
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate mentor response', details: error?.message });
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Failed to generate response' })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    }
  }
};
