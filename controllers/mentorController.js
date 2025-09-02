// controllers/mentorController.js
// Mentor SSE/JSON controller with hard UTF-8 clean + paragraph shaping

const { getMentorResponse } = require('../services/aiService');

// --- Text cleaners (pure functions, no external deps) ---
function fixSmartQuotes(s = '') {
  return String(s)
    .replace(/Â+/g, '')                             // stray Â
    .replace(/â€™|Ã¢â‚¬â„¢|â\u0080\u0099/g, "'")   // right single
    .replace(/â€˜|Ã¢â‚¬Ëœ|â\u0080\u0098/g, "'")    // left single
    .replace(/â€œ|Ã¢â‚¬Å“|â\u0080\u009C/g, '"')    // left double
    .replace(/â€�|Ã¢â‚¬Â|â\u0080\u009D/g, '"')    // right double
    .replace(/â€”|Ã¢â‚¬â¢|â\u0080\u0094/g, '—')  // em dash
    .replace(/â€“|Ã¢â‚¬â€œ|â\u0080\u0093/g, '–')   // en dash
    .replace(/\u00A0/g, ' ');                      // NBSP → space
}

function stripWeirdGlyphs(s = '') {
  return String(s)
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width junk
    .replace(/^[\*\u2022\-]{1,2}\s*/gm, '') // leading bullets/asterisks
    .replace(/[>`_#]/g, '');                // stray markdown tokens
}

// Enforce readable paragraphs from plain text
function paragraphize(s = '') {
  let t = fixSmartQuotes(stripWeirdGlyphs(String(s)));

  // Add a space after sentence punctuation if glued to a capital/quote
  t = t.replace(/([a-z0-9])([.!?])([A-Z"'])/g, '$1$2 $3');

  // Break around section labels so they start new blocks
  t = t.replace(/\s*(?=(?:Diagnosis:|Psychology:|Plays|Lines:|Close:|Principle:|Principles:|Law:|Use:|Boundary|Recovery))/g, '\n\n');

  // Turn single-line bulleted-ish runs into real bullets
  t = t.replace(/(^|\n)\s*(?:-|\u2022|\*)\s+/g, '\n• ');

  // Encourage paragraphs after sentence stops
  t = t.replace(/([.!?])\s+(?=[A-Z0-9"'\(])/g, '$1\n\n');

  // Collapse excessive blank lines / spaces
  t = t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');

  return t.trim();
}

function sanitizeForSSE(s = '') {
  return String(s).replace(/\r/g, '').replace(/\u0000/g, '');
}

function cleanMentorText(s = '') {
  return paragraphize(s);
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
      // JSON mode
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
