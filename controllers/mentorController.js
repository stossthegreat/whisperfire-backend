// controllers/mentorController.js
const { generateMentorResponse } = require('../utils/mentorResponse');
const { sanitizeForSSE, normalizeMentorText, asciiHardClean } = require('../utils/textSanitizer');

const VALID_PRESETS = new Set(['chat', 'roleplay', 'advise', 'drill']);

exports.mentorsChat = (req, res) => {
  try {
    const { mentor, user_text, userText, preset, options } = req.body || {};
    const actualUserText = user_text || userText;

    if (!mentor || !actualUserText || !preset || !VALID_PRESETS.has(String(preset).toLowerCase())) {
      return res.status(400).json({
        error: 'Missing/invalid fields. Required: mentor, user_text, preset in {chat|roleplay|advise|drill}',
        received: { mentor: !!mentor, user_text: !!actualUserText, preset }
      });
    }

    // --- SSE headers (and make proxies leave it alone)
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // NOTE: if you use compression middleware, skip it for this route.

    // Keep-alive pings so some hosts don’t close the socket
    const keepAlive = setInterval(() => {
      if (!res.writableEnded) res.write(`: ping\n\n`);
    }, 15000);

    // Immediate “open” event so the UI knows the stream is alive
    res.write(`event: open\ndata: ${JSON.stringify({ ok: true, mentor, preset })}\n\n`);

    // Safety timer: if we haven’t sent wisdom in N seconds, send a soft tick
    const softKick = setTimeout(() => {
      if (!res.writableEnded) {
        res.write(`event: tick\ndata: ${JSON.stringify({ status: 'warming_up' })}\n\n`);
      }
    }, 5000);

    // Stream from the mentor engine
    const stream = generateMentorResponse(mentor, actualUserText, String(preset).toLowerCase(), options || {});

    stream.on('data', (chunk) => {
      try {
        // Accept both "string" and { text, ... }
        const raw = typeof chunk === 'string' ? chunk : (chunk?.text || '');
        // 1) normalize unicode to plain ASCII, kill weird bullets/emoji/zero-width
        const cleaned = asciiHardClean(normalizeMentorText(raw));
        // 2) ensure no SSE-breaking sequences
        const safe = sanitizeForSSE(cleaned);

        const payload = {
          ...(typeof chunk === 'object' && chunk ? chunk : { type: 'wisdom' }),
          text: safe
        };

        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch {
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'sanitize_failed' })}\n\n`);
      }
    });

    stream.on('end', () => {
      clearInterval(keepAlive);
      clearTimeout(softKick);
      if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      }
    });

    stream.on('error', (err) => {
      clearInterval(keepAlive);
      clearTimeout(softKick);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream error occurred', details: err?.message || 'unknown' });
      } else if (!res.writableEnded) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'stream_error' })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      }
    });

    // cleanup if client disconnects
    req.on('close', () => {
      clearInterval(keepAlive);
      clearTimeout(softKick);
      try { stream.removeAllListeners(); } catch {}
    });
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate mentor response', details: error?.message });
    } else if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'controller_crash' })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    }
  }
};
