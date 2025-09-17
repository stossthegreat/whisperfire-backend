// services/aiService.js — ORACLE SEDUCER v3 MAX (stabilized, strict JSON, no fallback spam)
const axios = require('axios');
const http = require('http');
const https = require('https');

/* ================================
   TOGETHER / MODEL CONFIG
   ================================ */
const DEEPSEEK_API_URL = 'https://api.together.xyz/v1/chat/completions';
const MODEL = 'deepseek-ai/DeepSeek-V3';

// Keep-alive agents for long jobs
const keepAliveHttp = new http.Agent({ keepAlive: true, maxSockets: 64 });
const keepAliveHttps = new https.Agent({ keepAlive: true, maxSockets: 64 });

/* ================================
   RETRY WRAPPER (429/5xx with backoff)
   ================================ */
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
      // Only retry on rate limit / transient server errors
      if (!(status === 429 || (status >= 500 && status <= 599))) break;
      const wait = Math.min(2000 * Math.pow(2, attempt), 8000);
      await new Promise(r => setTimeout(r, wait));
      attempt++;
    }
  }
  throw lastErr;
}

/* ================================
   PROMPT BUILDERS (UNCHANGED KEYS)
   — Tightened language; JSON-only oath
   ================================ */
function buildScanPrompt(tone, multi) {
  return `
ROLE: You are the world's sharpest seduction mentor.
OUTPUT: Return a SINGLE JSON object ONLY. No preface. No markdown. No extra text.

TONE=${tone}

TASK: Analyze ${multi ? 'a small set of messages (mostly from the USER)' : 'one message'} and coach the USER.

MUST OUTPUT EXACTLY these keys (no extras, no omissions):
{
  "headline": "string",
  "message": "string",
  "analysis": "string",
  "mistake": "string",
  "rewrite": "string",
  "why": ["string","string","string"],
  "principle": "string",
  "next": ["string","string","string","string"]
}

RULES:
- JSON only. If you add any text outside JSON, the answer is invalid.
- ASCII quotes only (' and ").
- "why" must be EXACTLY 3 items (<=10 words each).
- "next" must be 4–6 short steps (keep to 4).
- 260–420 words total across fields.`;
}

function buildPatternPrompt(tone, count) {
  return `
ROLE: You are a war-room strategist of seduction.
OUTPUT: Return a SINGLE JSON object ONLY. No preface. No markdown. No extra text.

TONE=${tone}

TASK: Analyze a multi-message thread and decode frames, errors, and fixes.

MUST OUTPUT EXACTLY these keys:
{
  "headline": "string",
  "thread": [{"who":"You|Them","said":"string","meaning":"string"}],
  "critical": [{"moment":"string","what_went_wrong":"string","better_line":"string","why":"string"}],
  "psych_profile": {"you":"string","them":"string","explain":"string"},
  "frame_ledger": {"start":"string","mid":"string","end":"string","explain":"string"},
  "error_chain": {"arc":"string","explain":"string"},
  "fixes": [{"situation":"string","rewrite":"string","explain":"string"}],
  "recovery": ["string","string","string","string"],
  "principle": "string",
  "hidden_agenda": null,
  "boundary_script": "string"
}

RULES:
- JSON only. ASCII quotes only. No emojis/markdown.
- 2–3 items in "critical". 3–5 items in "fixes".
- 420–650 words total across fields.`;
}

/* ================================
   JSON GUARDRAILS
   — extract/repair/parse before fallback
   ================================ */
function scrubSmartQuotes(s = '') {
  return String(s)
    .replace(/Â+/g, '')
    .replace(/â€™|Ã¢â‚¬â„¢|â\u0080\u0099/g, "'")
    .replace(/â€˜|Ã¢â‚¬Ëœ|â\u0080\u0098/g, "'")
    .replace(/â€œ|Ã¢â‚¬Å“|â\u0080\u009C/g, '"')
    .replace(/â€�|Ã¢â‚¬Â|â\u0080\u009D/g, '"')
    .replace(/â€”|Ã¢â‚¬â¢|â\u0080\u0094/g, '—')
    .replace(/â€“|Ã¢â‚¬â€œ|â\u0080\u0093/g, '–')
    .replace(/\u00A0/g, ' ');
}

function extractJsonBlock(raw = '') {
  const t = scrubSmartQuotes(raw).trim();

  // 1) code fence ```json ... ```
  const fence = t.match(/```json([\s\S]*?)```/i);
  if (fence && fence[1]) return fence[1].trim();

  // 2) first { to last } (greedy but bounded)
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first !== -1 && last !== -1 && last > first) {
    return t.slice(first, last + 1);
  }

  // 3) already looks like JSON
  if ((t.startsWith('{') && t.endsWith('}')) || (t.startsWith('[') && t.endsWith(']'))) return t;

  // give up to caller
  return t;
}

function softJsonRepair(maybe = '') {
  let s = maybe;

  // Kill BOM / zero-width
  s = s.replace(/[\u200B-\u200D\uFEFF]/g, '');

  // Strip stray markdown tokens/backticks that sneak in
  s = s.replace(/^[>\s`]+/gm, '');

  // Remove trailing commas before } or ]
  s = s.replace(/,\s*(\}|\])/g, '$1');

  // Ensure JSON quotes are straight double-quotes around keys
  // (only if clearly unquoted keys appear)
  // NOTE: we keep this conservative to avoid breaking valid JSON
  // No aggressive key quoting here; rely on model compliance + fence extraction.

  return s.trim();
}

function tryParseJson(raw = '') {
  const block = extractJsonBlock(raw);
  try {
    return JSON.parse(block);
  } catch {
    const repaired = softJsonRepair(block);
    try {
      return JSON.parse(repaired);
    } catch {
      return null;
    }
  }
}

/* ================================
   SCHEMA HELPERS
   — keep app shape stable
   ================================ */
function oneLine(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
function joinSentences(parts) { return (parts || []).map(p => String(p || '').trim()).filter(Boolean).join(' '); }
function clampInt(n, min, max) {
  const x = Number.parseInt(Number(n || 0), 10);
  if (Number.isNaN(x)) return min;
  return Math.max(min, Math.min(max, x));
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

/* ================================
   FALLBACKS (only on hard failure)
   ================================ */
function fallbackScan(message, tone) {
  const condensed = oneLine(String(message || '')).slice(0, 200);
  const vibe = estimateVibe(message);
  const rewrite = vibe >= 7
    ? 'Keep Thu 9. I’m stealing you for the speakeasy.'
    : 'Hidden speakeasy Thu 9. Wear something that gets us kicked out.';

  return {
    headline: vibe >= 7 ? 'Clean invite. Tighten the myth.' : 'You asked for a slot, not a story.',
    message: condensed,
    analysis: vibe >= 7
      ? 'You lead with a plan. Good. Add mystique and scarcity to raise pull.'
      : 'It reads like a calendar request. No edge, no tension, no hosted frame.',
    mistake: vibe >= 7
      ? 'Logistics are solid, but the energy is flat: no myth, no scarcity.'
      : 'You ceded power by asking for availability. Attraction needs leadership.',
    rewrite,
    why: [
      'Specific plan, zero labor',
      'You host, they join',
      'Assumes value, invites choice'
    ],
    principle: 'Invitation is not a question.',
    next: ['Offer a vivid scene', 'Set time/place decisively', 'Close with a binary path', 'No admin texts']
  };
}

function fallbackPattern(message, tone) {
  const lines = (String(message || '').split('\n').map(s => s.trim()).filter(Boolean)).slice(0, 6);
  const snapshot = lines.map(l => {
    const who = /^them:/i.test(l) ? 'Them' : /^you:/i.test(l) ? 'You' : (/:/.test(l) ? l.split(':')[0] : 'You');
    const said = l.replace(/^you:|^them:/i, '').trim();
    return { who: /You|Them/.test(who) ? who : 'You', said: said.slice(0, 80), meaning: who === 'Them' ? 'test / withhold' : 'defense / admin pivot' };
  });

  return {
    headline: 'Frame leaked at tests — recover by hosting.',
    thread: snapshot,
    critical: [
      { moment: 'Their playful test', what_went_wrong: 'You defended, proving doubt and lowering tension.', better_line: 'Good. I don’t want safe.', why: 'Accept & amplify. No defense.' },
      { moment: 'Admin pivot', what_went_wrong: 'You switched to logistics mid-flirt, collapsing vibe.', better_line: 'Penalty for being trouble: you owe me a drink. Thu 8.', why: 'Host logistics with playful dominance.' }
    ],
    psych_profile: {
      you: 'Jester seeking a crown — playful, then pleading.',
      them: 'Amused decider — tests, withholds, enjoys pursuit.',
      explain: 'This pairing creates a tease-and-test loop. Defending rewards withholding. Host the frame to break it.'
    },
    frame_ledger: { start: 'Challenger', mid: 'Clerk', end: 'Petitioner', explain: 'You opened strong, then surrendered logistics. Status transferred.' },
    error_chain: { arc: 'Defense → Admin → Power transfer', explain: 'Defending proves doubt; admin kills spark; power moves to them.' },
    fixes: [
      { situation: 'Tests', rewrite: 'Good. I prefer trouble undefeated.', explain: 'Accept and amplify to keep Challenger frame.' },
      { situation: 'Logistics', rewrite: 'Speakeasy tomorrow. One seat left.', explain: 'Scarcity + hosting flips the frame.' },
      { situation: 'Close', rewrite: 'Text "approved" if you’re in.', explain: 'Binary close avoids negotiation energy.' }
    ],
    recovery: ['Silence 2–3 days', 'Return with hosted plan', 'Binary close', 'No defense or admin chats'],
    principle: 'Begin Challenger, end Victor.',
    hidden_agenda: null,
    boundary_script: 'I like playful, not indecision. I’m grabbing a drink Thu. If you’re in, say “approved.”'
  };
}

/* ================================
   NORMALIZATION to Whisperfire shape
   ================================ */
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
    items.slice(0, 6).forEach(t => {
      const who = (t?.who || '').trim() || 'You';
      const said = oneLine(String(t?.said || '')).slice(0, 90);
      const meaning = oneLine(String(t?.meaning || '')).slice(0, 60);
      bullets.push(`${who}: "${said}" — ${meaning}`);
    });
  } else {
    const lines = String(input || '').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 6);
    lines.forEach(l => {
      const who = /^them:/i.test(l) ? 'Them' : 'You';
      const said = l.replace(/^you:|^them:/i, '').trim();
      bullets.push(`${who}: "${oneLine(said).slice(0, 90)}" — ${who === 'Them' ? 'test/withhold' : 'defense/admin'}`);
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
  const lc = (text || '').toLowerCase();
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

function normalizeToWhisperfire(ai, ctx) {
  const { input, tab, tone } = ctx;

  if (tab === 'scan') {
    const receipts = buildReceiptsFromScan(ai, input);
    const powerPlay = (Array.isArray(ai?.why) ? ai.why : []).slice(0, 3).join('\n') ||
      'Specific plan, zero labor\nYou host, they join\nAssumes value, invites choice';
    const nextMoves = (Array.isArray(ai?.next) ? ai.next : []).map(s => s?.trim()).filter(Boolean).join('\n') ||
      'Offer a vivid plan.\nHost the logistics.\nClose cleanly.\nNo admin texts.';
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

  // PATTERN
  const receipts = buildReceiptsFromPattern(ai, input);
  const coreTake = joinSentences([
    ai?.psych_profile?.explain,
    ai?.frame_ledger?.explain,
    ai?.error_chain?.explain
  ]);
  const metrics = deriveMetricsFromText(coreTake || '', ai?.headline || '', input);

  const nextMoves = (Array.isArray(ai?.recovery) ? ai.recovery : []).map(s => s?.trim()).filter(Boolean).join('\n') ||
    'Silence 2–3 days.\nReturn with hosted plan.\nBinary close.\nNo admin texts.';

  const frameArc =
    ai?.frame_ledger?.start && ai?.frame_ledger?.mid && ai?.frame_ledger?.end
      ? `${ai.frame_ledger.start} → ${ai.frame_ledger.mid} → ${ai.frame_ledger.end}`
      : null;

  return {
    context: { tab: 'pattern', relationship: 'Partner', tone: tone || 'soft', content_type: 'dm', subject_name: null },
    headline: String(ai?.headline || 'Frame leaked at tests — recover by hosting.'),
    core_take: coreTake || 'They probed; you defended; logistics flattened tension. Fix with decisive hosting and playful escalation.',
    tactic: { label: 'Dominant Dynamic', confidence: 90 },
    motives: ai?.principle ? String(ai.principle) : 'Keep tension through tests; set logistics after escalation.',
    targeting: 'You became the Clerk; reassert the Curator.',
    power_play: (Array.isArray(ai?.fixes) ? ai.fixes.slice(0, 3) : []).map(f => oneLine(f?.explain || '')).filter(Boolean).slice(0, 3).join('\n') || 'Host logistics; never beg\nAccept & amplify\nBinary close',
    receipts,
    next_moves: nextMoves,
    suggested_reply: { style: tone || 'soft', text: String(ai?.boundary_script || 'Victory drink tomorrow. One seat left.\nText "approved" if you’re in.') },
    safety: { risk_level: metrics.red_flag >= 60 ? 'MODERATE' : 'LOW', notes: 'Recover by setting a vivid plan and closing cleanly.' },
    metrics: { red_flag: metrics.red_flag, certainty: metrics.certainty, viral_potential: metrics.viral_potential },
    pattern: { cycle: frameArc ? `Frame arc: ${frameArc}` : (ai?.error_chain?.arc || null), prognosis: ai?.error_chain?.arc || 'Defense → Admin → Power transfer' },
    ambiguity: { warning: null, missing_evidence: null },
    hidden_agenda: ai?.hidden_agenda ?? null,
    archetypes: null, trigger_pattern_map: null, contradictions: null, weapons: null, forecast: null,
    counter_intervention: String(ai?.principle || 'Begin Challenger, end Victor.'),
    long_game: null
  };
}

/* ================================
   MAIN ANALYSIS
   — strict JSON + low temp = stable
   ================================ */
async function analyzeWithAI(message, tone, tab = 'scan') {
  const isPattern = tab === 'pattern';
  const multi = tab === 'scan' && /(\n|—|-{2,}|;)/.test(String(message || ''));
  const system = isPattern
    ? buildPatternPrompt(tone, (String(message || '').match(/\n/g) || []).length + 1)
    : buildScanPrompt(tone, multi);

  const requestBody = {
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      {
        role: 'user',
        content: isPattern
          ? `THREAD (alternating "You:" / "Them:"):\n${message}\n\nReturn JSON ONLY.`
          : `MESSAGE(S):\n${message}\n\nReturn JSON ONLY.`
      }
    ],
    // Key stabilizers: lower temp, sane top_p, enough tokens
    max_tokens: isPattern ? 2200 : 1400,
    temperature: 0.2,
    top_p: 0.9
  };

  try {
    const resp = await postWithRetry(
      DEEPSEEK_API_URL,
      requestBody,
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
    const parsed = tryParseJson(raw);

    if (!parsed || typeof parsed !== 'object') {
      // Soft failure: try one more deterministic repair path before fallback
      const secondPass = tryParseJson('' + raw);
      if (!secondPass) {
        console.warn('[aiService] JSON parse failed → using fallback for tab:', tab);
        const fb = isPattern ? fallbackPattern(message, tone) : fallbackScan(message, tone);
        return normalizeToWhisperfire(fb, { input: message, tab, tone });
      }
      return normalizeToWhisperfire(secondPass, { input: message, tab, tone });
    }

    return normalizeToWhisperfire(parsed, { input: message, tab, tone });
  } catch (err) {
    // Only REAL API failures land here → one fallback, no loops
    console.error('analyzeWithAI error:', err?.response?.data || err.message);
    const fb = isPattern ? fallbackPattern(message, tone) : fallbackScan(message, tone);
    return normalizeToWhisperfire(fb, { input: message, tab, tone });
  }
}

/* ================================
   MENTOR (unchanged surface; stabilized)
   ================================ */
const MENTOR_PROMPTS = {
  casanova: `You are Casanova with modern psychological teeth. Teach authentic magnetism, not manipulation. Be provocative, precise, and generous with principle.`,
  cleopatra: `You are Cleopatra—regal strategist. Teach command presence, strategic patience, and frame sovereignty. Fierce but surgical.`,
  machiavelli: `You are Machiavelli—cold clarity. Reveal human motives without judgment. Show strategic counters to manipulation.`,
  sun_tzu: `You are Sun Tzu—win before speaking. Position, timing, and terrain of emotion. Speak in crisp, practical aphorisms.`,
  marcus_aurelius: `You are Marcus Aurelius—Stoic magnetism. Teach inner authority, boundaries, and emotional sovereignty.`,
  churchill: `You are Churchill—iron rhetoric, unshakeable resolve. Teach spine, language, and unfakeable conviction.`
};

async function getMentorResponse(mentor, userText, preset, options = {}) {
  try {
    const persona = MENTOR_PROMPTS[mentor] || MENTOR_PROMPTS.casanova;
    const modes = {
      drill: `DRILL: Ask hard questions that force self-honesty. End with one quotable law.`,
      advise: `ADVISE: Give 3 sharp insights + 1 exact line to use. End with a law.`,
      roleplay: `ROLEPLAY: Speak fully in-character. 180–240 words. End with a law.`,
      chat: `CHAT: Natural but elite. 150–220 words. End with a law.`
    };
    const mode = modes[preset] || modes.chat;

    const system = `${persona}\n\n${mode}\n\nRules:\n- No fluff. Deep, practical, quotable.\n- Include one "forbidden knowledge" insight.\n- Plain ASCII quotes only.\n- End with: Law: "<one sentence>"`;

    const resp = await postWithRetry(
      DEEPSEEK_API_URL,
      {
        model: MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userText }
        ],
        max_tokens: 600,
        temperature: 0.35,
        top_p: 0.9
      },
      {
        headers: { Authorization: `Bearer ${process.env.TOGETHER_AI_KEY}`, 'Content-Type': 'application/json' },
        timeout: 90000
      },
      2
    );

    const text = resp?.data?.choices?.[0]?.message?.content || '';
    return {
      mentor,
      response: text,
      preset,
      timestamp: new Date().toISOString(),
      viralScore: scoreViral(text)
    };
  } catch (err) {
    console.error('getMentorResponse error:', err?.response?.data || err.message);
    const fallback = `Uncomfortable truth: you speak like permission, not gravity.

Offer a myth, host the plan, and close cleanly.

Law: Lead the frame or lose it.`;
    return {
      mentor,
      response: fallback,
      preset,
      timestamp: new Date().toISOString(),
      viralScore: 84
    };
  }
}

function scoreViral(t) {
  let s = 50;
  if (/law:|principle/i.test(t)) s += 10;
  if (/secret|forbidden|never/i.test(t)) s += 15;
  if (t.length > 200) s += 10;
  if (/\?$/.test(t.trim())) s += 5;
  return Math.min(100, s);
}

/* ================================
   EXPORTS
   ================================ */
module.exports = {
  analyzeWithAI,
  getMentorResponse
};
