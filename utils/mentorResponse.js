// utils/mentorResponse.js — stream wrapper + output cleaners
const EventEmitter = require('events');
const { getMentorResponse } = require('../services/aiService'); // v4 you sent

/* ────────────────────────────────────────────────────────────
   OUTPUT SANITIZERS — kill mojibake + make real paragraphs
   ──────────────────────────────────────────────────────────── */

function fixMojibake(text) {
  if (!text) return '';
  let s = String(text);

  // Common UTF-8 ↔ win-1252 garbage
  s = s
    .replace(/â€™/g, "'")
    .replace(/â€œ|â€˜|Ã¢â‚¬Å“|Ã¢â‚¬Å’|â€�/g, '"')
    .replace(/â€”|Ã¢â‚¬â€�/g, '—')
    .replace(/â€“|Ã¢â‚¬â€œ/g, '–')
    .replace(/â€¢|Ã¢â‚¬Â¢/g, '•')
    .replace(/â€¦|Ã¢â‚¬Â¦/g, '…')
    .replace(/Ã¢â€š¬/g, '€')
    .replace(/Â /g, ' ')
    .replace(/Â/g, '')
    .replace(/Ã/g, ''); // last-resort nuking of stray Ã

  // Normalize unicode; remove weird control chars (keep \n\t\r space)
  s = s.normalize('NFKC').replace(/[^\S\n\t\r ]+/g, '');

  // Normalize newlines
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return s.trim();
}

function paragraphize(text) {
  const t = fixMojibake(text);

  // If model already used blank lines, tidy them
  if (/\n{2,}/.test(t)) {
    return t
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  // Add breaks before labels we often see
  let s = t.replace(/\s*(Law:|Principle:|Boundary:|Advice:|Note:)/g, '\n\n$1');

  // If still one blob: sentence-split and group into small paragraphs
  const sentences = s
    .split(/(?<=[.!?])\s+(?=[A-Z0-9“"'])/)
    .map(x => x.trim())
    .filter(Boolean);

  if (sentences.length <= 1) return s;

  const chunks = [];
  let buf = [];
  for (const sent of sentences) {
    buf.push(sent);
    if (buf.join(' ').length > 220 || buf.length >= 3) {
      chunks.push(buf.join(' '));
      buf = [];
    }
  }
  if (buf.length) chunks.push(buf.join(' '));

  return chunks.join('\n\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* ────────────────────────────────────────────────────────────
   PUBLIC: generateMentorResponse(mentor, userText, preset, options)
   Streams a single cleaned message event then ends
   ──────────────────────────────────────────────────────────── */
exports.generateMentorResponse = (mentor, userText, preset, options) => {
  const emitter = new EventEmitter();

  (async () => {
    try {
      // Call your Together/DeepSeek wrapper (55s timeout in v4)
      const resp = await getMentorResponse(mentor, userText, preset, options);

      // Clean + paragraphize
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

      // Minimal fallback, still cleaned
      const fallback = `You’re speaking like a petitioner. Host the scene, set the myth, close cleanly.\n\nLaw: Lead the frame or lose it.`;
      const clean = paragraphize(fallback);

      emitter.emit('data', {
        type: 'wisdom',
        text: clean,
        mentor,
        preset,
        viral_score: 84,
        wisdom_level: 'legendary_fallback',
        fallback: true,
        timestamp: new Date().toISOString()
      });

      emitter.emit('end');
    }
  })();

  return emitter;
};

// (optional) export cleaners if you want to reuse elsewhere
exports._cleaners = { fixMojibake, paragraphize };
