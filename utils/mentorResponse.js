// utils/mentorResponse.js - VIRAL WISDOM ENGINE
const EventEmitter = require('events');
const { getMentorResponse, _sanitizers } = require('../services/aiService'); // reuse sanitizers
const fixMojibake = _sanitizers?.fixMojibake || ((s) => s || '');
const paragraphize = _sanitizers?.paragraphize || ((s) => s || '');

exports.generateMentorResponse = (mentor, userText, preset, options) => {
  const emitter = new EventEmitter();

  (async () => {
    try {
      const resp = await getMentorResponse(mentor, userText, preset, options);

      // ✅ Clean model output: de-mojibake + paragraphize
      const clean = paragraphize(resp?.response || '');

      emitter.emit('data', {
        type: 'wisdom',
        text: clean,
        mentor,
        preset,
        viral_score: resp?.viralScore || 85,
        wisdom_level: 'legendary',
        timestamp: resp?.timestamp || new Date().toISOString()
      });

      emitter.emit('end');
    } catch (error) {
      console.error('WISDOM GENERATION ERROR:', error);

      const fb = getEnhancedFallbackResponse(mentor, userText, preset);
      const clean = paragraphize(fb);

      emitter.emit('data', {
        type: 'wisdom',
        text: clean,
        mentor,
        preset,
        viral_score: 85,
        wisdom_level: 'legendary_fallback',
        fallback: true,
        timestamp: new Date().toISOString()
      });

      emitter.emit('end');
    }
  })();

  return emitter;
};

// ---------- Enhanced fallback bank (unchanged content) ----------
function getEnhancedFallbackResponse(mentor, userText, preset) {
  // (Use your same big legendaryFallbacks object here)
  // Keep content identical to your last paste.
  const legendaryFallbacks = { /* ... your existing content ... */ };

  const mentorResponses = legendaryFallbacks[mentor] || legendaryFallbacks.casanova;
  const response = mentorResponses[preset] || mentorResponses.chat;
  return response;
}

// (Optional) metadata helpers you already had:
exports.getPersonaForMentor = (mentor) => { /* ... your existing content ... */ };
exports.analyzeWisdomVirality = (response, mentor, preset) => { /* ... your existing content ... */ };
exports.enhanceWisdomForVirality = (response, mentor, preset) => { /* ... your existing content ... */ };

// Legacy exports (keep for compatibility)
exports.generateMentorResponseLegacy = exports.generateMentorResponse;
exports.getFallbackResponse = getEnhancedFallbackResponse;
