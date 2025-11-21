// controllers/mentorController.js
// Mentor SSE/JSON controller with bullet-proof UTF-8 + spacing + markdown/glyph scrub.
// Now with full memory integration (Redis, Postgres, ChromaDB)

const { getMentorResponse } = require('../services/aiService');
const {
  buildMemoryContext,
  storeRecentMessage,
  storeMentorConversation
} = require('../services/memoryService');

/* ---------- cleaners (order matters) ---------- */
function killMojibake(s = '') {
  return String(s)
    .replace(/Â+/g, '') // common root
    // smart quotes/dashes variants
    .replace(/â€™|Ã¢â‚¬â„¢|â\u0080\u0099/g, "'")
    .replace(/â€˜|Ã¢â‚¬Ëœ|â\u0080\u0098/g, "'")
    .replace(/â€œ|Ã¢â‚¬Å“|â\u0080\u009C/g, '"')
    .replace(/â€�|Ã¢â‚¬Â|â\u0080\u009D/g, '"')
    .replace(/â€”|Ã¢â‚¬â¢|â\u0080\u0094/g, '—')
    .replace(/â€“|Ã¢â‚¬â€œ|â\u0080\u0093/g, '–')
    .replace(/\u00A0/g, ' ')              // NBSP
    .replace(/[\u200B-\u200D\uFEFF]/g, ''); // zero-width junk
}

function stripWeirdMarkdown(s = '') {
  return String(s)
    .replace(/^[\*\u2022\-]{1,2}\s*/gm, '') // leading bullets
    .replace(/[>`_#]/g, '');                // stray md chars
}

// Makes readable paragraphs without changing your text content.
function paragraphize(s = '') {
  let t = stripWeirdMarkdown(killMojibake(String(s)));

  // De-glue "...end.Next" → "...end. Next"
  t = t.replace(/([a-z0-9\)\]"'])([.!?])([A-Z"'])/g, '$1$2 $3');

  // New paragraph after sentence end when followed by capital/quote/number
  t = t.replace(/([.!?])\s+(?=[A-Z0-9"'\(])/g, '$1\n\n');

  // Start common labels on new blocks
  t = t.replace(
    /\s*(?=(?:Diagnosis:|Psychology:|Plays|Lines:|Close:|Principle:|Principles:|Law:|Use:|Boundary|Recovery|Drill:|Advice:|Roleplay:))/g,
    '\n\n'
  );

  // Normalize bullets to readable "• "
  t = t.replace(/(^|\n)\s*(?:-|\u2022|\*)\s+/g, '\n• ');

  // Tidy whitespace
  t = t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();

  return t;
}

function sanitizeForSSE(s = '') {
  return String(s).replace(/\r/g, '').replace(/\u0000/g, '');
}

function cleanMentorText(s = '') {
  return paragraphize(s);
}

/* ---------- controller ---------- */
exports.mentorsChat = async (req, res) => {
  try {
    const { mentor, user_text, userText, preset, options, user_id } = req.body || {};
    const actualUserText = user_text || userText;
    const userId = user_id || 'anonymous'; // Track user for memory
    const sessionId = req.headers['x-session-id'] || `session_${Date.now()}`;

    // Log incoming mentor request
    console.log(`💬 Mentor request: ${mentor} | preset: ${preset} | user: ${userId}`);

    if (!mentor || !actualUserText || !preset) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.status(400).json({
        error: 'Missing required fields: mentor, user_text, and preset are required',
        received: { mentor: !!mentor, user_text: !!actualUserText, preset: !!preset }
      });
    }

    const useStream = !!(options && options.stream);
    
    // ===== BUILD MEMORY CONTEXT =====
    let memoryContext = null;
    try {
      memoryContext = await buildMemoryContext(userId, mentor, actualUserText);
    } catch (err) {
      console.warn('Memory context failed:', err.message);
    }
    
    // Store user message in memory systems
    try {
      await storeRecentMessage(userId, mentor, {
        text: actualUserText,
        sender: 'user',
        preset,
        timestamp: new Date().toISOString()
      });
      
      await storeMentorConversation(
        userId,
        mentor,
        actualUserText,
        'user',
        preset,
        sessionId
      );
    } catch (err) {
      console.warn('Failed to store user message:', err.message);
    }

    if (!useStream) {
      // JSON mode (clean + utf-8) with memory injection
      const out = await getMentorResponse(
        mentor,
        actualUserText,
        preset,
        { ...options, memoryContext }
      );
      const text = cleanMentorText(out.response);
      
      // Store mentor response in memory
      try {
        await storeRecentMessage(userId, mentor, {
          text: text,
          sender: 'mentor',
          preset,
          timestamp: new Date().toISOString()
        });
        
        await storeMentorConversation(
          userId,
          mentor,
          text,
          'mentor',
          preset,
          sessionId
        );
      } catch (err) {
        console.warn('Failed to store mentor response:', err.message);
      }
      
      console.log(`✅ Mentor response sent: ${mentor} (${text.substring(0, 50)}...)`);
      
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      // prevent middlewares/proxies from transforming encoding
      res.setHeader('Cache-Control', 'no-transform');
      res.setHeader('X-Content-Type-Options', 'nosniff');
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

    // SSE mode (make sure compression is skipped upstream for event-stream)
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

      const out = await getMentorResponse(
        mentor,
        actualUserText,
        preset,
        { ...options, memoryContext }
      );
      const text = sanitizeForSSE(cleanMentorText(out.response));
      
      // Store mentor response in memory
      try {
        await storeRecentMessage(userId, mentor, {
          text: text,
          sender: 'mentor',
          preset,
          timestamp: new Date().toISOString()
        });
        
        await storeMentorConversation(
          userId,
          mentor,
          text,
          'mentor',
          preset,
          sessionId
        );
      } catch (err) {
        console.warn('Failed to store mentor response:', err.message);
      }

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
