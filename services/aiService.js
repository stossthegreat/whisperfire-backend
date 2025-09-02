// services/aiService.js — ORACLE SEDUCER v8 (Together AI, ruthless & clean)
// Goals:
// 1) Zero mojibake (no Â, no â€™) → strict ASCII quotes
// 2) Real paragraphs + labeled sections (Advice/Drill/Roleplay/Chat)
// 3) Scan/Pattern: long, surgical analysis + ALWAYS a copyable "rewrite"
// 4) Robust JSON: schema-forcing hint, tolerant parser, auto-fallback synthesis
// 5) Stable HTTP: keep-alive, retries, long timeouts

const axios = require('axios');
const http = require('http');
const https = require('https');

const DEEPSEEK_API_URL = 'https://api.together.xyz/v1/chat/completions';
const MODEL = 'deepseek-ai/DeepSeek-V3';

// Keep-alive sockets for reliability on long calls
const keepAliveHttp = new http.Agent({ keepAlive: true, maxSockets: 64 });
const keepAliveHttps = new https.Agent({ keepAlive: true, maxSockets: 64 });

/* ────────────────────────────────────────────────────────────
   TEXT CLEANING (mojibake killers + paragraphizer)
   ──────────────────────────────────────────────────────────── */
function fixSmartQuotes(s = '') {
  return String(s)
    // common UTF-8→Latin-1 trash
    .replace(/Â+/g, '')
    .replace(/â€™|Ã¢â‚¬â„¢|â\u0080\u0099/g, "'")
    .replace(/â€˜|Ã¢â‚¬Ëœ|â\u0080\u0098/g, "'")
    .replace(/â€œ|Ã¢â‚¬Å“|â\u0080\u009C/g, '"')
    .replace(/â€�|Ã¢â‚¬Â|â\u0080\u009D/g, '"')
    .replace(/â€”|Ã¢â‚¬â¢|â\u0080\u0094/g, '—')
    .replace(/â€“|Ã¢â‚¬â€œ|â\u0080\u0093/g, '–')
    .replace(/\u00A0/g, ' ');
}

function stripMarkdownNasties(s = '') {
  return String(s)
    .replace(/^[\*\u2022\-]{1,2}\s*/gm, '') // bullets → remove (we'll add our own)
    .replace(/[>`_#]/g, '');
}

function sectionize(s = '') {
  let t = String(s);
  // Fix glued sentences (e.g., "water.Line:")
  t = t.replace(/([a-z0-9])([.!?])([A-Z])/g, '$1$2 $3');
  // Ensure breaks before section labels commonly used by prompts
  t = t.replace(/\s*(?=(Diagnosis:|Psychology:|Plays|Lines:|Close:|Principle:|Principles:|Law:|Use:|Boundary|Recovery))/g, '\n\n');
  // Encourage paragraphing after sentence stops
  t = t.replace(/([.!?])\s+(?=[A-Z0-9"'\(])/g, '$1\n\n');
  // Collapse extra blanks
  t = t.replace(/\n{3,}/g, '\n\n');
  return t;
}

function normalizeSpacing(s = '') {
  return String(s)
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanText(s = '') {
  return normalizeSpacing(sectionize(stripMarkdownNasties(fixSmartQuotes(s))));
}

function deepClean(entity) {
  if (entity == null) return entity;
  if (typeof entity === 'string') return cleanText(entity);
  if (Array.isArray(entity)) return entity.map(deepClean);
  if (typeof entity === 'object') {
    const out = {};
    for (const k of Object.keys(entity)) out[k] = deepClean(entity[k]);
    return out;
  }
  return entity;
}

/* ────────────────────────────────────────────────────────────
   HTTP RETRY
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
      const st = e?.response?.status;
      if (!(st === 429 || (st >= 500 && st <= 599))) break;
      const wait = Math.min(2000 * 2 ** attempt, 8000);
      await new Promise(r => setTimeout(r, wait));
      attempt++;
    }
  }
  throw lastErr;
}

/* ────────────────────────────────────────────────────────────
   PROMPTS — SCAN / PATTERN
   ──────────────────────────────────────────────────────────── */
function buildScanPrompt(tone, multi) {
  return `
ROLE: Elite seduction strategist. Decode the USER's message(s), name the real mistake, and
give a seductive replacement line they can copy. Ethical, adult, fully consensual.

TONE=${tone}

FORMAT (JSON ONLY, NO MARKDOWN, NO EMOJIS):
{
  "headline": "One-line verdict that stings but teaches.",
  "message": "Short quote of the user's line(s).",
  "analysis": "6–10 sentences of clear, practical decoding.",
  "mistake": "2–4 sentences naming the core error and its effect.",
  "rewrite": "One or two elite replacement lines the USER can copy.",
  "why": ["Reason 1 (<=10 words)", "Reason 2 (<=10 words)", "Reason 3 (<=10 words)"],
  "principle": "One-sentence law to keep.",
  "next": ["Command 1", "Command 2", "Command 3"]
}

RULES:
- No therapy-speak. No hedging. No apologies.
- Hosted logistics, not admin energy.
- Exactly three bullets in 'why'. Use blank lines inside strings for readability.
- 260–420 words total.
- Adults only. Nothing illegal/abusive.

TASK: Analyze ${multi ? 'a list of messages' : 'one message'} from the USER and talk directly to them.`;
}

function buildPatternPrompt(tone) {
  return `
ROLE: War-room strategist of seduction. Decode tests, frame transfers, and where power moved.
Ethical, adult, consensual.

TONE=${tone}

FORMAT (JSON ONLY, NO MARKDOWN, NO EMOJIS):
{
  "headline": "One-line verdict on the engagement.",
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
- Keep 'thread' compact with meaning (no transcript dump).
- 2–3 'critical' moments. 3–5 reusable 'fixes'.
- 380–560 words total.
- Adults only. Nothing illegal/abusive.

TASK: Analyze a multi-message thread (USER="You", counterpart="Them").`;
}

/* ────────────────────────────────────────────────────────────
   ANALYSIS CORE
   ──────────────────────────────────────────────────────────── */
async function analyzeWithAI(message, tone, tab = 'scan') {
  const isPattern = tab === 'pattern';
  const multi = tab === 'scan' && /(\n|—|-{2,}|;)/.test(String(message || ''));
  const system = isPattern ? buildPatternPrompt(tone) : buildScanPrompt(tone, multi);

  const userContent = isPattern
    ? `THREAD (alternate "You:" / "Them:"):\n${message}\n\nReturn JSON only.`
    : `MESSAGE(S):\n${message}\n\nReturn JSON only.`;

  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userContent }
    ],
    // Some providers honor this, some ignore it — harmless if ignored.
    response_format: { type: 'json_object' },
    max_tokens: isPattern ? 2300 : 1500,
    temperature: 0.98,
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
        timeout: 125000
      },
      2
    );

    const raw = resp?.data?.choices?.[0]?.message?.content || '';
    const cleanedRaw = cleanText(raw);
    let parsed;

    try {
      const json = cleanedRaw.match(/\{[\s\S]*\}$/m)?.[0] || cleanedRaw;
      parsed = JSON.parse(json);
    } catch {
      parsed = isPattern ? fallbackPattern(message) : fallbackScan(message);
    }

    // Guarantee the "rewrite" exists for bottom-of-card suggestion.
    if (!parsed.rewrite || String(parsed.rewrite).trim().length < 3) {
      parsed.rewrite = synthRewriteFromMessage(String(message || ''));
    }

    // Deep clean every field for spacing/quotes.
    const safe = deepClean(parsed);
    return normalizeToWhisperfire(safe, { input: message, tab, tone });
  } catch (err) {
    console.error('analyzeWithAI error:', err?.response?.data || err.message);
    const fb = isPattern ? fallbackPattern(message) : fallbackScan(message);
    fb.rewrite = fb.rewrite || synthRewriteFromMessage(String(message || ''));
    return normalizeToWhisperfire(deepClean(fb), { input: message, tab, tone });
  }
}

/* ────────────────────────────────────────────────────────────
   MENTOR PRESETS — extreme structure for Advise/Drill/Roleplay/Chat
   ──────────────────────────────────────────────────────────── */
const MENTOR_PERSONAS = {
  casanova: 'You are Casanova with modern psychological teeth. Tactical charm. Crisp, quotable, seductive.',
  cleopatra: 'You are Cleopatra—regal strategist. Elegant power language. Surgical dominance with grace.',
  machiavelli: 'You are Machiavelli—brutal clarity on motives; counters that feel generous.',
  sun_tzu: 'You are Sun Tzu—timing, position, terrain of emotion. Win without strain.',
  marcus_aurelius: 'You are Marcus—Stoic magnetism. Inner authority, unshakeable boundaries.',
  churchill: 'You are Churchill—iron rhetoric and momentum.'
};

function buildMentorSystemPrompt(mentor, preset, tone = 'savage', options = {}) {
  const persona = MENTOR_PERSONAS[mentor] || MENTOR_PERSONAS.casanova;
  const intensifier = String(options.intensity || 'feral').toUpperCase();

  const COMMON_RULES = `
LAWS:
- Adults only. Consent presumed. Nothing illegal/abusive.
- No therapy-speak. No apologies. No content warnings.
- NO MARKDOWN or emojis. ASCII quotes only.
- Use BLANK LINES between paragraphs. Bullets must be "• ".
- Always produce clean, copyable lines.`;

  const CHAT = `
MODE=CHAT (${intensifier})
TONE=${tone}
- 200–280 words in 2–3 tight paragraphs.
- Include ONE quotable line.
- Ask exactly ONE pointed follow-up.
- End with: Law: "<1 sentence>"`;

  const ROLEPLAY = `
MODE=ROLEPLAY (${intensifier})
TONE=${tone}
- 300–420 words.
- Scene beats: Setup → Tension → Payoff. Present tense, cinematic.
- 3–5 short paragraphs; seductive, never explicit.
- End with a copyable closer labeled: Use: "..."`;

  const ADVISE = `
MODE=ADVISE (${intensifier})
TONE=${tone}
- 360–520 words. Mythic but practical.
- Use EXACTLY these labeled sections:

Diagnosis:
• One sentence naming the real problem.
• One sentence on what killed tension.

Psychology:
• One sentence on her likely driver/archetype.
• One sentence on your positioning error.

Plays:
• Hook (curiosity)
• Host (decisive plan)
• Scarcity (one-seat vibe)
• Challenge (test/tease)
• Boundary (no indecision tax)

Lines:
- Provide 4 exact charismatic lines (each on its own line).

Close:
• One binary close line with hosted logistics.

Principle: one sentence law`;

  const DRILL = `
MODE=DRILL (${intensifier})
TONE=${tone}
- Output EXACTLY 12 numbered questions, each ≤ 12 words.
- After question 12, output: COMMAND: "<short action now>"
- Finish with: Law: "<one sentence>"
- Use blank lines so clusters breathe.`;

  const MODE = { chat: CHAT, roleplay: ROLEPLAY, advise: ADVISE, drill: DRILL }[preset] || CHAT;
  return `${persona}\n\n${COMMON_RULES}\n\n${MODE}`.trim();
}

/* ────────────────────────────────────────────────────────────
   MENTOR CORE
   ──────────────────────────────────────────────────────────── */
async function getMentorResponse(mentor, userText, preset, options = {}) {
  const system = buildMentorSystemPrompt(mentor, preset, options.tone || 'savage', options);
  // Big tokens so Casanova has room to cook
  const maxTokensByMode = { chat: 750, roleplay: 1000, advise: 1200, drill: 700 };
  const tempByMode = { chat: 1.06, roleplay: 1.08, advise: 1.02, drill: 0.96 };

  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: String(userText || '') }
    ],
    max_tokens: maxTokensByMode[preset] || 900,
    temperature: tempByMode[preset] || 1.02,
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
        timeout: 125000
      },
      2
    );

    const raw = resp?.data?.choices?.[0]?.message?.content || '';
    // Hard format: clean spacing + ensure labeled sections for presets
    let text = cleanText(raw);
    text = enforceMentorScaffolding(text, preset, userText);

    return {
      mentor,
      response: text,
      preset,
      timestamp: new Date().toISOString(),
      viralScore: scoreViral(text)
    };
  } catch (e) {
    const fb = fallbackMentor(preset, userText);
    return {
      mentor,
      response: cleanText(fb),
      preset,
      timestamp: new Date().toISOString(),
      viralScore: 84,
      fallback: true
    };
  }
}

/* ────────────────────────────────────────────────────────────
   SCHEMA / SCAFFOLD ENFORCERS
   ──────────────────────────────────────────────────────────── */
function synthRewriteFromMessage(s = '') {
  const firstNameMatch = s.match(/\b[A-Z][a-z]{2,}\b/);
  const name = firstNameMatch ? firstNameMatch[0] : null;

  // Hosted, vivid, binary close
  const venue = /bar|drink|coffee|dinner|museum|park/i.test(s) ? null : 'speakeasy';
  const day = /\b(mon|tue|wed|thu|fri|sat|sun|tonight|tomorrow)\b/i.test(s) ? '' : 'Thu';
  const base = `Hidden ${venue || 'bar'} ${day ? day + ' ' : ''}8. One seat left.`;
  const prefix = name ? `${name}, ` : '';
  return `${prefix}${base} Bring your curiosity or veto me now.`;
}

function enforceMentorScaffolding(text, preset, userText) {
  const t = text.trim();

  if (preset === 'advise') {
    // Ensure labeled blocks exist
    const need = ['Diagnosis:', 'Psychology:', 'Plays', 'Lines:', 'Close:', 'Principle:'];
    let out = t;
    for (const key of need) if (!new RegExp(`^${key}`, 'm').test(out)) out += `\n\n${key}\n`;
    // Ensure 4 lines under Lines:
    if (!/Lines:\s*$/m.test(out)) {
      const linesBlock = [
        'Line 1: "You read like trouble I’d upgrade."',
        'Line 2: "I host. Thu 8. One seat—earn it."',
        'Line 3: "Good. I don’t chase safe."',
        'Line 4: "Penalty for teasing: you owe me a drink."'
      ].join('\n');
      out = out.replace(/Lines:\s*$/m, `Lines:\n${linesBlock}`);
    }
    // Ensure Close:
    if (/Close:\s*$/m.test(out)) {
      out = out.replace(/Close:\s*$/m, `Close:\n• ${synthRewriteFromMessage(userText)}`);
    }
    // Ensure Principle:
    if (/Principle:\s*$/m.test(out)) {
      out = out.replace(/Principle:\s*$/m, 'Principle: Invitation is not a question.');
    }
    return cleanText(out);
  }

  if (preset === 'drill') {
    // Ensure exactly 12 questions + COMMAND + Law
    const qs = (t.match(/^\d+\)/gm) || []).length;
    if (qs < 12) {
      const fill = [
        '1) What myth are you offering?',
        '2) Where are you asking permission?',
        '3) What proof shows you have options?',
        '4) What playful penalty raises tension?',
        '5) What boundary will you enforce?',
        '6) What time? What place? You host.',
        '7) What binary close ends dithering?',
        '8) What curiosity hook opens the loop?',
        '9) What value do they chase in you?',
        '10) What line are you proud to send?',
        '11) What are you willing to walk from?',
        '12) What happens in the next 30 minutes?'
      ].join('\n');
      return cleanText(`${fill}\n\nCOMMAND: Send your hosted line now.\nLaw: Lead the frame or lose it.`);
    }
    // Make sure we end with COMMAND/Law if model forgot
    let out = t;
    if (!/^COMMAND:/m.test(out)) out += `\n\nCOMMAND: Send your hosted line now.`;
    if (!/^Law:/m.test(out)) out += `\nLaw: Lead the frame or lose it.`;
    return cleanText(out);
  }

  if (preset === 'roleplay') {
    // Ensure Use: closing line exists
    if (!/^\s*Use:\s*"/m.test(t)) {
      return `${t}\n\nUse: "${synthRewriteFromMessage(userText)}"`;
    }
    return t;
  }

  if (preset === 'chat') {
    // Ensure Law at end and a single question
    let out = t;
    if (!/^Law:/m.test(out)) out += `\n\nLaw: Lead with hosted curiosity, not permission.`;
    return out;
  }

  return t;
}

/* ────────────────────────────────────────────────────────────
   FALLBACKS (if model fails)
   ──────────────────────────────────────────────────────────── */
function fallbackScan(message) {
  const condensed = oneLine(String(message || '')).slice(0, 220);
  return {
    headline: 'You asked for a slot, not a story.',
    message: condensed,
    analysis: 'It reads like a calendar request. No edge, no myth, no hosted frame.\n\nLead with a scene, host logistics, close binary.',
    mistake: 'You ceded status by asking for availability. Curate; don’t plead.',
    rewrite: synthRewriteFromMessage(message),
    why: ['Specific plan, zero labor', 'You host, they join', 'Assumes value, invites choice'],
    principle: 'Invitation is not a question.',
    next: ['Offer a vivid scene', 'Set time/place decisively', 'Close with a binary path']
  };
}

function fallbackPattern(message) {
  const lines = String(message || '').split('\n').map(s => s.trim()).filter(Boolean).slice(0, 6);
  const snapshot = lines.map(l => {
    const who = /^them:/i.test(l) ? 'Them' : /^you:/i.test(l) ? 'You' : (/:/.test(l) ? l.split(':')[0] : 'You');
    const said = l.replace(/^you:|^them:/i, '').trim();
    return { who: /You|Them/.test(who) ? who : 'You', said: said.slice(0, 80), meaning: who === 'Them' ? 'test/withhold' : 'defense/admin pivot' };
  });

  return {
    headline: 'Frame leaked at tests — recover by hosting.',
    thread: snapshot,
    critical: [
      {
        moment: 'Test ignored',
        what_went_wrong: 'You defended yourself instead of amplifying the tease.',
        better_line: 'Good. I don’t do safe.',
        why: 'Defense signals doubt; escalation signals certainty.'
      },
      {
        moment: 'Admin pivot',
        what_went_wrong: 'You switched to logistics mid-flirt and flattened the vibe.',
        better_line: 'Penalty for trouble: you owe me a drink. Thu 8.',
        why: 'Hosted logistics restore the Challenger frame.'
      }
    ],
    psych_profile: {
      you: 'Jester seeking crown — fun, then needy.',
      them: 'Amused decider — tests, withholds, enjoys selection.',
      explain: 'This pairing loops unless you host the plan and close cleanly. Reward decisiveness; ignore dithering.'
    },
    frame_ledger: { start: 'Challenger', mid: 'Clerk', end: 'Petitioner', explain: 'You surrendered logistics and with it status.' },
    error_chain: { arc: 'Defense → Admin → Power transfer', explain: 'Defend and you validate their doubt; admin kills tension.' },
    fixes: [
      { situation: 'Tests', rewrite: 'I prefer undefeated trouble.', explain: 'Accept + escalate beats defense.' },
      { situation: 'Logistics', rewrite: 'Speakeasy tomorrow. One seat left.', explain: 'Scarcity + hosting flips the frame.' },
      { situation: 'Boundary', rewrite: 'I like decisive. If not your style, all good.', explain: 'Signals abundance without hostility.' }
    ],
    recovery: ['Silence 48–72h', 'Return with hosted plan', 'Binary close'],
    principle: 'Begin Challenger, end Victor.',
    hidden_agenda: null,
    boundary_script: 'I’m grabbing a drink Thu. If you’re in, text “approved.”'
  };
}

function fallbackMentor(preset, userText = '') {
  if (preset === 'drill') {
    return [
      '1) What myth are you offering?',
      '2) Where are you asking permission?',
      '3) What proof shows you have options?',
      '4) What playful penalty raises tension?',
      '5) What boundary will you enforce?',
      '6) What time? What place? You host.',
      '7) What binary close ends dithering?',
      '8) What curiosity hook opens the loop?',
      '9) What value do they chase in you?',
      '10) What line are you proud to send?',
      '11) What are you willing to walk from?',
      '12) What happens in the next 30 minutes?',
      '',
      'COMMAND: Send your hosted line now.',
      'Law: Lead the frame or lose it.'
    ].join('\n');
  }

  if (preset === 'advise') {
    return cleanText(
`Diagnosis:
• You asked permission instead of curating.
• Admin tone killed tension.

Psychology:
• She chases novelty judged by status.
• You signaled need, not selection.

Plays:
• Hook (mystery first)
• Host (decisive plan)
• Scarcity (one seat)
• Challenge (tease test)
• Boundary (no dithering tax)

Lines:
- "You read like trouble I’d upgrade."
- "I’m hosting a speakeasy run Thu 8. One seat."
- "If you’re decisive, I’ll risk it."
- "Penalty for teasing: you owe me a drink."

Close:
• ${synthRewriteFromMessage(userText)}

Principle: Invitation is not a question.`
    );
  }

  // roleplay/chat fallback
  return `You talk like permission, not gravity.

Offer a myth, host the plan, close cleanly.

Use: "${synthRewriteFromMessage(userText)}"

Law: Lead the frame or lose it.`;
}

/* ────────────────────────────────────────────────────────────
   NORMALIZATION to Whisperfire schema
   ──────────────────────────────────────────────────────────── */
function normalizeToWhisperfire(ai, ctx) {
  const { input, tab, tone } = ctx;

  if (tab === 'scan') {
    const receipts = buildReceiptsFromScan(ai, input);
    const powerPlay = (Array.isArray(ai?.why) ? ai.why : []).slice(0, 3).join('\n') ||
      'Specific plan, zero labor\nYou host, they join\nAssumes value, invites choice';
    const nextMoves = (Array.isArray(ai?.next) ? ai.next : [])
      .map(s => s?.trim()).filter(Boolean).join('\n') ||
      'Offer a vivid plan.\nHost the logistics.\nClose cleanly.';
    const coreTake = joinSentences([ai?.analysis, ai?.mistake]);
    const tactic = inferTacticFromText(coreTake || '', ai?.headline || '');
    const metrics = deriveMetricsFromText(coreTake || '', ai?.headline || '', input);

    // ALWAYS provide suggested_reply
    const replyText = oneLine(String(ai?.rewrite || synthRewriteFromMessage(input)));

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
      suggested_reply: { style: tone || 'soft', text: replyText },
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
  const coreTake = joinSentences([ ai?.psych_profile?.explain, ai?.frame_ledger?.explain, ai?.error_chain?.explain ]);
  const metrics = deriveMetricsFromText(coreTake || '', ai?.headline || '', input);

  const whyBullets = [];
  (Array.isArray(ai?.fixes) ? ai.fixes : []).slice(0, 3).forEach(fx => {
    if (fx?.explain) whyBullets.push(oneLine(fx.explain).slice(0, 80));
  });
  if (whyBullets.length < 3 && ai?.principle) whyBullets.push(oneLine(ai.principle));
  while (whyBullets.length < 3) whyBullets.push('Host logistics; never beg');

  const nextMoves = (Array.isArray(ai?.recovery) ? ai.recovery : [])
    .map(s => s?.trim()).filter(Boolean).join('\n') ||
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
    suggested_reply: { style: tone || 'soft', text: String(ai?.boundary_script || 'Victory drink tomorrow. One seat left. Text "approved" if you’re in.') },
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
  return { red_flag: red, certainty: 86, viral_potential: 80 };
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
  return (parts || []).map(p => String(p || '').trim()).filter(Boolean).join(' ');
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
  getMentorResponse,

  // Expose cleaners in case controllers want to double-clean
  _cleanText: cleanText,
  _deepClean: deepClean
};
