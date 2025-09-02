// services/aiService.js — ORACLE SEDUCER (Back-to-Original+Plus)
// Purpose: restore your earlier "mad, seductive, long, structured" behavior
// - Together API (DeepSeek-V3)
// - Large token budgets, higher temps, long timeouts, retry, keep-alive
// - Analyze (scan/pattern): strict JSON, detailed, with strong next-lines
// - Mentor presets: ADVISE / DRILL / ROLEPLAY / CHAT — long, spaced, surgical

const axios = require('axios');
const http = require('http');
const https = require('https');

const DEEPSEEK_API_URL = 'https://api.together.xyz/v1/chat/completions';
const MODEL = 'deepseek-ai/DeepSeek-V3';

// keep sockets alive for long calls
const keepAliveHttp = new http.Agent({ keepAlive: true, maxSockets: 50 });
const keepAliveHttps = new https.Agent({ keepAlive: true, maxSockets: 50 });

/* ────────────────────────────────────────────────────────────
   UTIL: retry + keep-alive
   ──────────────────────────────────────────────────────────── */
async function postWithRetry(url, data, config, retries = 2) {
  let attempt = 0, lastErr;
  while (attempt <= retries) {
    try {
      return await axios.post(url, data, {
        httpAgent: keepAliveHttp,
        httpsAgent: keepAliveHttps,
        ...config
      });
    } catch (e) {
      lastErr = e;
      const status = e?.response?.status;
      if (!(status === 429 || (status >= 500 && status <= 599))) break;
      const wait = Math.min(2000 * Math.pow(2, attempt), 8000);
      await new Promise(r => setTimeout(r, wait));
      attempt++;
    }
  }
  throw lastErr;
}

/* ────────────────────────────────────────────────────────────
   (Optional) gentle normalizer for punctuation/spacing
   (Your mentorController already cleans mojibake; this is extra-safe.)
   ──────────────────────────────────────────────────────────── */
function softNormalize(s = '') {
  return String(s)
    .replace(/\u00A0/g, ' ')
    .replace(/Â+/g, '')
    .replace(/([“”])/g, '"')
    .replace(/([‘’])/g, "'")
    .replace(/[–—]/g, '—') // keep emdash pretty; mentorController can ASCII it
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ────────────────────────────────────────────────────────────
   ANALYZE PROMPTS — restored tone, bigger depth, strict JSON
   ──────────────────────────────────────────────────────────── */
function buildScanPrompt(tone, multi) {
  return `
ROLE: Elite seduction strategist. You dissect the user's line(s), name the real mistake,
and rebuild a line that PULLS (myth + hosted plan + binary close).

TONE=${tone}  // savage=blade truth, soft=velvet steel, clinical=forensic cool

OUTPUT: JSON ONLY (no markdown, no emojis) with EXACT keys:
{
  "headline": "One-line verdict that stings but teaches.",
  "message": "Short quote of the user's line(s).",
  "analysis": "5–8 sentences of plain-English decoding (what actually happened).",
  "mistake": "2–3 sentences naming the core error and its cost.",
  "rewrite": "One elite replacement line (or two short options).",
  "why": ["Reason 1 (<=10 words)", "Reason 2 (<=10 words)", "Reason 3 (<=10 words)"],
  "principle": "One sentence law to keep.",
  "next": ["Command 1", "Command 2", "Command 3"]
}

RULES:
- Speak to the USER (the sender). No advice to 'them'.
- Rewrite must be decisive, specific, charismatic (no admin energy).
- Exactly THREE bullets in "why".
- Use blank lines inside string values when useful for readability.
- Aim ~200–280 words total. Rich, not bloated.
- Adults only, consent presumed. No illegal/abusive content.

TASK: Analyze ${multi ? 'a compact set of messages (mostly the user’s)' : 'one message'} and deliver surgical coaching.`;
}

function buildPatternPrompt(tone) {
  return `
ROLE: War-room strategist of seduction. Decode moves, frame transfers, tests, and recovery.

TONE=${tone}

OUTPUT: JSON ONLY (no markdown, no emojis) with EXACT keys:
{
  "headline": "One-line verdict on the engagement.",
  "thread": [
    { "who": "You|Them", "said": "short quote", "meaning": "what that line was doing" }
  ],
  "critical": [
    { "moment": "Name", "what_went_wrong": "1–2 sentences", "better_line": "exact replacement", "why": "1–2 sentences (principle)" }
  ],
  "psych_profile": {
    "you": "archetype + behavioral read (2–3 sentences)",
    "them": "archetype + behavioral read (2–3 sentences)",
    "explain": "what this pairing creates (3–5 sentences)"
  },
  "frame_ledger": { "start": "X", "mid": "Y", "end": "Z", "explain": "3–4 sentences" },
  "error_chain": { "arc": "Error1 → Error2 → Error3", "explain": "2–3 sentences" },
  "fixes": [
    { "situation": "where to apply", "rewrite": "exact line", "explain": "1–2 sentences (why it flips the frame)" }
  ],
  "recovery": ["Step 1", "Step 2", "Step 3"],
  "principle": "One sentence rule to keep.",
  "hidden_agenda": "null or one-sentence hypothesis",
  "boundary_script": "clean boundary script; multi-line allowed"
}

RULES:
- Keep "thread" compact with MEANING (no transcript dump).
- Provide 2–3 "critical" moments; each has ONE surgical better line.
- Provide 2–4 reusable "fixes".
- Aim ~260–380 words total.
- Adults only, consent presumed. No illegal/abusive content.

TASK: Analyze a multi-message thread (USER = "You", counterpart = "Them").`;
}

/* ────────────────────────────────────────────────────────────
   MAIN ANALYZE CALL
   ──────────────────────────────────────────────────────────── */
async function analyzeWithAI(message, tone, tab = 'scan') {
  const isPattern = tab === 'pattern';
  const multi = tab === 'scan' && /(\n|—|-{2,}|;)/.test(String(message || ''));
  const system = isPattern ? buildPatternPrompt(tone) : buildScanPrompt(tone, multi);

  const userContent = isPattern
    ? `THREAD (alternating "You:" / "Them:"):\n${message}\n\nReturn EXACTLY the JSON schema.`
    : `MESSAGE(S):\n${message}\n\nReturn EXACTLY the JSON schema.`;

  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userContent }
    ],
    max_tokens: isPattern ? 2200 : 1500,
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
        timeout: 120000 // 120s
      },
      2
    );

    const raw = resp?.data?.choices?.[0]?.message?.content || '';
    let parsed;
    try {
      const json = raw.match(/\{[\s\S]*\}$/m)?.[0] || raw;
      parsed = JSON.parse(json);
    } catch {
      parsed = isPattern ? fallbackPattern(message) : fallbackScan(message);
    }

    const norm = normalizeToWhisperfire(parsed, { input: message, tab, tone });
    // optional soft spacing fix (Analyze already renders fine)
    norm.suggested_reply = norm.suggested_reply || {};
    norm.suggested_reply.text = softNormalize(norm.suggested_reply.text || '');
    return norm;
  } catch (err) {
    console.error('analyzeWithAI error:', err?.response?.data || err.message);
    const fb = isPattern ? fallbackPattern(message) : fallbackScan(message);
    const norm = normalizeToWhisperfire(fb, { input: message, tab, tone });
    norm.suggested_reply = norm.suggested_reply || {};
    norm.suggested_reply.text = softNormalize(norm.suggested_reply.text || '');
    return norm;
  }
}

/* ────────────────────────────────────────────────────────────
   MENTOR PERSONAS + MODES — restored + upgraded
   ──────────────────────────────────────────────────────────── */
const MENTOR_PERSONAS = {
  casanova: 'You are Casanova with modern psychological teeth. Charm = curated myth + hosted logistics + playful dominance.',
  cleopatra: 'You are Cleopatra—regal strategist. Sovereign frame, surgical patience, decisive reward/punishment.',
  machiavelli: 'You are Machiavelli—brutal clarity on incentives; counters that appear generous.',
  sun_tzu: 'You are Sun Tzu—win before speaking: position, timing, terrain of emotion.',
  marcus_aurelius: 'You are Marcus—Stoic magnetism, inner authority, elegant boundaries.',
  churchill: 'You are Churchill—iron rhetoric, momentum, unfakeable conviction.'
};

function buildMentorSystemPrompt(mentor, preset, tone = 'savage', options = {}) {
  const persona = MENTOR_PERSONAS[mentor] || MENTOR_PERSONAS.casanova;
  const intensifier = String(options.intensity || 'feral').toUpperCase();

  const COMMON = `
LAWS:
- Adults only. Consent presumed. No illegal/abusive instructions.
- No therapy-speak. No apologies. No content warnings.
- NO MARKDOWN. Do not use *, _, #, or emojis. Pure text.
- Use BLANK LINES between paragraphs. Bullets as "• ".
- Every answer must be actionable and quotable.`;

  const CHAT = `
MODE=CHAT (${intensifier})  TONE=${tone}
- 120–180 words. 1–3 crisp paragraphs.
- Include ONE quotable line.
- Ask ONE pointed follow-up that advances the plot (last line starts with: Question:)`;

  const ROLEPLAY = `
MODE=ROLEPLAY (${intensifier})  TONE=${tone}
- Build a scene that fits the user's situation.
- Beats: Setup → Tension → Payoff. Present tense, tight dialogue.
- 200–260 words.
- End with: Use: "copyable line"`;  

  const ADVISE = `
MODE=ADVISE (${intensifier})  TONE=${tone}
- Output MUST include these blocks in this order:
• The Play (one sentence: the core move)
• Psychology (one sentence: why it works)
• Risks (one sentence: what NOT to do)
• Logistics (one sentence: time/place/hosted)
• Hook (one sentence: curiosity/mystique)
Line: "your exact line"
Principle: one sentence law
Why it works:
• Reason 1
• Reason 2
• Reason 3
- 230–320 words total. Space the blocks with blank lines.`;

  const DRILL = `
MODE=DRILL (${intensifier})  TONE=${tone}
- Output exactly 12 numbered questions (<= 12 words each).
- Then one COMMAND line that forces action now.
- End with: Law: "<one sentence>"
- Use blank lines for readability.`;

  const MODE = { advise: ADVISE, drill: DRILL, roleplay: ROLEPLAY, chat: CHAT }[preset] || CHAT;
  return `${persona}\n\n${COMMON}\n\n${MODE}`.trim();
}

/* ────────────────────────────────────────────────────────────
   MENTOR API
   ──────────────────────────────────────────────────────────── */
async function getMentorResponse(mentor, userText, preset, options = {}) {
  const system = buildMentorSystemPrompt(mentor, preset, options.tone || 'savage', options);
  const maxTokensByMode = { chat: 600, roleplay: 900, advise: 1000, drill: 600 };
  const tempByMode = { chat: 1.06, roleplay: 1.12, advise: 1.02, drill: 0.98 };
  const max_tokens = maxTokensByMode[preset] || 700;
  const temperature = tempByMode[preset] || 1.04;

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
    const text = softNormalize(resp?.data?.choices?.[0]?.message?.content || '');
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
      response: fallback,
      preset,
      timestamp: new Date().toISOString(),
      viralScore: 84,
      fallback: true
    };
  }
}

/* ────────────────────────────────────────────────────────────
   FALLBACKS (don’t change your UX if model hiccups)
   ──────────────────────────────────────────────────────────── */
function fallbackScan(message) {
  const condensed = oneLine(String(message || '')).slice(0, 220);
  return {
    headline: 'You asked for a slot, not a story.',
    message: condensed,
    analysis: 'It reads like a calendar request. No myth, no hosted frame, low tension. Lead with a scene that feels like an invitation to mischief.',
    mistake: 'Approval seeking and admin energy. You transferred power by asking instead of curating.',
    rewrite: 'Hidden speakeasy Thu 9. One seat left. Wear something that gets us banned.',
    why: ['Specific plan, zero labor', 'You host, they join', 'Assumes value, invites choice'],
    principle: 'Invitation is not a question.',
    next: ['Offer a vivid scene', 'Host time and place', 'Close with a binary path']
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
      { moment: 'Their playful test', what_went_wrong: 'You defended. Defense proves doubt and lowers tension.', better_line: 'Good. I don’t want safe.', why: 'Accept + amplify keeps you Challenger.' },
      { moment: 'Admin pivot', what_went_wrong: 'You dropped into logistics mid-flirt.', better_line: 'Penalty for being trouble: you owe me a drink. Thu 8.', why: 'Hosted plan restores frame + scarcity.' }
    ],
    psych_profile: {
      you: 'Jester seeking a crown — playful, then pleading.',
      them: 'Amused decider — tests, withholds, enjoys pursuit.',
      explain: 'When you defend, you reward withholding. Host the frame; tension returns and choices become yours to grant.'
    },
    frame_ledger: { start: 'Challenger', mid: 'Clerk', end: 'Petitioner', explain: 'Power migrated when you asked and justified. Curate, don’t beg.' },
    error_chain: { arc: 'Defense → Admin → Power transfer', explain: 'Defending signals need. Admin kills myth. Status moves to them.' },
    fixes: [
      { situation: 'Tests', rewrite: 'Good. I prefer trouble undefeated.', explain: 'Refuses defense; escalates play.' },
      { situation: 'Logistics', rewrite: 'Speakeasy tomorrow. One seat left.', explain: 'Scarcity + hosting flips the frame.' }
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
      '1) What outcome would prove you irresistible today?',
      '2) Where are you asking permission?',
      '3) What myth are you offering?',
      '4) Time and place you’ll host?',
      '5) What do they risk by no?',
      '6) What do you risk by waiting?',
      '7) Exact line you’ll send?',
      '8) Playful penalty that raises tension?',
      '9) Boundary you’ll enforce?',
      '10) What proof you have options?',
      '11) Curiosity hook you’ll deploy?',
      '12) Binary close you’ll use?',
      '',
      'COMMAND: Write and send the line in 5 minutes.',
      'Law: Invitation is not a question.'
    ].join('\n');
  }
  // chat/advise/roleplay fallback
  return `Here’s the uncomfortable truth: you’re asking for acceptance instead of offering an experience.
Set the myth, host the logistics, close cleanly.

Law: Lead the frame or lose it.`;
}

/* ────────────────────────────────────────────────────────────
   NORMALIZATION → WhisperfireResponse (Analyze)
   ──────────────────────────────────────────────────────────── */
function normalizeToWhisperfire(ai, ctx) {
  const { input, tab, tone } = ctx;

  if (tab === 'scan') {
    const receipts = buildReceiptsFromScan(ai, input);
    const powerPlay = (Array.isArray(ai?.why) ? ai.why : []).slice(0, 3).join('\n') ||
      'Specific plan, zero labor\nYou host, they join\nAssumes value, invites choice';
    const nextMoves = (Array.isArray(ai?.next) ? ai.next : []).map(s => s?.trim()).filter(Boolean).join('\n') ||
      'Offer a vivid plan.\nHost the logistics.\nClose cleanly.';
    const coreTake = joinSentences([ai?.analysis, ai?.mistake]);

    const tactic = inferTacticFromText(coreTake || '', ai?.headline || '');
    const metrics = deriveMetricsFromText(coreTake || '', ai?.headline || '', input);

    return {
      context: { tab, relationship: 'Partner', tone: tone || 'soft', content_type: 'dm', subject_name: null },
      headline: String(ai?.headline || 'Lead with a story, not a request.'),
      core_take: coreTake || 'You ceded frame; rewrite restores tension and leadership.',
      tactic,
      motives: ai?.principle ? String(ai.principle) : 'Signal value; avoid approval-seeking; lead decisively.',
      targeting: inferTargetingFromText(coreTake || '') || 'You played the Petitioner; become the Curator.',
      power_play: powerPlay,
      receipts,
      next_moves: nextMoves,
      suggested_reply: { style: tone || 'soft', text: oneLine(String(ai?.rewrite || 'Hidden speakeasy Thu 9. Bring your curiosity.')) },
      safety: { risk_level: metrics.red_flag >= 60 ? 'MODERATE' : 'LOW', notes: metrics.red_flag >= 60 ? 'Reduce neediness; host the frame.' : 'Safe if you lead cleanly.' },
      metrics: { red_flag: metrics.red_flag, certainty: metrics.certainty, viral_potential: metrics.viral_potential },
      pattern: { cycle: null, prognosis: null },
      ambiguity: { warning: null, missing_evidence: null },
      hidden_agenda: null, archetypes: null, trigger_pattern_map: null, contradictions: null, weapons: null, forecast: null,
      counter_intervention: String(ai?.principle || 'Invitation is not a question.'), long_game: null
    };
  }

  // pattern
  const receipts = buildReceiptsFromPattern(ai, input);
  const coreTake = joinSentences([ai?.psych_profile?.explain, ai?.frame_ledger?.explain, ai?.error_chain?.explain]);
  const metrics = deriveMetricsFromText(coreTake || '', ai?.headline || '', input);

  const whyBullets = [];
  (Array.isArray(ai?.fixes) ? ai.fixes : []).slice(0, 3).forEach(fx => { if (fx?.explain) whyBullets.push(oneLine(fx.explain).slice(0, 80)); });
  if (whyBullets.length < 3 && ai?.principle) whyBullets.push(oneLine(ai.principle));
  while (whyBullets.length < 3) whyBullets.push('Host logistics; never beg');

  const nextMoves = (Array.isArray(ai?.recovery) ? ai.recovery : []).map(s => s?.trim()).filter(Boolean).join('\n') ||
    'Silence 2–3 days.\nReturn with hosted plan.\nBinary close.';

  const frameArc = ai?.frame_ledger?.start && ai?.frame_ledger?.mid && ai?.frame_ledger?.end
    ? `${ai.frame_ledger.start} → ${ai.frame_ledger.mid} → ${ai.frame_ledger.end}` : null;

  return {
    context: { tab: 'pattern', relationship: 'Partner', tone: tone || 'soft', content_type: 'dm', subject_name: null },
    headline: String(ai?.headline || 'Frame leaked at tests — recover by hosting.'),
    core_take: coreTake || 'They probed; you defended; logistics flattened tension. Fix with decisive hosting and playful escalation.',
    tactic: { label: 'Dominant Dynamic', confidence: 90 },
    motives: ai?.principle ? String(ai.principle) : 'Keep tension through tests; set logistics after escalation.',
    targeting: 'You became the Clerk; reassert the Curator.',
    power_play: whyBullets.slice(0, 3).join('\n'),
    receipts,
    next_moves: nextMoves,
    suggested_reply: { style: tone || 'soft', text: String(ai?.boundary_script || 'Victory drink tomorrow. One seat left.\nText “approved” if you’re in.') },
    safety: { risk_level: metrics.red_flag >= 60 ? 'MODERATE' : 'LOW', notes: 'Recover by setting a vivid plan and closing cleanly.' },
    metrics: { red_flag: metrics.red_flag, certainty: metrics.certainty, viral_potential: metrics.viral_potential },
    pattern: { cycle: frameArc ? `Frame arc: ${frameArc}` : (ai?.error_chain?.arc || null), prognosis: ai?.error_chain?.arc || 'Defense → Admin → Power transfer' },
    ambiguity: { warning: null, missing_evidence: null },
    hidden_agenda: ai?.hidden_agenda ?? null,
    archetypes: null, trigger_pattern_map: null, contradictions: null, weapons: null, forecast: null,
    counter_intervention: String(ai?.principle || 'Begin Challenger, end Victor.'), long_game: null
  };
}

/* ────────────────────────────────────────────────────────────
   HELPERS
   ──────────────────────────────────────────────────────────── */
function buildReceiptsFromScan(ai, input) {
  const out = [];
  if (ai?.message) out.push(oneLine(String(ai.message)).slice(0, 220));
  else {
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
    items.slice(0, 6).forEach(t => {
      const who = (t?.who || '').trim() || 'You';
      const said = oneLine(String(t?.said || '')).slice(0, 90);
      const meaning = oneLine(String(t?.meaning || '')).slice(0, 60);
      bullets.push(`${who}: “${said}” — ${meaning}`);
    });
  } else {
    const lines = String(input || '').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 6);
    lines.forEach(l => {
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
  return { red_flag: red, certainty: 86, viral_potential: 76 };
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

function oneLine(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
function joinSentences(parts) { return (parts || []).map(p => String(p || '').trim()).filter(Boolean).join(' '); }
function clampInt(n, min, max) { const x = Number.parseInt(Number(n || 0), 10); if (Number.isNaN(x)) return min; return Math.max(min, Math.min(max, x)); }

function scoreViral(t) {
  let s = 50;
  if (/law:|principle/i.test(t)) s += 10;
  if (/secret|forbidden|never/i.test(t)) s += 15;
  if ((t || '').length > 220) s += 10;
  if (/\?$/.test(String(t || '').trim())) s += 5;
  return Math.min(100, s);
}

/* ────────────────────────────────────────────────────────────
   EXPORTS
   ──────────────────────────────────────────────────────────── */
module.exports = {
  analyzeWithAI,
  getMentorResponse
};
