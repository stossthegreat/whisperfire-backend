// controllers/mentorController.js
const { generateMentorResponse } = require('../utils/mentorResponse');
const { sanitizeForSSE, normalizeMentorText, asciiHardClean } = require('../utils/textSanitizer');

const VALID_PRESETS = new Set(['chat', 'roleplay', 'advise', 'drill']);

function readParams(req) {
  // Support POST (body) and GET (query) so EventSource works too
  const src = (req.method === 'GET') ? (req.query || {}) : (req.body || {});
  const { mentor, user_text, userText, preset, ...rest } = src;
  return {
    mentor: mentor && String(mentor).trim(),
    preset: preset && String(preset).toLowerCase().trim(),
    userText: (user_text || userText) && String(user_text || userText),
    options: rest.options || rest // allow options in either shape
  };
}

function openSSE(res) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx: disable buffering
  // Some stacks need this to actually flush headers now
  if (typeof res.flushHeaders === 'function') res.flushHeaders();
}

function writeEvent(res, event, data) {
  if (event) res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

exports.mentorsChat = (req, res) => {
  try {
    const { mentor, preset, userText, options } = readParams(req);

    if (!mentor || !userText || !preset || !VALID_PRESETS.has(preset)) {
      return res.status(400).json({
        error: 'Missing/invalid fields. Required: mentor, user_text, preset in {chat|roleplay|advise|drill}',
        received: { mentor: !!mentor, user_text: !!userText, preset }
      });
    }

    // If client didn't ask for SSE, return a plain JSON response (fallback)
    const wantsSSE =
      /text\/event-stream/.test(String(req.headers.accept || '')) ||
      String(req.headers['x-wf-sse'] || '') === '1';

    if (!wantsSSE) {
      // Non-SSE fallback (blocking)
      const stream = generateMentorResponse(mentor, userText, preset, options || {});
      let finalText = '';
      stream.on('data', (chunk) => {
        const raw = typeof chunk === 'string' ? chunk : (chunk?.text || '');
        finalText += raw + '\n';
      });
      stream.on('end', () => {
        const clean = sanitizeForSSE(asciiHardClean(normalizeMentorText(finalText))).trim();
        return res.json({
          success: true,
          data: {
            mentor,
            preset,
            text: clean,
            streamed: false,
            timestamp: new Date().toISOString()
          }
        });
      });
      stream.on('error', (err) => {
        return res.status(500).json({ error: 'mentor_stream_failed', details: err?.message || 'unknown' });
      });
      return;
    }

    // SSE path
    openSSE(res);

    // Keep-alive pings
    const keepAlive = setInterval(() => {
      if (!res.writableEnded) res.write(`: ping\n\n`);
    }, 15000);

    // Immediate open event so UI knows it's live
    writeEvent(res, 'open', { ok: true, mentor, preset });

    // Soft “warming up” tick if model is slow
    const softKick = setTimeout(() => {
      if (!res.writableEnded) writeEvent(res, 'tick', { status: 'warming_up' });
    }, 4000);

    // Start mentor stream
    const stream = generateMentorResponse(mentor, userText, preset, options || {});

    stream.on('data', (chunk) => {
      try {
        const raw = typeof chunk === 'string' ? chunk : (chunk?.text || '');
        const cleaned = sanitizeForSSE(asciiHardClean(normalizeMentorText(raw)));
        const payload = { ...(typeof chunk === 'object' ? chunk : { type: 'wisdom' }), text: cleaned };
        writeEvent(res, '', payload); // default message event
      } catch {
        writeEvent(res, 'error', { error: 'sanitize_failed' });
      }
    });

    stream.on('end', () => {
      clearInterval(keepAlive);
      clearTimeout(softKick);
      if (!res.writableEnded) {
        writeEvent(res, '', { done: true });
        res.end();
      }
    });

    stream.on('error', (err) => {
      clearInterval(keepAlive);
      clearTimeout(softKick);
      if (!res.headersSent) {
        res.status(500).json({ error: 'stream_error', details: err?.message || 'unknown' });
      } else if (!res.writableEnded) {
        writeEvent(res, 'error', { error: 'stream_error' });
        writeEvent(res, '', { done: true });
        res.end();
      }
    });

    // Client disconnected
    req.on('close', () => {
      clearInterval(keepAlive);
      clearTimeout(softKick);
      try { stream.removeAllListeners(); } catch {}
    });
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ error: 'mentor_controller_crash', details: error?.message });
    } else if (!res.writableEnded) {
      writeEvent(res, 'error', { error: 'controller_crash' });
      writeEvent(res, '', { done: true });
      res.end();
    }
  }
};
