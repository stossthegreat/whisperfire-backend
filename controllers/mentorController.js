// controllers/mentorController.js
// Stable, self-contained mentor SSE/JSON controller with hard text cleanup.

const { getMentorResponse } = require('../services/aiService');

// --- Inline cleaners (no external utils needed) ---
function normalizeWhitespace(s = '') {
  return String(s)
    .replace(/\u00A0/g, ' ')        // NBSP -> space
    .replace(/\s+\n/g, '\n')        // strip trailing spaces before \n
    .replace(/\n{3,}/g, '\n\n')     // max 2 line breaks
    .replace(/[ \t]{2,}/g, ' ')     // collapse spaces
    .trim();
}

function stripWeirdGlyphs(s = '') {
  return String(s)
    .replace(/Â+/g, '')                     // mojibake from bad UTF-8 decode
    .replace(/^[\*\u2022\-]{1,2}\s*/gm, '') // leading *, •, - bullets
    .replace(/[_`>#]/g, '');                // stray markdown markers
}

function paragraphize(s = '') {
  const blocks = String(s)
    .split(/\n{2,}|---+|\r\n\r\n/)          // split on double breaks or rules
    .map(x => normalizeWhitespace(x))
    .filter(Boolean);
  return blocks.join('\n\n');
}

function sanitizeForSSE(s = '') {
  // Remove nulls/CR; keep UTF-8
  return String(s).replace(/\r/g, '').replace(/\u0000/g, '');
}

// Final text pass
function cleanMentorText(s = '') {
  return paragraphize(stripWeirdGlyphs(s));
}

exports.mentorsChat = async (req, res) => {
  try {
    const { mentor, user_text, userText, preset, options } = req.body || {};
    const actualUserText = user_text || userText;

    if (!mentor || !actualUserText || !preset) {
      return res.status(400).json({
        error: 'Missing required fields: mentor, user_text, and preset are required',
        received: { mentor: !!mentor, user_text: !!actualUserText, preset: !!preset }
      });
    }

    const useStream = !!(options && options.stream);

    if (!useStream) {
      // Plain JSON mode — simplest to verify
      const out = await getMentorResponse(mentor, actualUserText, preset, options || {});
      const text = cleanMentorText(out.response);
      return res.json({
        success: true,
        data: {
          mentor,
          preset,
          response: text,
          timestamp: out.timestamp,
          viralScore: out.viralScore ?? 80
        }
      });
    }

    // SSE mode
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const keepAlive = setInterval(() => {
      if (!res.writableEnded) res.write(`: ping\n\n`);
    }, 15000);

    try {
      res.write(`data: ${JSON.stringify({
        type: 'meta',
        status: 'started',
        mentor,
        preset,
        ts: new Date().toISOString()
      })}\n\n`);

      const out = await getMentorResponse(mentor, actualUserText, preset, options || {});
      const text = sanitizeForSSE(cleanMentorText(out.response));

      res.write(`data: ${JSON.stringify({
        type: 'wisdom',
        mentor,
        preset,
        text,
        viralScore: out.viralScore ?? 80
      })}\n\n`);

      res.write(`data: ${JSON.stringify({ type: 'complete', done: true })}\n\n`);
      clearInterval(keepAlive);
      res.end();
    } catch (e) {
      clearInterval(keepAlive);
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'mentor_failed' })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'complete', done: true })}\n\n`);
      res.end();
    }
  } catch (error) {
    if (!res.headersSent) {
      return res.status(500).json({
        error: 'Failed to generate mentor response',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
    try {
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'unhandled' })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: 'complete', done: true })}\n\n`);
      res.end();
    } catch (_) {}
  }
};
