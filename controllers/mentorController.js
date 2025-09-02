// controllers/mentorController.js
// Crash-proof Mentor SSE/JSON controller with UTF-8 clean + paragraph shaping

const { getMentorResponse } = require('../services/aiService');

/* ---------- text cleaners ---------- */
function fixSmartQuotes(s = '') {
  return String(s)
    .replace(/Â+/g, '')
    .replace(/â€™|Ã¢â‚¬â„¢|â\u0080\u0099/g, "'")
    .replace(/â€˜|Ã¢â‚¬Ëœ|â\u0080\u0098/g, "'")
    .replace(/â€œ|Ã¢â‚¬Å“|â\u0080\u009C/g, '"')
    .replace(/â€�|Ã¢â‚¬Â|â\u0080\u009D/g, '"')
    .replace(/â€”|Ã¢â‚¬â¢|â\u0080\u0094/g, '—')
    .replace(/â€“|Ã¢â‚¬â€œ|â\u0080\u0093/g, '–')
    .replace(/\u00A0/g, ' ');
}
function stripWeirdGlyphs(s = '') {
  return String(s)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/^[\*\u2022\-]{1,2}\s*/gm, '')
    .replace(/[>`_#]/g, '');
}
function paragraphize(s = '') {
  let t = fixSmartQuotes(stripWeirdGlyphs(String(s)));
  t = t.replace(/([a-z0-9])([.!?])([A-Z"'])/g, '$1$2 $3');
  t = t.replace(/\s*(?=(?:Diagnosis:|Psychology:|Plays|Lines:|Close:|Principle:|Principles:|Law:|Use:|Boundary|Recovery))/g, '\n\n');
  t = t.replace(/(^|\n)\s*(?:-|\u2022|\*)\s+/g, '\n• ');
  t = t.replace(/([.!?])\s+(?=[A-Z0-9"'\(])/g, '$1\n\n');
  t = t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  return t.trim();
}
function cleanMentorText(s = '') { return paragraphize(s); }
function sendJson(res, payload, status = 200) {
  if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
  return res.status(status).json(payload);
}

/* ---------- controller ---------- */
exports.mentorsChat = async (req, res) => {
  // hard guard: if Express has a server timeout, extend a bit for Together
  res.setTimeout?.(125000);

  try {
    const { mentor, user_text, userText, preset, options } = req.body || {};
    const actualUserText = user_text || userText;

    if (!mentor || !actualUserText || !preset) {
      return sendJson(res, {
        error: 'Missing required fields: mentor, user_text, and preset are required',
        received: { mentor: !!mentor, user_text: !!actualUserText, preset: !!preset }
      }, 400);
    }

    const useStream = !!(options && options.stream);

    // ---------- JSON MODE ----------
    if (!useStream) {
      try {
        const out = await getMentorResponse(mentor, actualUserText, preset, options || {});
        const text = cleanMentorText(out.response);
        return sendJson(res, {
          success: true,
          data: {
            mentor,
            preset,
            response: text,
            timestamp: out.timestamp,
            viralScore: out.viralScore ?? 80
          }
        });
      } catch (e) {
        return sendJson(res, {
          error: 'Failed to generate mentor response',
          details: process.env.NODE_ENV === 'development' ? cleanMentorText(e.message) : undefined
        }, 500);
      }
    }

    // ---------- SSE MODE ----------
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    let closed = false;
    const safeWrite = chunk => {
      if (!closed && res.writable && !res.writableEnded) {
        try { res.write(chunk); } catch { /* ignore write-after-end */ }
      }
    };
    const endStream = () => {
      if (!closed) {
        closed = true;
        try { safeWrite(`data: ${JSON.stringify({ type: 'complete', done: true })}\n\n`); } catch {}
        try { res.end(); } catch {}
      }
    };

    // clean up on client disconnects (prevents crashes/memory leaks)
    const onClose = () => { closed = true; clearInterval(keepAlive); };
    req.on('close', onClose);
    req.on('aborted', onClose);
    res.on('close', onClose);
    res.on('error', onClose);

    const keepAlive = setInterval(() => safeWrite(`: ping\n\n`), 15000);

    safeWrite(`data: ${JSON.stringify({
      type: 'meta',
      status: 'started',
      mentor,
      preset,
      ts: new Date().toISOString()
    })}\n\n`);

    try {
      const out = await getMentorResponse(mentor, actualUserText, preset, options || {});
      const text = cleanMentorText(out.response);

      safeWrite(`data: ${JSON.stringify({
        type: 'wisdom',
        mentor,
        preset,
        text,
        viralScore: out.viralScore ?? 80
      })}\n\n`);
    } catch (e) {
      safeWrite(`data: ${JSON.stringify({ type: 'error', error: 'mentor_failed' })}\n\n`);
    } finally {
      clearInterval(keepAlive);
      endStream();
    }
  } catch (error) {
    if (!res.headersSent) {
      return sendJson(res, {
        error: 'Failed to generate mentor response',
        details: process.env.NODE_ENV === 'development' ? cleanMentorText(error.message) : undefined
      }, 500);
    }
    try { res.end(); } catch {}
  }
};
