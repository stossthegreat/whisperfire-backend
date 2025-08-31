// controllers/mentorController.js
const { generateMentorResponse } = require('../utils/mentorResponse');
const { getMentorResponse } = require('../services/aiService');
const { sanitizeForSSE, normalizeParagraphs } = require('../utils/textSanitizer');

/**
 * Mentor chat route
 * - JSON mode (default) — works with Flutter http/dio
 * - SSE mode (only if options.stream === true OR ?stream=1)
 */
exports.mentorsChat = async (req, res) => {
  try {
    const { mentor, user_text, userText, preset, options } = req.body || {};
    const actualUserText = user_text || userText;
    const wantStream =
      (options && options.stream === true) ||
      String(req.query.stream || '').trim() === '1';

    if (!mentor || !actualUserText || !preset) {
      return res.status(400).json({
        error: 'Missing required fields: mentor, user_text, and preset are required',
        received: { mentor: !!mentor, user_text: !!actualUserText, preset: !!preset }
      });
    }

    // ────────────────────────
    // JSON MODE (DEFAULT)
    // ────────────────────────
    if (!wantStream) {
      // Get a single response and return JSON (Flutter-friendly)
      const out = await getMentorResponse(mentor, actualUserText, preset, options);
      // Clean paragraphs + kill weird characters before sending
      const cleaned = normalizeParagraphs(out.response);
      return res.json({
        success: true,
        data: {
          ...out,
          response: cleaned,
          context: {
            mentor,
            preset,
            user_query: String(actualUserText).slice(0, 200),
            response_type: 'legendary_wisdom',
            timestamp: new Date().toISOString()
          }
        }
      });
    }

    // ────────────────────────
    // SSE MODE (EXPLICIT)
    // ────────────────────────
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Keep-alive ping (prevents idle proxies from closing the pipe)
    const keepAlive = setInterval(() => {
      if (!res.writableEnded) res.write(`: ping\n\n`);
    }, 15000);

    // Tell client we’re live
    res.write(`data: ${JSON.stringify({
      type: 'init',
      mentor,
      preset,
      ts: new Date().toISOString()
    })}\n\n`);

    const stream = generateMentorResponse(mentor, actualUserText, preset, options);

    stream.on('data', (chunk) => {
      try {
        const raw = typeof chunk === 'string' ? chunk : (chunk?.text || '');
        const clean = sanitizeForSSE(raw);
        // Also enforce paragraph breaks so it isn't a blob
        const paragraphed = normalizeParagraphs(clean);
        const payload = { ...(chunk || {}), text: paragraphed };
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch (e) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'sanitize_failed' })}\n\n`);
      }
    });

    stream.on('end', () => {
      res.write(`data: ${JSON.stringify({ type: 'complete', done: true })}\n\n`);
      clearInterval(keepAlive);
      res.end();
    });

    stream.on('error', (err) => {
      clearInterval(keepAlive);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Stream error occurred', details: err?.message });
      } else {
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'stream_error' })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'complete', done: true })}\n\n`);
        res.end();
      }
    });
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to generate mentor response', details: error?.message });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'generation_failed' })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'complete', done: true })}\n\n`);
      res.end();
    }
  }
};
