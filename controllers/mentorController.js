// controllers/mentorController.js
const { getMentorResponse } = require('../services/aiService');

exports.mentorHealth = (_req, res) => {
  res.json({ ok: true, route: '/mentor/json', ts: new Date().toISOString() });
};

// Simple JSON endpoint (reliable, no streaming)
exports.mentorJSON = async (req, res) => {
  try {
    const { mentor, user_text, userText, preset, options } = req.body || {};
    const text = user_text || userText;

    if (!mentor || !text || !preset) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['mentor', 'user_text|userText', 'preset'],
        received: { mentor: !!mentor, user_text: !!text, preset: !!preset }
      });
    }

    const result = await getMentorResponse(mentor, text, preset, options);
    return res.json({
      success: true,
      data: {
        mentor,
        preset,
        response: result.response,
        viral_score: result.viralScore || 85,
        timestamp: result.timestamp,
        fallback: !!result.fallback
      }
    });
  } catch (e) {
    console.error('mentorJSON error:', e?.response?.data || e?.message);
    return res.status(500).json({ error: 'mentor_json_failed' });
  }
};
