// controllers/mentorController.js
const { getMentorResponse, toCleanText } = require('../services/aiService');

exports.mentorsChat = async (req, res) => {
  try {
    const { mentor, user_text, userText, preset } = req.body || {};
    const actualUserText = user_text || userText;

    if (!mentor || !actualUserText || !preset) {
      return res.status(400).json({
        error: 'Missing required fields: mentor, user_text/userText, preset'
      });
    }

    // SSE headers with UTF-8
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    const { response } = await getMentorResponse(mentor, actualUserText, preset);
    const clean = toCleanText(response);

    res.write(`data: ${JSON.stringify({ text: clean, mentor, preset })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  } catch (e) {
    console.error('mentorsChat error:', e.message);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Mentor response failed' });
    }
    res.write(`data: ${JSON.stringify({ error: 'Mentor response failed' })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
  }
};
