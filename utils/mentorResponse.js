// utils/mentorResponse.js — VIRAL WISDOM ENGINE v2
// - Full UTF-8 mojibake cleanup (no more stray Â / smart quotes mess)
// - Aggressive paragraphization: headings, bullets, short paragraphs, copyable blocks
// - Emits already-formatted text to the SSE consumer

const EventEmitter = require('events');
const { getMentorResponse } = require('../services/aiService');

/* ────────────────────────────────────────────────────────────
   PUBLIC: generateMentorResponse(mentor, userText, preset, options)
   ──────────────────────────────────────────────────────────── */

exports.generateMentorResponse = (mentor, userText, preset, options) => {
  const emitter = new EventEmitter();

  getMentorResponse(mentor, userText, preset, options)
    .then((payload) => {
      const pretty = formatForClient(payload.response, { preset, mentor });

      emitter.emit('data', {
        type: 'wisdom',
        text: pretty,
        mentor,
        preset,
        viral_score: payload.viralScore || 85,
        wisdom_level: 'legendary',
        timestamp: payload.timestamp
      });

      emitter.emit('end');
    })
    .catch((err) => {
      console.error('Mentor generation error:', err);
      const fallback = getEnhancedFallbackResponse(mentor, userText, preset);
      const pretty = formatForClient(fallback, { preset, mentor, isFallback: true });

      emitter.emit('data', {
        type: 'wisdom',
        text: pretty,
        mentor,
        preset,
        viral_score: 85,
        wisdom_level: 'legendary_fallback',
        fallback: true,
        timestamp: new Date().toISOString()
      });

      emitter.emit('end');
    });

  return emitter;
};

/* ────────────────────────────────────────────────────────────
   TEXT FORMAT PIPELINE
   ──────────────────────────────────────────────────────────── */

function formatForClient(raw, ctx = {}) {
  let t = normalizeForClient(String(raw || ''));

  // Split sections by common markers into paragraphs
  t = t
    // Ensure breaks before common labels
    .replace(/\s*(^|\n)\s*(Law:|Principle:|Rule:|Line:|Use:)\s*/gi, '\n\n$2 ')
    .replace(/\s*(^|\n)\s*(Insight[s]?:)\s*/gi, '\n\n$2\n')
    // Bullets: normalize to "• "
    .replace(/(^|\n)\s*[-*]\s+/g, '$1• ')
    // Numbered bullets ensure break
    .replace(/(^|\n)\s*(\d+)\.\s+/g, '$1$2. ')
    // Add blank lines after copyable lines
    .replace(/"(.*?)"\s*$/gm, '"$1"\n');

  // Hard paragraphization: double newline every 2–3 sentences if blobbed
  if (!/\n{2,}/.test(t)) {
    t = splitIntoReadableParagraphs(t, 2);
  }

  // Final tidy
  t = tidyWhitespace(t);

  return t;
}

function normalizeForClient(text = '') {
  let t = text;

  // Common mojibake / CP1252 → UTF-8 repairs
  t = t
    // Smart quotes / apostrophes / dashes
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/[\u2013\u2014\u2212]/g, '—')
    // Ellipsis variants
    .replace(/\u2026/g, '...')
    // Zero width junk
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // Common mojibake sequences
    .replace(/Ã¢â‚¬â„¢|â€™/g, "'")
    .replace(/Ã¢â‚¬Å“|â€œ|â€ž/g, '"')
    .replace(/Ã¢â‚¬Â|â€/g, '"')
    .replace(/Ã¢â‚¬â€œ|â€“/g, '—')
    .replace(/Ã¢â‚¬â€|â€”/g, '—')
    .replace(/Ã¢â‚¬Â¦|â€¦/g, '...')
    .replace(/Â©/g, '©')
    .replace(/Â®/g, '®')
    .replace(/Â·/g, '•')
    .replace(/Â /g, ' ')
    .replace(/Â/g, ''); // strip any stray lone Â

  // Normalize line endings and spaces
  t = t.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');

  // Trim dangerous leading/trailing junk
  return t.trim();
}

function splitIntoReadableParagraphs(text, sentencesPerPara = 2) {
  // Split by sentence enders; glue into paras
  const parts = text
    .replace(/\n+/g, ' ')
    .split(/([.!?]["’”)]?\s+)/)
    .reduce((acc, cur, i, arr) => {
      if (i % 2 === 0) {
        const sentence = cur + (arr[i + 1] || '');
        if (sentence.trim()) acc.push(sentence.trim());
      }
      return acc;
    }, []);

  const paras = [];
  for (let i = 0; i < parts.length; i += sentencesPerPara) {
    paras.push(parts.slice(i, i + sentencesPerPara).join(' ').trim());
  }
  return paras.join('\n\n');
}

function tidyWhitespace(text) {
  return text
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ────────────────────────────────────────────────────────────
   ENHANCED FALLBACK (kept from v1, now formatted)
   ──────────────────────────────────────────────────────────── */

function getEnhancedFallbackResponse(mentor, userText, preset) {
  const legendaryFallbacks = {
    casanova: {
      drill:
        `Ah, mon ami... you want tactics, but the issue is posture.\n\n1) What do you offer that costs you effort?\n2) Where do you leak neediness?\n3) What myth are you building?\n4) What line shows gravity, not permission?\n\nLaw: Lead the frame or lose it.`,
      advise:
        `• Attraction follows myth, not admin.\n• Energy beats availability.\n• Scarcity beats explanation.\nLine: "Hidden speakeasy Thu 9. Wear trouble."\nPrinciple: Invitation is not a question.`,
      roleplay:
        `Scene: dim bar, late Thursday.\nYou: "Penalty for being interesting: you owe me a drink."\nThem: "Oh really?"\nYou: "Yes, judgment day is at 9. I already booked your seat."\nUse: "Judgment day is at 9. I already booked your seat."`,
      chat:
        `Clean plan. Add myth. Cut questions. One line: "I’m stealing you Thu 9 for a speakeasy. Bring trouble."`
    },
    cleopatra: {
      chat: `You do not ask— you anoint. Choose a scene, claim a throne, let them qualify.\nLine: "I’m hosting a little rebellion Thu 9. Appear if you’re brave."`
    }
  };

  const mentorPack = legendaryFallbacks[mentor] || legendaryFallbacks.casanova;
  return mentorPack[preset] || mentorPack.chat;
}

/* ────────────────────────────────────────────────────────────
   EXPORTS
   ──────────────────────────────────────────────────────────── */

exports._internal = {
  formatForClient,
  normalizeForClient,
  splitIntoReadableParagraphs,
  tidyWhitespace
};
