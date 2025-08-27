// utils/mentorResponse.js — VIRAL WISDOM ENGINE (SSE + clean formatting)

const EventEmitter = require('events');
const { getMentorResponse } = require('../services/aiService');

/* ─────────────────────── Text cleanup to kill blobs/mojibake ─────────────────────── */

function normalizeForClient(text = '') {
  return String(text)
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width
    .replace(/Ã¢â‚¬â„¢/g, "'")
    .replace(/Ã¢â‚¬Å“|Ã¢â‚¬Â/g, '"')
    .replace(/Ã¢â‚¬â€œ/g, '–')
    .replace(/Ã¢â‚¬â€/g, '—')
    .replace(/Ã¢â€šÂ¬/g, '€')
    .replace(/Â·/g, '·')
    .replace(/Â /g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function paragraphize(text = '') {
  let t = normalizeForClient(text);

  // Make likely sections/bullets/roleplay dialogue readable
  t = t
    .replace(/\n?(Law:)/gi, '\n\n$1')
    .replace(/\n?(Do:)/gi, '\n\n$1')
    .replace(/\n?(-\s|•\s|\u2022\s)/g, '\n$1') // bullets
    .replace(/\n?([A-Z][a-zA-Z]+:)/g, '\n$1'); // Name: line

  // If still a wall, split into short paragraphs by sentence boundaries
  if (!/\n{2,}/.test(t)) {
    t = t.replace(/([.!?])\s+(?=[A-Z“"][^\n])/g, '$1\n\n');
  }

  return t.replace(/\n{3,}/g, '\n\n').trim();
}

/* ───────────────────────────── Virality helpers ───────────────────────────── */

function scoreViral(t) {
  let s = 50;
  if (/law:|principle/i.test(t)) s += 10;
  if (/secret|forbidden|never/i.test(t)) s += 15;
  if (t.length > 200) s += 10;
  if (/\?$/.test(t.trim())) s += 5;
  return Math.min(100, s);
}

function ensureQuotableCloser(text, mentor) {
  if (/This is/i.test(text)) return text;
  const closers = {
    casanova: 'This is the secret of true magnetism.',
    cleopatra: 'This is how queens are made.',
    machiavelli: 'This is the art of strategic living.',
    sun_tzu: 'This is the path to victory.',
    marcus_aurelius: 'This is the way of inner strength.',
    churchill: 'This is how legends are forged.'
  };
  return `${text} ${closers[mentor] || closers.casanova}`.trim();
}

/* ───────────────────── Public: SSE generator used by controller ───────────────────── */

exports.generateMentorResponse = (mentor, userText, preset, options = {}) => {
  const emitter = new EventEmitter();

  (async () => {
    try {
      const result = await getMentorResponse(mentor, userText, preset, options);
      const cleaned = paragraphize(result.response || '');

      emitter.emit('data', {
        type: 'wisdom',
        text: cleaned,
        mentor,
        preset,
        viral_score: scoreViral(cleaned),
        wisdom_level: 'legendary',
        timestamp: result.timestamp
      });

      emitter.emit('end');
    } catch (error) {
      console.error('💥 WISDOM GENERATION ERROR:', error?.message || error);

      let fallback =
        'Here’s the uncomfortable truth: you talk like someone asking permission. Attraction rewards leadership, mystery, and decisive language. Speak like an experience, not a request.\n\nLaw: Lead the frame or lose it.';
      fallback = ensureQuotableCloser(paragraphize(fallback), mentor);

      emitter.emit('data', {
        type: 'wisdom',
        text: fallback,
        mentor,
        preset,
        viral_score: scoreViral(fallback),
        wisdom_level: 'legendary_fallback',
        fallback: true,
        timestamp: new Date().toISOString()
      });

      emitter.emit('end');
    }
  })();

  return emitter;
};

/* ───────────────────────── Persona metadata (compatibility) ───────────────────────── */

exports.getPersonaForMentor = (mentor) => {
  const personas = {
    casanova: {
      title: 'Master of Authentic Magnetism',
      expertise: 'Psychology of attraction, authentic charisma, social dynamics mastery',
      signature: 'Teaches genuine attraction through self-development, not manipulation',
      wisdom_style: 'Sophisticated, charming, psychologically insightful',
      viral_factor: 95
    },
    cleopatra: {
      title: 'Empress of Strategic Influence',
      expertise: 'Political strategy, personal authority, command presence, power dynamics',
      signature: 'Builds unshakeable inner authority and natural leadership magnetism',
      wisdom_style: 'Regal, commanding, strategically brilliant',
      viral_factor: 98
    },
    machiavelli: {
      title: 'Master of Strategic Psychology',
      expertise: 'Human nature analysis, strategic thinking, political maneuvering defense',
      signature: 'Reveals hidden motivations and teaches strategic protection from manipulation',
      wisdom_style: 'Calculating, pragmatic, brutally honest',
      viral_factor: 92
    },
    sun_tzu: {
      title: 'Ancient Master of Strategic Positioning',
      expertise: 'Strategic thinking, psychological warfare defense, conflict resolution',
      signature: 'Applies timeless strategic principles to modern relationship dynamics',
      wisdom_style: 'Philosophical, strategic, profoundly wise',
      viral_factor: 94
    },
    marcus_aurelius: {
      title: 'Stoic Emperor and Wisdom Master',
      expertise: 'Inner strength, emotional resilience, philosophical wisdom, self-mastery',
      signature: 'Builds psychological immunity to manipulation through Stoic principles',
      wisdom_style: 'Philosophical, grounding, deeply transformative',
      viral_factor: 96
    },
    churchill: {
      title: 'Wartime Leader and Rhetoric Master',
      expertise: 'Psychological warfare defense, unshakeable resolve, inspiring leadership',
      signature: 'Builds inner fortress against manipulation and emotional attacks',
      wisdom_style: 'Resolute, inspiring, powerfully motivating',
      viral_factor: 93
    }
  };
  return personas[mentor] || personas.casanova;
};

/* ─────────────────────────── Virality helpers (compat) ─────────────────────────── */

exports.analyzeWisdomVirality = (response) => scoreViral(String(response || ''));
exports.enhanceWisdomForVirality = (response, mentor) =>
  ensureQuotableCloser(String(response || ''), mentor);

/* ───────────────────────── Legacy aliases for compatibility ───────────────────────── */

exports.generateMentorResponseLegacy = exports.generateMentorResponse;
exports.getFallbackResponse = (mentor) =>
  ensureQuotableCloser(paragraphize('Law: Lead the frame or lose it.'), mentor);
