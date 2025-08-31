// controllers/mentorController.js — stable SSE, no extra imports
const { generateMentorResponse } = require('../utils/mentorResponse');

exports.mentorsChat = (req, res) => {
  try {
    const body = req.body || {};
    const { mentor, preset, options } = body;
    const actualUserText = body.user_text || body.userText;

    if (!mentor || !actualUserText || !preset) {
      return res.status(400).json({
        error: 'Missing required fields: mentor, user_text, and preset are required',
        received: { mentor: !!mentor, user_text: !!actualUserText, preset }
      });
    }

    // SSE headers
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') res.flushHeaders();

    // Keep alive
    const keepAlive = setInterval(() => {
      if (!res.writableEnded) res.write(`: ping\n\n`);
    }, 15000);

    // Immediately let client know stream opened
    res.write(`data: ${JSON.stringify({ type: 'open', ok: true, mentor, preset, t: Date.now() })}\n\n`);

    const stream = generateMentorResponse(mentor, actualUserText, preset, options || {});
    stream.on('data', (payload) => {
      // payload.text is already sanitized in utils/mentorResponse
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    });
    stream.on('end', () => {
      clearInterval(keepAlive);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    });
    stream.on('error', (err) => {
      clearInterval(keepAlive);
      if (!res.headersSent) {
        res.status(500).json({ error: 'stream_error', details: err?.message });
      } else {
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'stream_error' })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      }
    });

    req.on('close', () => {
      clearInterval(keepAlive);
      try { stream.removeAllListeners(); } catch {}
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
