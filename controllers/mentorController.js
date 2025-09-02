// controllers/mentorController.js
// Minimal, surgical fix: UTF-8 charset + smart-quote cleanup + paragraph spacing.
// Does NOT change your prompts or analysis code. Just cleans Mentor output.

const { getMentorResponse } = require('../services/aiService');

/* ---------- tiny cleaners (safe) ---------- */
function toAsciiQuotes(s = '') {
  return String(s)
    // kill mojibake roots
    .replace(/Â+/g, '')
    // smart quotes/dashes → ASCII
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, '-')
    // stray encodes of apostrophe
    .replace(/â€™/g, "'")
    .replace(/\u00A0/g, ' ');
}

function stripWeirdMarkdown(s = '') {
  return String(s)
    .replace(/^[\*\u2022\-]{1,2}\s*/gm, '') // leading bullets
    .replace(/[>`_#]/g, '');                // stray md chars
}

function paragraphize(s = '') {
  // add a blank line after sentence end if it’s jammed
  let t = String(s)
    .replace(/([a-z0-9\)\]"'])([.!?])\s+(?=[A-Z0-9"'\(])/g, '$1$2\n\n')
    .replace(/([a-z0-9])([.!?])([A-Z])/g, '$1$2 $3'); // fix glued caps
  t = t.replace(/\n{3,}/g, '\n\n')
       .replace(/[ \t]+\n/g, '\n')
       .replace(/[ \t]{2,}/g, ' ');
  return t.trim();
}

function cleanMentorText(s = '') {
  return paragraphize(stripWeirdMarkdown(toAsciiQuotes(s)));
}

/* ---------- controller ---------- */
exports.mentorsChat = async (req, res) => {
  try {
    const { mentor, user_text, userText, preset, options } = req.body || {};
    const actualUserText = user_text || userText;

    if (!mentor || !actualUserText || !preset) {
      // ensure JSON path also declares utf-8
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(400).json({
        error: 'Missing required fields: mentor, user_text, and preset are required',
        received: { mentor: !!mentor, user_text: !!actualUserText, preset: !!preset }
      });
    }

    const useStream = !!(options && options.stream);

    if (!useStream) {
      // JSON mode — force utf-8 and clean text
      const out = await getMentorResponse(mentor, actualUserText, preset, options || {});
      const text = cleanMentorText(out.response);
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
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

    // SSE mode — **critical**: include charset
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
      const text = cleanMentorText(out.response);

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
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
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
