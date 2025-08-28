// utils/mentorResponse.js — emits clean SSE-friendly mentor wisdom
const EventEmitter = require('events');
const { getMentorResponse } = require('../services/aiService');
const { sanitizeForSSE } = require('./textSanitizer');

function emitOnce(emitter, type, text, meta = {}) {
  const clean = sanitizeForSSE(text);
  emitter.emit('data', {
    type: 'wisdom',
    text: clean,
    ...meta,
  });
  emitter.emit('end');
}

exports.generateMentorResponse = (mentor, userText, preset, options) => {
  const emitter = new EventEmitter();

  // Fire async, then emit sanitized payload once (your Together API isn’t a token stream)
  (async () => {
    try {
      const resp = await getMentorResponse(mentor, userText, preset, options);
      emitOnce(emitter, 'wisdom', resp.response, {
        mentor,
        preset,
        viral_score: resp.viralScore || 85,
        wisdom_level: 'legendary',
        timestamp: resp.timestamp,
      });
    } catch (err) {
      const fallback = `Here’s the uncomfortable truth: you talk like permission, not gravity. Speak like an experience—set the myth, host the plan, close cleanly.\n\nLaw: Lead the frame or lose it.`;
      emitOnce(emitter, 'wisdom', fallback, {
        mentor,
        preset,
        viral_score: 85,
        wisdom_level: 'legendary_fallback',
        fallback: true,
        timestamp: new Date().toISOString(),
      });
    }
  })();

  return emitter;
};

// (Optional) export if you want to reuse sanitizer elsewhere
exports._sanitizeForSSE = sanitizeForSSE;
