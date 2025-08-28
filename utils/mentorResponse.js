// utils/mentorResponse.js — VIRAL WISDOM ENGINE v3
// Fixes:
//  - Strong UTF-8 normalization: nukes “Â”, “â€™”, etc. and CP1252 junk
//  - Aggressive paragraphization: headings, bullets, short paras
//  - Output is pre-formatted for the client

const EventEmitter = require('events');
const { getMentorResponse } = require('../services/aiService');

/* ────────────────────────────────────────────────────────────
   PUBLIC
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
   FORMATTER PIPELINE
   ──────────────────────────────────────────────────────────── */

function formatForClient(raw, ctx = {}) {
  let t = normalizeUTF(String(raw || ''));

  // Ensure clear section breaks before common markers
  t = t
    .replace(/\s*(^|\n)\s*(Insights?:)\s*/gi, '\n\n$2\n')
    .replace(/\s*(^|\n)\s*(Law:|Principle:|Rule:|Line:|Use:)\s*/gi, '\n\n$2 ')
    .replace(/(^|\n)[*-]\s+/g, '$1• ')
    .replace(/(^|\n)\s*(\d+)\.\s+/g, '$1$2. ');

  // If it still looks like a blob, split every 2 sentences
  if (!/\n{2,}/.test(t) && countSentences(t) >= 3) {
    t = splitIntoParas(t, 2);
  }

  // Guarantee blank line between logical chunks: bullets, quotes, section lines
  t = t
    .replace(/(• [^\n]+)\n(?!\n)/g, '$1\n')      // keep bullet runs tight
    .replace(/(".*?")\s*$/gm, '$1\n')            // newline after closing quote lines
    .replace(/\n{3,}/g, '\n\n');

  return t.trim();
}

/* ────────────────────────────────────────────────────────────
   UTF-8 / CP1252 NORMALIZER — kills “Â” and friends
   ──────────────────────────────────────────────────────────── */

function normalizeUTF(text = '') {
  let t = text;

  // Normalize line endings early
  t = t.replace(/\r\n?/g, '\n');

  // Fix common CP1252 → UTF8 mojibake sequences
  t = t
    // Quotes/apostrophes
    .replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    // Dashes/ellipsis
    .replace(/[\u2013\u2014\u2212]/g, '—')
    .replace(/\u2026/g, '...')
    // Zero-width chars
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    // CP1252 garble
    .replace(/â€™|Ã¢â‚¬â„¢/g, "'")
    .replace(/â€˜|Ã¢â‚¬Ëœ/g, "'")
    .replace(/â€œ|â€|Ã¢â‚¬Å“|Ã¢â‚¬Â|â€ž/g, '"')
    .replace(/â€“|Ã¢â‚¬â€œ/g, '—')
    .replace(/â€”|Ã¢â‚¬â€/g, '—')
    .replace(/â€¦|Ã¢â‚¬Â¦/g, '...')
    // The infamous stray Â (U+00C2) variants
    .replace(/Â /g, ' ')
    .replace(/Â(?=[\W_]|$)/g, '')
    .replace(/Â/g, '')
    // Non-breaking space -> regular space
    .replace(/\u00A0/g, ' ');

  // Collapse extra spaces beside punctuation created by replacements
  t = t.replace(/[ \t]+([,.;:!?])/g, '$1').replace(/\s{2,}/g, ' ');

  return t.trim();
}

/* ────────────────────────────────────────────────────────────
   PARAGRAPH HELPERS
   ──────────────────────────────────────────────────────────── */

function countSentences(s) {
  const parts = s.split(/[.!?](?=\s|$)/).filter(Boolean);
  return parts.length;
}

function splitIntoParas(text, sentencesPerPara = 2) {
  const sentences = text
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
  for (let i = 0; i < sentences.length; i += sentencesPerPara) {
    paras.push(sentences.slice(i, i + sentencesPerPara).join(' ').trim());
  }
  return paras.join('\n\n');
}

/* ────────────────────────────────────────────────────────────
   FALLBACKS (formatted)
   ──────────────────────────────────────────────────────────── */

function getEnhancedFallbackResponse(mentor, userText, preset) {
  const legendaryFallbacks = {
    casanova: {
      drill:
        `Four checks:\n\n1) Where do you leak neediness?\n2) What myth are you building?\n3) What do they *join* that you host?\n4) What line proves gravity, not permission?\n\nLaw: Lead the frame or lose it.`,
      advise:
        `• Attraction follows myth, not admin.\n• Energy beats availability.\n• Scarcity beats explanation.\n\nLine: "Hidden speakeasy Thu 9. Wear trouble."\n\nPrinciple: Invitation is not a question.`,
      roleplay:
        `Scene: dim bar, late Thursday.\n\nYou: "Penalty for being interesting: you owe me a drink."\nThem: "Oh really?"\nYou: "Judgment day is at 9. I already booked your seat."\n\nUse: "Judgment day is at 9. I already booked your seat."`,
      chat:
        `Clean plan. Add myth. Cut questions.\n\nLine: "I’m stealing you Thu 9 for a speakeasy. Bring trouble."`
    },
    cleopatra: {
      chat:
        `You do not ask — you anoint. Choose a scene, claim a throne, let them qualify.\n\nLine: "I’m hosting a little rebellion Thu 9. Appear if you’re brave."`
    }
  };

  const pack = legendaryFallbacks[mentor] || legendaryFallbacks.casanova;
  return pack[preset] || pack.chat;
}

/* ────────────────────────────────────────────────────────────
   EXPORTS (internal helpers for tests)
   ──────────────────────────────────────────────────────────── */

exports._internal = {
  formatForClient,
  normalizeUTF,
  splitIntoParas,
  countSentences
};
