// controllers/mentorController.js
// Clean SSE mentor chat with UTF-8 sanitization and robust error handling

const { generateMentorResponse } = require('../utils/mentorResponse');

// tiny sanitizer to kill smart quotes / NBSP / stray bytes (Â, �)
function cleanText(s) {
  return String(s || '')
    .replace(/\u00A0/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\uFFFD/g, '') // replacement char
    .replace(/Â/g, '')      // common stray byte
    .replace(/\s{2,}/g, ' ')
    .trim();
}

exports.mentorsChat = (req, res) => {
  try {
    const { mentor, user_text, userText, preset, options } = req.body || {};
    const actualUserText = user_text || userText;
    const mode = preset || 'chat';

    // Basic validation
    if (!mentor || !actualUserText || !mode) {
      return res.status(400).json({
        error: 'Missing required fields: mentor, user_text (or userText), and preset',
        received: { mentor, user_text: actualUserText, preset: mode }
      });
    }

    console.log(`👂 Mentor chat: mentor=${mentor}, preset=${mode}, text="${actualUserText?.slice(0, 120)}${actualUserText?.length > 120 ? '…' : ''}"`);

    // SSE headers
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // nginx: disable buffering
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control, Content-Type');

    // Keep-alive heartbeat (prevents proxies from closing)
    const heartbeat = setInterval(() => {
      try { res.write(`: ping\n\n`); } catch (_) {}
    }, 15000);

    const endStream = () => {
      clearInterval(heartbeat);
      try {
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
      } catch (_) {}
    };

    // Start generator (EventEmitter) from utils
    const emitter = generateMentorResponse(mentor, actualUserText, mode, options);

    emitter.on('data', (chunk) => {
      try {
        const payload = {
          ...chunk,
          text: cleanText(chunk?.text),
        };
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
      } catch (e) {
        console.error('SSE write error:', e);
      }
    });

    emitter.on('end', () => {
      endStream();
    });

    emitter.on('error', (err) => {
      console.error('SSE stream error:', err);
      try {
        res.write(`data: ${JSON.stringify({ error: 'Failed to generate response' })}\n\n`);
      } catch (_) {}
      endStream();
    });

    // If client disconnects
    req.on('close', () => {
      console.log('🔌 Client closed SSE connection');
      clearInterval(heartbeat);
    });

  } catch (error) {
    console.error('Mentor chat fatal error:', error);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to generate mentor response' });
    }
    try {
      res.write(`data: ${JSON.stringify({ error: 'Failed to generate response' })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (_) {}
  }
};
