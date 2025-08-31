// utils/mentorResponse.js — CLEAN & PARAGRAPHED STREAM
// - Always sanitize + paragraph the model output (JSON and SSE).
// - Kills “Â” (NBSP/Latin-1 mojibake), smart quotes, stray BOM.
// - Normalizes bullets and ensures blank lines between paragraphs.

const EventEmitter = require('events');
const { getMentorResponse } = require('../services/aiService');
const { normalizeParagraphs } = require('./textSanitizer'); // <- we’ll use this everywhere

// Stream generator (compatible with SSE)
exports.generateMentorResponse = (mentor, userText, preset, options = {}) => {
  const emitter = new EventEmitter();

  // Fetch once from the model (we’re not chunking tokens from Together)
  getMentorResponse(mentor, userText, preset, options)
    .then((out) => {
      const clean = normalizeParagraphs(out.response);
      emitter.emit('data', {
        type: 'wisdom',
        text: clean,
        mentor,
        preset,
        viral_score: out.viralScore || 85,
        timestamp: out.timestamp
      });
      emitter.emit('end');
    })
    .catch((err) => {
      const fallback = normalizeParagraphs(
        `Here’s the uncomfortable truth: you talk like permission, not gravity. 
Speak like an experience—set the myth, host the plan, close cleanly.

Law: Lead the frame or lose it.`
      );
      emitter.emit('data', {
        type: 'wisdom',
        text: fallback,
        mentor,
        preset,
        viral_score: 84,
        fallback: true,
        timestamp: new Date().toISOString()
      });
      emitter.emit('end');
    });

  return emitter;
};

module.exports = {
  generateMentorResponse: exports.generateMentorResponse
};
