// controllers/mentorController.js
const { getMentorResponse } = require('../services/aiService');

function badRequest(res, msg, received = {}) {
  return res.status(400).json({ error: msg, received });
}

exports.mentorHealth = (_req, res) => {
  res.json({
    ok: true,
    route: '/api/v1/mentor/json',
    hasKey: !!process.env.TOGETHER_AI_KEY,
    ts: new Date().toISOString(),
  });
};

// JSON (no streaming) — reliable and easy to debug
exports.mentorJSON = async (req, res) => {
  try {
    const { mentor, user_text, userText, preset, options } = req.body || {};
    const text = user_text || userText;

    if (!mentor || !text || !preset) {
      return badRequest(res, 'Missing required fields: mentor, user_text|userText, preset', {
        mentor: !!mentor, user_text: !!text, preset: !!preset
      });
    }

    // Call AI; aiService will NEVER throw — it returns a fallback if anything goes wrong.
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
    console.error('mentorJSON hard error:', e?.response?.data || e?.message || e);
    return res.status(500).json({ error: 'mentor_json_failed', msg: String(e?.message || e) });
  }
};

// Small echo to verify the app is posting the right shape
exports.mentorEcho = (req, res) => {
  res.json({ ok: true, body: req.body });
};
