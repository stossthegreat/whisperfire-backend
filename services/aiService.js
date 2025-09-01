// services/aiService.js — ORACLE SEDUCER v5 (UTF-8 + Clean paragraphs)

const axios = require('axios');

const DEEPSEEK_API_URL = 'https://api.together.xyz/v1/chat/completions';
const MODEL = 'deepseek-ai/DeepSeek-V3';

/* ────────────────────────────────────────────────────────────
   TEXT SANITIZATION & FORMATTING (fixes blobs + “A” gibberish)
   ──────────────────────────────────────────────────────────── */

function normalizeUnicode(raw) {
  if (!raw) return '';
  let s = String(raw);

  // Common mojibake (UTF-8 read as Win-1252) → real punctuation
  const map = [
    [/â€™/g, '’'], // right single quote
    [/â€œ/g, '“'], // left double quote
    [/â€/g, '”'],  // right double quote (sometimes â€)
    [/â€/g, '”'],
    [/â€“/g, '–'], // en dash
    [/â€”/g, '—'], // em dash
    [/â€¢/g, '•'], // bullet
    [/Â /g, ' '],  // stray Â before spaces
    [/Â/g, ''],    // stray Â anywhere
  ];
  map.forEach(([re, rep]) => (s = s.replace(re, rep)));

  // Normalize Unicode form; remove zero-widths & NBSP
  s = s.normalize('NFKC')
       .replace(/\u200B|\u200C|\u200D|\uFEFF/g, '')
       .replace(/\u00A0/g, ' ');

  return s;
}

function tidyMarkdownToReadableParagraphs(raw) {
  let s = normalizeUnicode(raw)
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  // Convert markdown bullets to consistent bullets with spacing
  s = s
    .replace(/^\s*[-*]\s+/gm, '• ')
    .replace(/^\s*\d+\.\s+/gm, m => `• `);

  // Ensure bullets are separated from paragraphs
  s = s.replace(/([^\n])\n(• )/g, '$1\n\n$2');

  // Add blank line between sentences if the model returned a blob:
  // heuristic: if >400 chars and <3 paragraph breaks, split on ". "
  const paragraphBreaks = (s.match(/\n\n/g) || []).length;
  if (s.length > 400 && paragraphBreaks < 2) {
    s = s
      .replace(/([.!?])\s+(?=[A-Z“])/g, '$1\n\n') // sentence → paragraph break
      .replace(/\n{3,}/g, '\n\n');
  }

  // Trim spaces around lines
  s = s.split('\n').map(l => l.trimEnd()).join('\n').trim();

  return s;
}

function toCleanText(raw) {
  return tidyMarkdownToReadableParagraphs(raw);
}

/* ────────────────────────────────────────────────────────────
   PROMPTS (SCAN / PATTERN)
   ──────────────────────────────────────────────────────────── */

function buildScanPrompt(tone, multi) {
  return `
ROLE: Elite strategist of attraction and influence.
Speak with decisive clarity. No disclaimers. No hedging.

TONE=${tone}

TASK: Analyze ${multi ? 'a short list of the USER’s messages' : 'one USER message'}.
OUTPUT JSON ONLY with EXACT keys:
{
  "headline": "One-line verdict that teaches.",
  "message": "Short quote of the user's line(s).",
  "analysis": "4–6 sentences explaining what actually happened.",
  "mistake": "2–3 sentences naming the core error.",
  "rewrite": "One elite replacement line (or two options).",
  "why": ["≤10 words","≤10 words","≤10 words"],
  "principle": "One sentence law.",
  "next": ["Command 1","Command 2","Command 3"]
}

RULES:
- Bold, specific, charismatic. No admin energy.
- Exactly three bullets in "why".
- ~140–220 words total.
- Return ONLY the JSON object.`;
}

function buildPatternPrompt(tone) {
  return `
ROLE: War-room strategist. Decode the thread, show frame shifts, give exact lines.

TONE=${tone}

TASK: Analyze a multi-message thread: "You:" (USER) vs "Them:" (counterpart).
OUTPUT JSON ONLY with EXACT keys:
{
  "headline": "One-line verdict.",
  "thread": [
    { "who": "You|Them", "said": "short quote", "meaning": "what that line was doing" }
  ],
  "critical": [
    { "moment": "Name", "what_went_wrong": "1–2 sentences", "better_line": "exact replacement", "why": "1–2 sentences" }
  ],
  "psych_profile": {
    "you": "2–3 sentences",
    "them": "2–3 sentences",
    "explain": "3–5 sentences"
  },
  "frame_ledger": { "start": "X", "mid": "Y", "end": "Z", "explain": "3–4 sentences" },
  "error_chain": { "arc": "Error1 → Error2 → Error3", "explain": "2–3 sentences" },
  "fixes": [
    { "situation": "where to apply", "rewrite": "exact line", "explain": "1–2 sentences" }
  ],
  "recovery": ["Step 1","Step 2","Step 3"],
  "principle": "One sentence rule.",
  "hidden_agenda": "null or one sentence",
  "boundary_script": "multi-line allowed"
}

RULES:
- Keep 'thread' compact with meaning.
- 2–3 critical moments; 2–4 fixes.
- ~220–350 words.
- Return ONLY the JSON object.`;
}

/* ────────────────────────────────────────────────────────────
   MAIN ANALYSIS
   ──────────────────────────────────────────────────────────── */

async function analyzeWithAI(message, tone, tab = 'scan') {
  // HARD RULE: only do the tab requested.
  const isPattern = tab === 'pattern';
  const multi = tab === 'scan' && /(\n|—|-{2,}|;)/.test(String(message || ''));
  const system = isPattern ? buildPatternPrompt(tone) : buildScanPrompt(tone, multi);

  const requestBody = {
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: isPattern
          ? `THREAD (alternating "You:" / "Them:"):\n${message}\n\nFollow the exact JSON schema.`
          : `MESSAGE(S):\n${message}\n\nFollow the exact JSON schema.`
      }
    ],
    max_tokens: isPattern ? 1800 : 1200,
    temperature: 0.9,
    top_p: 0.95
  };

  try {
    const resp = await axios.post(DEEPSEEK_API_URL, requestBody, {
      headers: {
        Authorization: `Bearer ${process.env.TOGETHER_AI_KEY}`,
        'Content-Type': 'application/json; charset=utf-8',
        'Accept-Charset': 'utf-8'
      },
      timeout: 55000 // 55s
    });

    const raw = resp?.data?.choices?.[0]?.message?.content || '';
    let parsed;
    try {
      const json = raw.match(/\{[\s\S]*\}$/m)?.[0] || raw;
      parsed = JSON.parse(json);
    } catch {
      parsed = isPattern ? fallbackPattern(message) : fallbackScan(message);
    }

    return normalizeToWhisperfire(parsed, { input: message, tab, tone });
  } catch (err) {
    console.error('analyzeWithAI error:', err?.response?.data || err.message);
    const fb = tab === 'pattern' ? fallbackPattern(message) : fallbackScan(message);
    return normalizeToWhisperfire(fb, { input: message, tab, tone });
  }
}

/* ────────────────────────────────────────────────────────────
   NORMALIZATION → WhisperfireResponse (unchanged shape)
   ──────────────────────────────────────────────────────────── */

function normalizeToWhisperfire(ai, ctx) {
  const { input, tab, tone } = ctx;

  if (tab === 'scan') {
    const receipts = buildReceiptsFromScan(ai, input);
    const powerPlay =
      (Array.isArray(ai?.why) ? ai.why : []).slice(0, 3).join('\n') ||
      'Specific plan, zero labor\nYou host, they join\nAssumes value, invites choice';
    const nextMoves =
      (Array.isArray(ai?.next) ? ai.next : [])
        .map((s) => s?.trim())
        .filter(Boolean)
        .join('\n') || 'Offer a vivid plan.\nHost the logistics.\nClose cleanly.';
    const coreTake = join([ai?.analysis, ai?.mistake]);

    const tactic = inferTactic(coreTake || '', ai?.headline || '');
    const metrics = deriveMetrics(coreTake || '', ai?.headline || '', input);

    return {
      context: {
        tab,
        relationship: 'Partner',
        tone: tone || 'soft',
        content_type: 'dm',
        subject_name: null
      },
      headline: str(ai?.headline || 'Lead with a story, not a request.'),
      core_take: coreTake || 'You ceded frame; rewrite restores tension and leadership.',
      tactic,
      motives: ai?.principle ? str(ai.principle) : 'Signal value; avoid approval-seeking; lead decisively.',
      targeting: inferTargeting(coreTake || '') || 'You played the Petitioner; become the Curator.',
      power_play: powerPlay,
      receipts,
      next_moves: nextMoves,
      suggested_reply: {
        style: tone || 'soft',
        text: oneLine(str(ai?.rewrite || 'Hidden speakeasy Thu 9. Bring your curiosity.'))
      },
      safety: {
        risk_level: metrics.red_flag >= 60 ? 'MODERATE' : 'LOW',
        notes: metrics.red_flag >= 60 ? 'Reduce neediness; host the frame.' : 'Safe if you lead cleanly.'
      },
      metrics: metrics,
      pattern: { cycle: null, prognosis: null },
      ambiguity: { warning: null, missing_evidence: null },
      hidden_agenda: null,
      archetypes: null,
      trigger_pattern_map: null,
      contradictions: null,
      weapons: null,
      forecast: null,
      counter_intervention: str(ai?.principle || 'Invitation is not a question.'),
      long_game: null
    };
  }

  // PATTERN
  const receipts = buildReceiptsFromPattern(ai, input);
  const coreTake = join([ai?.psych_profile?.explain, ai?.frame_ledger?.explain, ai?.error_chain?.explain]);
  const metrics = deriveMetrics(coreTake || '', ai?.headline || '', input);

  const whyBullets = [];
  (Array.isArray(ai?.fixes) ? ai.fixes : []).slice(0, 3).forEach((fx) => {
    if (fx?.explain) whyBullets.push(oneLine(str(fx.explain)).slice(0, 80));
  });
  if (whyBullets.length < 3 && ai?.principle) whyBullets.push(oneLine(str(ai.principle)));
  while (whyBullets.length < 3) whyBullets.push('Host logistics; never beg');

  const nextMoves =
    (Array.isArray(ai?.recovery) ? ai.recovery : [])
      .map((s) => s?.trim())
      .filter(Boolean)
      .join('\n') || 'Silence 2–3 days.\nReturn with hosted plan.\nBinary close.';

  const frameArc =
    ai?.frame_ledger?.start && ai?.frame_ledger?.mid && ai?.frame_ledger?.end
      ? `${ai.frame_ledger.start} → ${ai.frame_ledger.mid} → ${ai.frame_ledger.end}`
      : null;

  return {
    context: {
      tab: 'pattern',
      relationship: 'Partner',
      tone: tone || 'soft',
      content_type: 'dm',
      subject_name: null
    },
    headline: str(ai?.headline || 'Frame leaked at tests — recover by hosting.'),
    core_take: coreTake || 'They probed; you defended; logistics flattened tension. Fix with decisive hosting and playful escalation.',
    tactic: { label: 'Dominant Dynamic', confidence: 90 },
    motives: ai?.principle ? str(ai.principle) : 'Keep tension through tests; set logistics after escalation.',
    targeting: 'You became the Clerk; reassert the Curator.',
    power_play: whyBullets.slice(0, 3).join('\n'),
    receipts,
    next_moves: nextMoves,
    suggested_reply: {
      style: tone || 'soft',
      text: str(ai?.boundary_script || 'Victory drink tomorrow. One seat left.\nText “approved” if you’re in.')
    },
    safety: {
      risk_level: metrics.red_flag >= 60 ? 'MODERATE' : 'LOW',
      notes: 'Recover by setting a vivid plan and closing cleanly.'
    },
    metrics,
    pattern: {
      cycle: frameArc ? `Frame arc: ${frameArc}` : (ai?.error_chain?.arc || null),
      prognosis: ai?.error_chain?.arc || 'Defense → Admin → Power transfer'
    },
    ambiguity: { warning: null, missing_evidence: null },
    hidden_agenda: ai?.hidden_agenda ?? null,
    archetypes: null,
    trigger_pattern_map: null,
    contradictions: null,
    weapons: null,
    forecast: null,
    counter_intervention: str(ai?.principle || 'Begin Challenger, end Victor.'),
    long_game: null
  };
}

/* ────────────────────────────────────────────────────────────
   FALLBACKS
   ──────────────────────────────────────────────────────────── */

function fallbackScan(message) {
  const condensed = oneLine(str(message)).slice(0, 200);
  const vibe = estimateVibe(message);
  const rewrite =
    vibe >= 7
      ? 'Keep Thu 9. I’m stealing you for the speakeasy.'
      : 'Hidden speakeasy Thu 9. Wear something that gets us kicked out.';

  return {
    headline: vibe >= 7 ? 'Clean invite. Tighten the myth.' : 'You asked for a slot, not a story.',
    message: condensed,
    analysis:
      vibe >= 7
        ? 'You lead with a plan. Good. Add mystique and scarcity to raise pull.'
        : 'It reads like a calendar request. No edge, no tension, no hosted frame.',
    mistake:
      vibe >= 7
        ? 'Logistics are solid, but the energy is flat: no myth, no scarcity.'
        : 'You ceded power by asking for availability. Attraction needs leadership.',
    rewrite,
    why: ['Specific plan, zero labor', 'You host, they join', 'Assumes value, invites choice'],
    principle: 'Invitation is not a question.',
    next: ['Offer a vivid scene', 'Set time/place decisively', 'Close with a binary path']
  };
}

function fallbackPattern(message) {
  const lines = str(message)
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 6);
  const snapshot = lines.map((l) => {
    const who = /^them:/i.test(l) ? 'Them' : /^you:/i.test(l) ? 'You' : /:/.test(l) ? l.split(':')[0] : 'You';
    const said = l.replace(/^you:|^them:/i, '').trim();
    return { who: /You|Them/.test(who) ? who : 'You', said: said.slice(0, 80), meaning: who === 'Them' ? 'test / withhold' : 'defense / admin pivot' };
  });

  return {
    headline: 'Frame leaked at tests — recover by hosting.',
    thread: snapshot,
    critical: [
      { moment: 'Their playful test', what_went_wrong: 'You defended yourself, proving doubt and lowering tension.', better_line: 'Good. I don’t want safe.', why: 'Escalates danger instead of defending; keeps you Challenger.' },
      { moment: 'Admin pivot', what_went_wrong: 'You switched to logistics mid-flirt, collapsing vibe.', better_line: 'Penalty for being trouble: you owe me a drink. Thu 8.', why: 'Hosts logistics with playful dominance; restores frame.' }
    ],
    psych_profile: {
      you: 'Jester seeking a crown — playful, then pleading.',
      them: 'Amused decider — tests, withholds, enjoys pursuit.',
      explain: 'This pairing creates a tease-and-test loop. When you defend, the loop rewards their withholding. Host the frame to break it.'
    },
    frame_ledger: { start: 'Challenger', mid: 'Clerk', end: 'Petitioner', explain: 'You opened strong, then surrendered logistics. That transferred status.' },
    error_chain: { arc: 'Defense → Admin → Power transfer', explain: 'Defending proves doubt; admin kills spark; power moves to them.' },
    fixes: [
      { situation: 'Tests', rewrite: 'Good. I prefer trouble undefeated.', explain: 'Accept and amplify—no defense, more tension.' },
      { situation: 'Logistics', rewrite: 'Speakeasy tomorrow. One seat left.', explain: 'Scarcity + hosting flips the frame.' }
    ],
    recovery: ['Silence 2–3 days', 'Return with hosted plan', 'Binary close'],
    principle: 'Begin Challenger, end Victor.',
    hidden_agenda: null,
    boundary_script: 'I like playful, not indecision. I’m grabbing a drink Thu. If you’re in, say “approved.”'
  };
}

/* ────────────────────────────────────────────────────────────
   HELPERS
   ──────────────────────────────────────────────────────────── */

function buildReceiptsFromScan(ai, input) {
  const out = [];
  if (ai?.message) out.push(oneLine(str(ai.message)).slice(0, 220));
  else {
    const lines = str(input).split('\n').map((s) => oneLine(s)).filter(Boolean);
    if (lines.length) out.push(lines[0].slice(0, 220));
    if (lines[1]) out.push(lines[1].slice(0, 220));
  }
  return out.length ? out : [oneLine(str(input)).slice(0, 220)];
}

function buildReceiptsFromPattern(ai, input) {
  const bullets = [];
  const items = Array.isArray(ai?.thread) ? ai.thread : [];
  if (items.length) {
    items.slice(0, 6).forEach((t) => {
      const who = (t?.who || '').trim() || 'You';
      const said = oneLine(str(t?.said)).slice(0, 90);
      const meaning = oneLine(str(t?.meaning)).slice(0, 60);
      bullets.push(`${who}: “${said}” — ${meaning}`);
    });
  } else {
    const lines = str(input).split('\n').map((s) => s.trim()).filter(Boolean).slice(0, 6);
    lines.forEach((l) => {
      const who = /^them:/i.test(l) ? 'Them' : 'You';
      const said = l.replace(/^you:|^them:/i, '').trim();
      bullets.push(`${who}: “${oneLine(said).slice(0, 90)}” — ${who === 'Them' ? 'test/withhold' : 'defense/admin'}`);
    });
  }
  return bullets;
}

function inferTactic(text, headline) {
  const lc = `${text} ${headline}`.toLowerCase();
  if (lc.includes('defend') || lc.includes('proof') || lc.includes('test')) return { label: 'Test → Defense (frame loss)', confidence: 90 };
  if (lc.includes('admin') || lc.includes('logistic')) return { label: 'Admin pivot (energy collapse)', confidence: 88 };
  if (lc.includes('host') || lc.includes('plan')) return { label: 'Hosted frame (dominance)', confidence: 85 };
  return { label: 'Frame alignment', confidence: 80 };
}

function inferTargeting(text) {
  const lc = text.toLowerCase();
  if (lc.includes('petition') || lc.includes('beg')) return 'You played the Petitioner; become the Curator.';
  if (lc.includes('host')) return 'You played the Curator; keep the crown.';
  if (lc.includes('defend')) return 'You played the Defendant; become the Challenger.';
  return null;
}

function deriveMetrics(core, head, input) {
  const vibe = estimateVibe(input);
  const red = clampInt(100 - vibe * 10, 0, 100);
  return { red_flag: red, certainty: 86, viral_potential: 74 };
}

function estimateVibe(text) {
  const s = str(text);
  const q = /\?/.test(s);
  const plan = /\b(thu|fri|sat|sun|mon|tue|wed|tonight|tomorrow)\b/i.test(s);
  const host = /\b(i(?:'m| am)?|my)\b.*\b(reserved|booked|taking|host|plan|setup|arranged)/i.test(s);
  let v = 5;
  if (plan) v += 2;
  if (host) v += 2;
  if (q && !plan) v -= 1;
  if (s.length < 6) v -= 1;
  return Math.max(0, Math.min(10, v));
}

const oneLine = (s) => str(s).replace(/\s+/g, ' ').trim();
const str = (v) => (v == null ? '' : String(v));
const join = (arr) => (arr || []).map((p) => str(p).trim()).filter(Boolean).join(' ');

function clampInt(n, min, max) {
  const x = Number.parseInt(Number(n || 0), 10);
  if (Number.isNaN(x)) return min;
  return Math.max(min, Math.min(max, x));
}

/* ────────────────────────────────────────────────────────────
   MENTOR PRESETS (used by mentor controller)
   ──────────────────────────────────────────────────────────── */

const MENTOR_PROMPTS = {
  casanova: `You are Casanova with psychological teeth. Speak in quotable lines and tactical charm.`,
  cleopatra: `You are Cleopatra—regal strategist. Command presence, surgical power language.`,
  machiavelli: `You are Machiavelli—brutal clarity on motives; elegant counters.`,
  sun_tzu: `You are Sun Tzu—positioning, timing, terrain of emotion.`,
  marcus_aurelius: `You are Marcus—Stoic magnetism, inner authority, clean boundaries.`,
  churchill: `You are Churchill—iron rhetoric, unshakeable resolve.`
};

function presetSystem(mentor, preset) {
  const persona = MENTOR_PROMPTS[mentor] || MENTOR_PROMPTS.casanova;
  const modes = {
    chat: `${persona}

MODE=CHAT
- 80–140 words, conversational.
- Ask ONE pointed follow-up.
- Include one crisp quotable line.`,

    roleplay: `${persona}

MODE=ROLEPLAY
- Mini-scene (Setup → Tension → Payoff).
- 160–220 words.
- End with: Use: "<copyable line>"`,

    advise: `${persona}

MODE=ADVISE
- 3 razor bullets + 1 exact line + 1 principle.
- 180–260 words.
- Dark psychology decoding allowed; adults/consent; no illegal content.
- Format:
  • Insight 1
  • Insight 2
  • Insight 3
  Line: "…"
  Principle: …`,

    drill: `${persona}

MODE=DRILL
- 4 ruthless questions (≤16 words each) that force self-honesty.
- End with: Law: "<one sentence>"`
  };
  return modes[preset] || modes.chat;
}

async function getMentorResponse(mentor, userText, preset) {
  try {
    const resp = await axios.post(DEEPSEEK_API_URL, {
      model: MODEL,
      messages: [
        { role: 'system', content: presetSystem(mentor, preset) },
        { role: 'user', content: userText }
      ],
      max_tokens: 650,
      temperature: 0.95,
      top_p: 0.95
    }, {
      headers: {
        Authorization: `Bearer ${process.env.TOGETHER_AI_KEY}`,
        'Content-Type': 'application/json; charset=utf-8',
        'Accept-Charset': 'utf-8'
      },
      timeout: 55000
    });

    const raw = resp?.data?.choices?.[0]?.message?.content || '';
    const text = toCleanText(raw);
    return { mentor, response: text, preset, timestamp: new Date().toISOString() };
  } catch (e) {
    const fallback = toCleanText(
      `Here’s the uncomfortable truth: you talk like permission, not gravity.
Speak like an experience—set the myth, host the plan, close cleanly.

Law: Lead the frame or lose it.`
    );
    return { mentor, response: fallback, preset, timestamp: new Date().toISOString() };
  }
}

/* ────────────────────────────────────────────────────────────
   EXPORTS
   ──────────────────────────────────────────────────────────── */

module.exports = {
  analyzeWithAI,
  getMentorResponse,
  toCleanText // export for controllers if needed
};
