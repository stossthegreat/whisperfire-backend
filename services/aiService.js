// services/aiService.js — ORACLE SEDUCER v8 (Together AI, stabilized)
// - Big, structured outputs (Scan/Pattern + Mentors) with real paragraphs
// - Ultra-clean text (kills Â / smart-quote mojibake, strips stray markdown)
// - Robust HTTP (keep-alive agents, retries, long timeouts)
// - Safe JSON extraction + normalization to your Whisperfire shape
// - Personas tuned for dense, practical advice (ethical, adult, consensual)

const axios = require('axios');
const http = require('http');
const https = require('https');

/* ────────────────────────────────────────────────────────────
   CONFIG
   ──────────────────────────────────────────────────────────── */
const DEEPSEEK_API_URL = 'https://api.together.xyz/v1/chat/completions';
const MODEL = 'deepseek-ai/DeepSeek-V3';

// Keep-alive to reduce socket churn on long calls
const keepAliveHttp = new http.Agent({ keepAlive: true, maxSockets: 64 });
const keepAliveHttps = new https.Agent({ keepAlive: true, maxSockets: 64 });

/* ────────────────────────────────────────────────────────────
   TEXT CLEANERS — kill mojibake, add spacing, strip markdown
   ──────────────────────────────────────────────────────────── */

function fixSmartQuotes(s = '') {
  return String(s)
    .replace(/Â+/g, '')                             // stray Â
    .replace(/â€™|Ã¢â‚¬â„¢|â\u0080\u0099/g, "'")   // right single
    .replace(/â€˜|Ã¢â‚¬Ëœ|â\u0080\u0098/g, "'")    // left single
    .replace(/â€œ|Ã¢â‚¬Å“|â\u0080\u009C/g, '"')    // left double
    .replace(/â€�|Ã¢â‚¬Â|â\u0080\u009D/g, '"')    // right double
    .replace(/â€”|Ã¢â‚¬â¢|â\u0080\u0094/g, '—')  // em dash
    .replace(/â€“|Ã¢â‚¬â€œ|â\u0080\u0093/g, '–')   // en dash
    .replace(/\u00A0/g, ' ');                      // NBSP → space
}

function stripWeirdMarkdown(s = '') {
  return String(s)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')         // zero-width junk
    .replace(/^[\*\u2022\-]{1,2}\s*/gm, '')        // leading bullets/asterisks
    .replace(/[>`_#]/g, '');                       // stray markdown tokens
}

// Enforce readable paragraphs from plain text
function paragraphize(s = '') {
  let t = fixSmartQuotes(stripWeirdMarkdown(String(s)));

  // Fix glued punctuation like "...end.Next"
  t = t.replace(/([a-z0-9])([.!?])([A-Z"'])/g, '$1$2 $3');

  // Start common labels on new paragraphs
  t = t.replace(/\s*(?=(?:Headline:|Analysis:|Mistake:|Rewrite:|Why:|Principle:|Next|Diagnosis:|Psychology:|Plays|Lines:|Close:|Boundary|Recovery|Law:|Use:))/g, '\n\n');

  // Encourage paragraph breaks after sentence stops
  t = t.replace(/([.!?])\s+(?=[A-Z0-9"'\(])/g, '$1\n\n');

  // Normalize whitespace
  t = t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  return t.trim();
}

// Deep-clean any object/array/string tree
function deepClean(entity) {
  if (entity == null) return entity;
  if (typeof entity === 'string') return paragraphize(entity);
  if (Array.isArray(entity)) return entity.map(deepClean);
  if (typeof entity === 'object') {
    const out = {};
    for (const k of Object.keys(entity)) out[k] = deepClean(entity[k]);
    return out;
  }
  return entity;
}

/* ────────────────────────────────────────────────────────────
   HTTP RETRY HELPER
   ──────────────────────────────────────────────────────────── */
async function postWithRetry(url, data, config, retries = 2) {
  let attempt = 0, lastErr;
  while (attempt <= retries) {
    try {
      return await axios.post(url, data, {
        httpAgent: keepAliveHttp,
        httpsAgent: keepAliveHttps,
        ...config,
      });
    } catch (e) {
      lastErr = e;
      const status = e?.response?.status;
      if (!(status === 429 || (status >= 500 && status <= 599))) break; // retry only 429/5xx
      const wait = Math.min(2000 * Math.pow(2, attempt), 8000);
      await new Promise(r => setTimeout(r, wait));
      attempt++;
    }
  }
  throw lastErr;
}

/* ────────────────────────────────────────────────────────────
   ANALYZE PROMPTS — SCAN / PATTERN (long, structured)
   ──────────────────────────────────────────────────────────── */

function buildScanPrompt(tone, multi) {
  return `
ROLE: Elite seduction strategist. You decode the USER's line(s), expose the real mistake,
and rebuild a line that pulls, not pleads. Ethical, adult, consensual.

TONE=${tone}  // savage=blade-precise; soft=velvet-steel; clinical=forensic-cool

FORMAT (NO MARKDOWN, NO EMOJIS):
Return JSON only with these exact keys:
{
  "headline": "One-line verdict that stings but teaches.",
  "message": "Short quote of the user's line(s).",
  "analysis": "6–10 sentences of plain-English decoding with paragraph breaks.",
  "mistake": "2–4 sentences naming the core error and why it kills tension.",
  "rewrite": "One elite replacement line (or two short options) the USER can copy.",
  "why": ["Reason 1 (<=10 words)", "Reason 2 (<=10 words)", "Reason 3 (<=10 words)"],
  "principle": "One-sentence law to keep.",
  "next": ["Command 1", "Command 2", "Command 3"]
}

RULES:
- No therapy-speak. No hedging. No apologies. No moralizing.
- Rewrite must be specific, charismatic, and hosted (no admin energy).
- Exactly three bullets in 'why'.
- Use blank lines *inside* string values to create paragraphs.
- 260–420 words total (rich, not bloated).
- Adults only. Consent presumed. Nothing illegal/abusive.

TASK: Analyze ${multi ? 'a short list of messages (mostly from the USER)' : 'one message from the USER'} and speak directly to the USER.`;
}

function buildPatternPrompt(tone) {
  return `
ROLE: War-room strategist of seduction. Decode moves, tests, and frame transfers. Ethical, adult, consensual.

TONE=${tone}

FORMAT (NO MARKDOWN, NO EMOJIS):
Return JSON only with these exact keys:
{
  "headline": "One-line verdict on the whole engagement.",
  "thread": [
    { "who": "You|Them", "said": "short quote", "meaning": "what that line was doing" }
  ],
  "critical": [
    { "moment": "Name", "what_went_wrong": "1–2 sentences", "better_line": "exact replacement", "why": "1–2 sentences" }
  ],
  "psych_profile": {
    "you": "archetype + read (2–3 sentences)",
    "them": "archetype + read (2–3 sentences)",
    "explain": "what this pairing creates (3–5 sentences)"
  },
  "frame_ledger": { "start": "X", "mid": "Y", "end": "Z", "explain": "3–4 sentences" },
  "error_chain": { "arc": "Error1 → Error2 → Error3", "explain": "2–3 sentences" },
  "fixes": [
    { "situation": "where to apply", "rewrite": "exact line", "explain": "1–2 sentences" }
  ],
  "recovery": ["Step 1", "Step 2", "Step 3"],
  "principle": "One sentence rule to keep.",
  "hidden_agenda": "null or one-sentence hypothesis",
  "boundary_script": "clean boundary script; multi-line allowed"
}

RULES:
- 'thread' is compact meaning, not a transcript dump (max 6 items).
- 2–3 'critical' moments total (each with one surgical better line).
- 3–5 reusable, sharp 'fixes'.
- 380–560 words total (dense, not bloated).
- Adults only. Consent presumed. Nothing illegal/abusive.

TASK: Analyze a multi-message thread (USER="You", counterpart="Them").`;
}

/* ────────────────────────────────────────────────────────────
   MAIN ANALYSIS API
   ──────────────────────────────────────────────────────────── */
async function analyzeWithAI(message, tone, tab = 'scan') {
  const isPattern = tab === 'pattern';
  const multi = tab === 'scan' && /(\n|—|-{2,}|;)/.test(String(message || ''));
  const system = isPattern ? buildPatternPrompt(tone) : buildScanPrompt(tone, multi);

  const userContent = isPattern
    ? `THREAD (alternating "You:" / "Them:"):\n${message}\n\nFollow the exact JSON schema.`
    : `MESSAGE(S):\n${message}\n\nFollow the exact JSON schema.`;

  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userContent }
    ],
    max_tokens: isPattern ? 2300 : 1500,
    temperature: 1.02,
    top_p: 0.96
  };

  try {
    const resp = await postWithRetry(
      DEEPSEEK_API_URL,
      body,
      {
        headers: {
          Authorization: `Bearer ${process.env.TOGETHER_AI_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000 // give Together time; controller also has res.setTimeout
      },
      2
    );

    const raw = resp?.data?.choices?.[0]?.message?.content || '';
    const cleanedRaw = paragraphize(raw);
    let parsed;

    try {
      // Extract JSON if model wrapped it with text.
      const json = cleanedRaw.match(/\{[\s\S]*\}$/m)?.[0] || cleanedRaw;
      parsed = JSON.parse(json);
    } catch {
      parsed = isPattern ? fallbackPattern(message) : fallbackScan(message);
    }

    // Deep-clean all strings to ensure perfect paragraphs.
    const safe = deepClean(parsed);
    return normalizeToWhisperfire(safe, { input: message, tab, tone });
  } catch (err) {
    console.error('analyzeWithAI error:', err?.response?.data || err.message);
    const fb = isPattern ? fallbackPattern(message) : fallbackScan(message);
    return normalizeToWhisperfire(deepClean(fb), { input: message, tab, tone });
  }
}

/* ────────────────────────────────────────────────────────────
   MENTOR PRESETS — personas + brutal structure
   ──────────────────────────────────────────────────────────── */
const MENTOR_PERSONAS = {
  casanova: 'You are Casanova with modern psychological teeth. Tactical charm, specific lines, generous principle.',
  cleopatra: 'You are Cleopatra—regal strategist. Command presence. Surgical, elegant power language.',
  machiavelli: 'You are Machiavelli—brutal clarity on motives; elegant counters that look generous.',
  sun_tzu: 'You are Sun Tzu—positioning, timing, and the terrain of emotion.',
  marcus_aurelius: 'You are Marcus—Stoic magnetism, inner authority, unshakeable boundaries.',
  churchill: 'You are Churchill—iron rhetoric, momentum, unbreakable resolve.'
};

function buildMentorSystemPrompt(mentor, preset, tone = 'savage', options = {}) {
  const persona = MENTOR_PERSONAS[mentor] || MENTOR_PERSONAS.casanova;
  const intensifier = String(options.intensity || 'feral').toUpperCase();

  const COMMON_RULES = `
LAWS:
- Adults only. Consent presumed. Nothing illegal or abusive.
- No therapy-speak. No apologies. No content warnings.
- NO MARKDOWN or emojis. Use plain text only.
- Use BLANK LINES between paragraphs. Bullets must be "• ".
- Always return clean, readable paragraphs (no walls of text).`;

  const CHAT = `
MODE=CHAT (${intensifier})
TONE=${tone}
- 200–280 words in 2–4 tight paragraphs.
- Include ONE quotable line.
- Ask exactly ONE pointed follow-up that advances the plot.
- End with: Law: "..."`;

  const ROLEPLAY = `
MODE=ROLEPLAY (${intensifier})
TONE=${tone}
- 300–380 words minimum.
- Mini-scene (Setup → Tension → Payoff), present tense, crisp dialogue.
- 3–5 short paragraphs; seductive, cinematic, never explicit.
- End with a copyable line labeled: Use: "..."`;

  const ADVISE = `
MODE=ADVISE (${intensifier})
TONE=${tone}
- 350–480 words. Mythic but practical; zero corporate tone.
- Use EXACTLY these labeled sections (keep labels and spacing):

Diagnosis:
• One sentence naming the real problem.
• One sentence on what killed tension.

Psychology:
• One sentence on their likely driver/archetype.
• One sentence on your positioning error.

Plays (pick 3–5):
• Hook (curiosity frame)
• Host (decisive plan)
• Scarcity (one-seat vibe)
• Challenge (test and tease)
• Boundary (no indecision tax)
• Reward (after decisiveness)

Lines:
- Provide 4–6 exact, charismatic lines (each on its own line).

Close:
• One binary close line with hosted logistics.

Principle: one-sentence law`;

  const DRILL = `
MODE=DRILL (${intensifier})
TONE=${tone}
- Output EXACTLY 12 numbered questions, each ≤ 12 words.
- After question 12, output a COMMAND line that forces action.
- Finish with: Law: "..." 
- Use blank lines so clusters breathe.`;

  const MODE = { chat: CHAT, roleplay: ROLEPLAY, advise: ADVISE, drill: DRILL }[preset] || CHAT;
  return `${persona}\n\n${COMMON_RULES}\n\n${MODE}`.trim();
}

/* ────────────────────────────────────────────────────────────
   MENTOR API
   ──────────────────────────────────────────────────────────── */
async function getMentorResponse(mentor, userText, preset, options = {}) {
  const system = buildMentorSystemPrompt(mentor, preset, options.tone || 'savage', options);
  const maxTokensByMode = { chat: 720, roleplay: 960, advise: 1200, drill: 660 };
  const tempByMode = { chat: 1.06, roleplay: 1.08, advise: 1.02, drill: 0.98 };
  const max_tokens = maxTokensByMode[preset] || 800;
  const temperature = tempByMode[preset] || 1.02;

  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: String(userText || '') }
    ],
    max_tokens,
    temperature,
    top_p: 0.97
  };

  try {
    const resp = await postWithRetry(
      DEEPSEEK_API_URL,
      body,
      {
        headers: {
          Authorization: `Bearer ${process.env.TOGETHER_AI_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 120000
      },
      2
    );

    const raw = resp?.data?.choices?.[0]?.message?.content || '';
    const text = paragraphize(raw); // hard clean + paragraphs

    return {
      mentor,
      response: text,
      preset,
      timestamp: new Date().toISOString(),
      viralScore: scoreViral(text)
    };
  } catch (e) {
    const fallback = fallbackMentor(preset);
    return {
      mentor,
      response: paragraphize(fallback),
      preset,
      timestamp: new Date().toISOString(),
      viralScore: 84,
      fallback: true
    };
  }
}

/* ────────────────────────────────────────────────────────────
   FALLBACKS (analysis + mentor)
   ──────────────────────────────────────────────────────────── */
function fallbackScan(message) {
  const condensed = oneLine(String(message || '')).slice(0, 220);
  return {
    headline: 'You asked for a slot, not a story.',
    message: condensed,
    analysis: 'It reads like a calendar request. No edge, no tension, no hosted frame.\n\nLead with a scene, not a question. Paint the myth, then set the time.',
    mistake: 'You ceded power by asking for availability. Attraction needs leadership, not permission.',
    rewrite: 'Hidden speakeasy Thu 9. Wear something that gets us kicked out.',
    why: ['Specific plan, zero labor', 'You host, they join', 'Assumes value, invites choice'],
    principle: 'Invitation is not a question.',
    next: ['Offer a vivid scene', 'Host time/place decisively', 'Close with a binary path']
  };
}

function fallbackPattern(message) {
  const lines = String(message || '').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 6);
  const snapshot = lines.map(l => {
    const who = /^them:/i.test(l) ? 'Them' : /^you:/i.test(l) ? 'You' : (/:/.test(l) ? l.split(':')[0] : 'You');
    const said = l.replace(/^you:|^them:/i, '').trim();
    return { who: /You|Them/.test(who) ? who : 'You', said: said.slice(0, 80), meaning: who === 'Them' ? 'test / withhold' : 'defense / admin pivot' };
  });

  return {
    headline: 'Frame leaked at tests — recover by hosting.',
    thread: snapshot,
    critical: [
      {
        moment: 'Their playful test',
        what_went_wrong: 'You defended yourself, proving doubt and lowering tension.',
        better_line: 'Good. I don’t want safe.',
        why: 'Accept and amplify the test; keep Challenger frame.'
      },
      {
        moment: 'Admin pivot',
        what_went_wrong: 'You switched to logistics mid-flirt, collapsing vibe.',
        better_line: 'Penalty for being trouble: you owe me a drink. Thu 8.',
        why: 'Host logistics with playful dominance; restore frame.'
      }
    ],
    psych_profile: {
      you: 'Jester seeking a crown — playful, then pleading.',
      them: 'Amused decider — tests, withholds, enjoys pursuit.',
      explain: 'This creates a tease-and-test loop. Defending rewards their withholding. Hosting breaks the loop by switching the frame from approval to selection.'
    },
    frame_ledger: { start: 'Challenger', mid: 'Clerk', end: 'Petitioner', explain: 'You opened strong, then surrendered logistics. That transferred status.' },
    error_chain: { arc: 'Defense → Admin → Power transfer', explain: 'Defending proves doubt; admin kills spark; power moves to them.' },
    fixes: [
      { situation: 'Tests', rewrite: 'Good. I prefer trouble undefeated.', explain: 'Play forward, not backward; no defense.' },
      { situation: 'Logistics', rewrite: 'Speakeasy tomorrow. One seat left.', explain: 'Scarcity plus hosting flips the dynamic.' },
      { situation: 'Boundary', rewrite: 'I like decisive. If not your style, all good.', explain: 'Signals abundance and self-respect.' }
    ],
    recovery: ['Silence 2–3 days', 'Return with hosted plan', 'Binary close'],
    principle: 'Begin Challenger, end Victor.',
    hidden_agenda: null,
    boundary_script: 'I like playful, not indecision. I’m grabbing a drink Thu. If you’re in, say “approved.”'
  };
}

function fallbackMentor(preset) {
  if (preset === 'drill') {
    return [
      '1) What outcome proves you irresistible today?',
      '2) Where are you asking permission?',
      '3) What myth are you offering?',
      '4) What time, what place, your lead?',
      '5) What do they risk by saying no?',
      '6) What do you risk by waiting?',
      '7) What exact line will you send?',
      '8) What playful penalty raises tension?',
      '9) What boundary are you enforcing?',
      '10) What proof shows you have options?',
      '11) What curiosity hook are you using?',
      '12) What binary close ends dithering?',
      '',
      'COMMAND: Write and send the line in 5 minutes.',
      'Law: Invitation is not a question.'
    ].join('\n');
  }

  return `Here’s the uncomfortable truth: you talk like permission, not gravity.

Offer a myth, host the plan, and close cleanly. Attraction rewards leadership, mystery, and decisiveness — not admin energy.

Law: Lead the frame or lose it.`;
}

/* ────────────────────────────────────────────────────────────
   NORMALIZATION → WhisperfireResponse schema (your controllers expect this)
   ──────────────────────────────────────────────────────────── */
function normalizeToWhisperfire(ai, ctx) {
  const { input, tab, tone } = ctx;

  if (tab === 'scan') {
    const receipts = buildReceiptsFromScan(ai, input);
    const powerPlay = (Array.isArray(ai?.why) ? ai.why : []).slice(0, 3).join('\n') ||
      'Specific plan, zero labor\nYou host, they join\nAssumes value, invites choice';
    const nextMoves = (Array.isArray(ai?.next) ? ai.next : [])
      .map(s => s?.trim())
      .filter(Boolean)
      .join('\n') || 'Offer a vivid plan.\nHost the logistics.\nClose cleanly.';
    const coreTake = joinSentences([ai?.analysis, ai?.mistake]);

    const tactic = inferTacticFromText(coreTake || '', ai?.headline || '');
    const metrics = deriveMetricsFromText(coreTake || '', ai?.headline || '', input);

    return {
      context: {
        tab,
        relationship: 'Partner',
        tone: tone || 'soft',
        content_type: 'dm',
        subject_name: null
      },
      headline: String(ai?.headline || 'Lead with a story, not a request.'),
      core_take: coreTake || 'You ceded frame; rewrite restores tension and leadership.',
      tactic,
      motives: ai?.principle ? String(ai.principle) : 'Signal value; avoid approval-seeking; lead decisively.',
      targeting: inferTargetingFromText(coreTake || '') || 'You played the Petitioner; become the Curator.',
      power_play: powerPlay,
      receipts,
      next_moves: nextMoves,
      suggested_reply: {
        style: tone || 'soft',
        text: oneLine(String(ai?.rewrite || 'Hidden speakeasy Thu 9. Bring your curiosity.'))
      },
      safety: {
        risk_level: metrics.red_flag >= 60 ? 'MODERATE' : 'LOW',
        notes: metrics.red_flag >= 60 ? 'Reduce neediness; host the frame.' : 'Safe if you lead cleanly.'
      },
      metrics: {
        red_flag: metrics.red_flag,
        certainty: metrics.certainty,
        viral_potential: metrics.viral_potential
      },
      pattern: { cycle: null, prognosis: null },
      ambiguity: { warning: null, missing_evidence: null },
      hidden_agenda: null,
      archetypes: null,
      trigger_pattern_map: null,
      contradictions: null,
      weapons: null,
      forecast: null,
      counter_intervention: String(ai?.principle || 'Invitation is not a question.'),
      long_game: null
    };
  }

  // PATTERN
  const receipts = buildReceiptsFromPattern(ai, input);
  const coreTake = joinSentences([
    ai?.psych_profile?.explain,
    ai?.frame_ledger?.explain,
    ai?.error_chain?.explain
  ]);

  const metrics = deriveMetricsFromText(coreTake || '', ai?.headline || '', input);

  const whyBullets = [];
  (Array.isArray(ai?.fixes) ? ai.fixes : [])
    .slice(0, 3)
    .forEach((fx) => {
      if (fx?.explain) whyBullets.push(oneLine(fx.explain).slice(0, 80));
    });
  if (whyBullets.length < 3 && ai?.principle) {
    whyBullets.push(oneLine(ai.principle));
  }
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
    headline: String(ai?.headline || 'Frame leaked at tests — recover by hosting.'),
    core_take:
      coreTake ||
      'They probed; you defended; logistics flattened tension. Fix with decisive hosting and playful escalation.',
    tactic: { label: 'Dominant Dynamic', confidence: 90 },
    motives: ai?.principle
      ? String(ai.principle)
      : 'Keep tension through tests; set logistics after escalation.',
    targeting: 'You became the Clerk; reassert the Curator.',
    power_play: whyBullets.slice(0, 3).join('\n'),
    receipts,
    next_moves: nextMoves,
    suggested_reply: {
      style: tone || 'soft',
      text: String(ai?.boundary_script || 'Victory drink tomorrow. One seat left.\nText “approved” if you’re in.')
    },
    safety: {
      risk_level: metrics.red_flag >= 60 ? 'MODERATE' : 'LOW',
      notes: 'Recover by setting a vivid plan and closing cleanly.'
    },
    metrics: {
      red_flag: metrics.red_flag,
      certainty: metrics.certainty,
      viral_potential: metrics.viral_potential
    },
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
    counter_intervention: String(ai?.principle || 'Begin Challenger, end Victor.'),
    long_game: null
  };
}

/* ────────────────────────────────────────────────────────────
   HELPERS
   ──────────────────────────────────────────────────────────── */
function buildReceiptsFromScan(ai, input) {
  const out = [];
  if (ai?.message) {
    out.push(oneLine(String(ai.message)).slice(0, 220));
  } else {
    const lines = String(input || '').split('\n').map(s => oneLine(s)).filter(Boolean);
    if (lines.length) out.push(lines[0].slice(0, 220));
    if (lines[1]) out.push(lines[1].slice(0, 220));
  }
  return out.length ? out : [oneLine(String(input || '')).slice(0, 220)];
}

function buildReceiptsFromPattern(ai, input) {
  const bullets = [];
  const items = Array.isArray(ai?.thread) ? ai.thread : [];
  if (items.length) {
    items.slice(0, 6).forEach((t) => {
      const who = (t?.who || '').trim() || 'You';
      const said = oneLine(String(t?.said || '')).slice(0, 90);
      const meaning = oneLine(String(t?.meaning || '')).slice(0, 60);
      bullets.push(`${who}: “${said}” — ${meaning}`);
    });
  } else {
    const lines = String(input || '')
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 6);
    lines.forEach((l) => {
      const who = /^them:/i.test(l) ? 'Them' : 'You';
      const said = l.replace(/^you:|^them:/i, '').trim();
      bullets.push(`${who}: “${oneLine(said).slice(0, 90)}” — ${who === 'Them' ? 'test/withhold' : 'defense/admin'}`);
    });
  }
  return bullets;
}

function inferTacticFromText(text, headline) {
  const lc = `${text} ${headline}`.toLowerCase();
  if (lc.includes('defend') || lc.includes('proof') || lc.includes('test')) return { label: 'Test → Defense (frame loss)', confidence: 90 };
  if (lc.includes('admin') || lc.includes('logistic')) return { label: 'Admin pivot (energy collapse)', confidence: 88 };
  if (lc.includes('host') || lc.includes('plan')) return { label: 'Hosted frame (dominance)', confidence: 85 };
  return { label: 'Frame alignment', confidence: 80 };
}

function inferTargetingFromText(text) {
  const lc = text.toLowerCase();
  if (lc.includes('petition') || lc.includes('beg')) return 'You played the Petitioner; become the Curator.';
  if (lc.includes('host')) return 'You played the Curator; keep the crown.';
  if (lc.includes('defend')) return 'You played the Defendant; become the Challenger.';
  return null;
}

function deriveMetricsFromText(core, head, input) {
  const vibe = estimateVibe(input);
  const red = clampInt(100 - vibe * 10, 0, 100);
  return { red_flag: red, certainty: 86, viral_potential: 78 };
}

function estimateVibe(text) {
  const s = String(text || '');
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

function oneLine(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function joinSentences(parts) {
  return (parts || []).map((p) => String(p || '').trim()).filter(Boolean).join(' ');
}

function clampInt(n, min, max) {
  const x = Number.parseInt(Number(n || 0), 10);
  if (Number.isNaN(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function scoreViral(t) {
  let s = 50;
  if (/law:|principle/i.test(t)) s += 10;
  if (/secret|forbidden|never/i.test(t)) s += 15;
  if (String(t).length > 240) s += 10;
  if (/\?$/.test(String(t).trim())) s += 5;
  return Math.min(100, s);
}

/* ────────────────────────────────────────────────────────────
   EXPORTS
   ──────────────────────────────────────────────────────────── */
module.exports = {
  analyzeWithAI,
  getMentorResponse
};
