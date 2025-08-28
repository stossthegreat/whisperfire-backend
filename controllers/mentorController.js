// controllers/mentorController.js
const { generateMentorResponse } = require('../utils/mentorResponse');

exports.mentorsChat = (req, res) => {
  try {
    const { mentor, user_text, userText, preset, options } = req.body || {};
    const actualUserText = user_text || userText;

    if (!mentor || !actualUserText || !preset) {
      return res.status(400).json({
        error: 'Missing required fields: mentor, user_text (or userText), preset'
      });
    }

    // SSE headers with explicit UTF-8 (prevents Â / mojibake)
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // for Nginx
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Flush a prelude line to lock encoding on some proxies
    res.write(':' + Array(2049).join(' ') + '\n'); // 2KB padding
    res.write('event: init\n');
    res.write(`data: ${JSON.stringify({ ok: true })}\n\n`);

    // Heartbeat every 15s so connections don’t die
    const heartbeat = setInterval(() => {
      try { res.write(': ping\n\n'); } catch {}
    }, 15000);

    const stream = generateMentorResponse(mentor, actualUserText, preset, options);

    stream.on('data', (chunk) => {
      // chunk.text is already normalized & paragraphized in utils
      const payload = {
        type: chunk.type || 'wisdom',
        text: chunk.text,
        mentor,
        preset,
        viral_score: chunk.viral_score || 0,
        wisdom_level: chunk.wisdom_level || 'legendary',
        fallback: !!chunk.fallback,
        timestamp: chunk.timestamp
      };
      // Ensure UTF-8 write
      res.write(`data: ${JSON.stringify(payload)}\n\n`, 'utf8');
    });

    stream.on('end', () => {
      clearInterval(heartbeat);
      res.write('data: {"done": true}\n\n', 'utf8');
      res.end();
    });

    stream.on('error', (err) => {
      clearInterval(heartbeat);
      console.error('SSE error:', err);
      try {
        res.write(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`, 'utf8');
        res.write('data: {"done": true}\n\n', 'utf8');
      } finally {
        res.end();
      }
    });
  } catch (err) {
    console.error('mentorController fatal:', err);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Failed to start mentor stream' });
    }
    try {
      res.write(`data: ${JSON.stringify({ error: 'Internal failure' })}\n\n`, 'utf8');
      res.write('data: {"done": true}\n\n', 'utf8');
    } finally {
      res.end();
    }
  }
};
