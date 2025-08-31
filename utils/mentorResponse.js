// utils/mentorResponse.js — VIRAL WISDOM ENGINE (sanitized)
// No extra imports required besides aiService. All cleaning is inline.

const EventEmitter = require('events');
const { getMentorResponse } = require('../services/aiService');

// --- Text cleaning to kill “Â”, weird stars, smart quotes, bullets, ZWSP, etc.
function deSmartQuotes(s='') {
  return s
    .replace(/[\u2018\u2019\u201A\u201B]/g, "'")
    .replace(/[\u201C\u201D\u201E]/g, '"')
    .replace(/\u2026/g, '...')
    .replace(/[\u2013\u2014]/g, '-') // en/em dash -> hyphen
    ;
}
function stripWeirdUtf8(s='') {
  // Common mis-decodes (â€™ â€œ â€ â€“ â€” â€¢) and lone Â
  return s
    .replace(/â€™/g, "'")
    .replace(/â€œ|â€/g, '"')
    .replace(/â€“|â€”/g, '-')
    .replace(/â€¢/g, '- ')
    .replace(/Â/g, '');
}
function asciiOnly(s='') {
  // bullets/emoji/markdown-stars -> ascii
  return s
    .replace(/\u2022/g, '- ')   // • -> -
    .replace(/[*_`#]/g, '')     // kill markdown artefacts
    .replace(/[\u00A0\u200B-\u200F\u202F\u2060]/g, ' ') // nbsp & zero-widths -> space
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, ''); // hard ASCII (tab, nl, cr, space..~)
}
function normalizeParagraphs(s='') {
  // Force clear blocks; ensure labels get their own line; collapse many blank lines
  let t = s.replace(/\r\n/g, '\n');
  // Ensure these tokens start on a new line
  t = t.replace(/\s*(Line:)/g, '\n$1')
       .replace(/\s*(Principle:)/g, '\n$1')
       .replace(/\s*(Law:)/g, '\n$1')
       .replace(/\s*(COMMAND:)/g, '\n$1')
       .replace(/\s*(Use:)/g, '\n$1');
  // Add an empty line before Law/Principle/Use/COMMAND if not already separated
  t = t.replace(/([^\n])\n(Law:|Principle:|Use:|COMMAND:)/g, '$1\n\n$2');
  // Collapse 3+ newlines -> 2
  t = t.replace(/\n{3,}/g, '\n\n');
  return t.trim();
}
function sanitizeMentorText(s) {
  return normalizeParagraphs(asciiOnly(stripWeirdUtf8(deSmartQuotes(String(s || '')))));
}

// --- PUBLIC: EventEmitter stream for mentor responses
exports.generateMentorResponse = (mentor, userText, preset, options) => {
  const emitter = new EventEmitter();

  getMentorResponse(mentor, userText, preset, options)
    .then(response => {
      const clean = sanitizeMentorText(response.response);
      emitter.emit('data', {
        type: 'wisdom',
        text: clean,
        mentor,
        preset,
        viral_score: response.viralScore || 85,
        wisdom_level: response.fallback ? 'legendary_fallback' : 'legendary',
        timestamp: response.timestamp
      });
      emitter.emit('end');
    })
    .catch(err => {
      const fallback =
`Here’s the brutal fix.

- Your language asks permission. Kill the questions.
- Set a vivid plan. You host, they join.
- Close with a clean binary.

COMMAND: Draft the line now. Send in 5 minutes.
Law: Invitation is not a question.`;
      emitter.emit('data', {
        type: 'wisdom',
        text: sanitizeMentorText(fallback),
        mentor,
        preset,
        viral_score: 84,
        wisdom_level: 'legendary_fallback',
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
