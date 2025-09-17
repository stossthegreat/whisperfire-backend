// services/aiService.js — ORACLE SEDUCER v4 MAX (Stable + Repair Layer)
// - Together AI (DeepSeek V3) integration
// - Retry + backoff
// - Strong JSON parsing with repair step
// - Normalization for controllers (unchanged schema)
// - Fallbacks included
// - Mentor responses intact

const axios = require('axios');
const http = require('http');
const https = require('https');

const DEEPSEEK_API_URL = 'https://api.together.xyz/v1/chat/completions';
const MODEL = 'deepseek-ai/DeepSeek-V3';

// keep-alive pools
const keepAliveHttp = new http.Agent({ keepAlive: true, maxSockets: 64 });
const keepAliveHttps = new https.Agent({ keepAlive: true, maxSockets: 64 });

/* ============================================================
   RETRY WRAPPER
   ============================================================ */
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

/* ============================================================
   PROMPT BUILDERS
   ============================================================ */
function buildScanPrompt(tone, multi) {
  return `
ROLE: You are the world's sharpest seduction mentor (Casanova × Cleopatra × Sun Tzu).
TONE=${tone}

TASK: Analyze ${multi ? 'a small set of messages' : 'one message'}.

OUTPUT JSON ONLY:
{
  "headline": "...",
  "message": "...",
  "analysis": "...",
  "mistake": "...",
  "rewrite": "...",
  "why": ["...", "...", "..."],
  "principle": "...",
  "next": ["...", "...", "..."]
}

RULES:
- Address USER only, no emojis/markdown
- 260–420 words, decisive tone
- "why" = exactly 3 bullets
- Return only JSON`;
}

function buildPatternPrompt(tone, count) {
  return `
ROLE: War-room strategist of seduction.
TONE=${tone}

TASK: Analyze a multi-message thread.

OUTPUT JSON ONLY:
{
  "headline": "...",
  "thread": [ { "who": "You|Them", "said": "...", "meaning": "..." } ],
  "critical": [ { "moment": "...", "what_went_wrong": "...", "better_line": "...", "why": "..." } ],
  "psych_profile": { "you": "...", "them": "...", "explain": "..." },
  "frame_ledger": { "start": "...", "mid": "...", "end": "...", "explain": "..." },
  "error_chain": { "arc": "...", "explain": "..." },
  "fixes": [ { "situation": "...", "rewrite": "...", "explain": "..." } ],
  "recovery": ["...", "..."],
  "principle": "...",
  "hidden_agenda": null,
  "boundary_script": "..."
}

RULES:
- 420–650 words
- 2–3 critical, 3–5 fixes
- ASCII only
- Return only JSON`;
}

/* ============================================================
   MAIN ANALYSIS
   ============================================================ */
async function analyzeWithAI(message, tone, tab = 'scan') {
  try {
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
            ? `THREAD:\n${message}\n\nFollow exact JSON schema.`
            : `MESSAGE:\n${message}\n\nFollow exact JSON schema.`
        }
      ],
      max_tokens: isPattern ? 2400 : 1600,
      temperature: 0.92,
      top_p: 0.96
    };

    const resp = await postWithRetry(DEEPSEEK_API_URL, requestBody, {
      headers: {
        Authorization: `Bearer ${process.env.TOGETHER_AI_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000
    });

    const raw = resp?.data?.choices?.[0]?.message?.content || '';
    let parsed;

    try {
      const json = raw.match(/\{[\s\S]*\}/m)?.[0] || raw;
      parsed = JSON.parse(json);
    } catch (err1) {
      console.error('❌ Parse fail, repairing. Raw snippet:', raw.slice(0, 200));
      try {
        const repaired = raw
          .replace(/[\u0000-\u001F]+/g, '')
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']')
          .replace(/“|”/g, '"')
          .replace(/‘|’/g, "'");
        parsed = JSON.parse(repaired);
      } catch (err2) {
        console.error('❌ Repair failed, fallback engaged.');
        parsed = isPattern ? fallbackPattern(message, tone) : fallbackScan(message, tone);
      }
    }

    return normalizeToWhisperfire(parsed, { input: message, tab, tone });
  } catch (err) {
    console.error('💥 analyzeWithAI error:', err?.response?.data || err.message);
    const fb = tab === 'pattern' ? fallbackPattern(message, tone) : fallbackScan(message, tone);
    return normalizeToWhisperfire(fb, { input: message, tab, tone });
  }
}

/* ============================================================
   NORMALIZER
   ============================================================ */
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
      motives: ai?.principle || 'Signal value; avoid approval-seeking; lead decisively.',
      targeting: inferTargetingFromText(coreTake || '') || 'You played the Petitioner; become the Curator.',
      power_play: powerPlay,
      receipts,
      next_moves: nextMoves,
      suggested_reply: { style: tone || 'soft', text: oneLine(String(ai?.rewrite || 'Hidden speakeasy Thu 9. Bring curiosity.')) },
      safety: { risk_level: metrics.red_flag >= 60 ? 'MODERATE' : 'LOW', notes: metrics.red_flag >= 60 ? 'Reduce neediness.' : 'Safe if you lead.' },
      metrics,
      pattern: { cycle: null, prognosis: null },
      ambiguity: { warning: null, missing_evidence: null },
      hidden_agenda: null, archetypes: null, trigger_pattern_map: null, contradictions: null, weapons: null, forecast: null,
      counter_intervention: String(ai?.principle || 'Invitation is not a question.'), long_game: null
    };
  }

  // pattern branch
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
    core_take: coreTake || 'They probed; you defended; logistics flattened tension. Fix with hosting + escalation.',
    tactic: { label: 'Dominant Dynamic', confidence: 90 },
    motives: ai?.principle || 'Keep tension through tests; logistics later.',
    targeting: 'You became the Clerk; reassert the Curator.',
    power_play: whyBullets.slice(0, 3).join('\n'),
    receipts,
    next_moves: nextMoves,
    suggested_reply: { style: tone || 'soft', text: String(ai?.boundary_script || 'Victory drink tomorrow. One seat left. Say "approved" if in.') },
    safety: { risk_level: metrics.red_flag >= 60 ? 'MODERATE' : 'LOW', notes: 'Recover by setting a vivid plan.' },
    metrics,
    pattern: { cycle: frameArc ? `Frame arc: ${frameArc}` : (ai?.error_chain?.arc || null), prognosis: ai?.error_chain?.arc || 'Defense → Admin → Power transfer' },
    ambiguity: { warning: null, missing_evidence: null },
    hidden_agenda: ai?.hidden_agenda ?? null,
    archetypes: null, trigger_pattern_map: null, contradictions: null, weapons: null, forecast: null,
    counter_intervention: String(ai?.principle || 'Begin Challenger, end Victor.'), long_game: null
  };
}

/* ============================================================
   FALLBACKS
   ============================================================ */
function fallbackScan(message, tone) {
  const condensed = oneLine(String(message || '')).slice(0, 200);
  const vibe = estimateVibe(message);
  const rewrite = vibe >= 7 ? 'Keep Thu 9. I’m stealing you for the speakeasy.' : 'Hidden speakeasy Thu 9. Wear something wild.';
  return {
    headline: vibe >= 7 ? 'Clean invite. Tighten the myth.' : 'You asked for a slot, not a story.',
    message: condensed,
    analysis: vibe >= 7 ? 'You lead with a plan. Add mystique and scarcity.' : 'Reads like a calendar request. No tension, no frame.',
    mistake: vibe >= 7 ? 'Solid logistics, flat energy.' : 'You ceded power by asking. Attraction needs leadership.',
    rewrite,
    why: ['Specific plan, zero labor', 'You host, they join', 'Assumes value, invites choice'],
    principle: 'Invitation is not a question.',
    next: ['Offer vivid scene', 'Set time/place decisively', 'Close with binary path']
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
      { moment: 'Their test', what_went_wrong: 'You defended yourself, proving doubt.', better_line: 'Good. I don’t want safe.', why: 'Escalates tension.' },
      { moment: 'Admin pivot', what_went_wrong: 'You switched to logistics mid-flirt.', better_line: 'Penalty: you owe me a drink. Thu 8.', why: 'Playful dominance.' }
    ],
    psych_profile: { you: 'Playful → pleading.', them: 'Amused decider.', explain: 'Creates tease-test loop. Host to break it.' },
    frame_ledger: { start: 'Challenger', mid: 'Clerk', end: 'Petitioner', explain: 'You opened strong, surrendered logistics → status lost.' },
    error_chain: { arc: 'Defense → Admin → Power transfer', explain: 'Defending killed spark, gave power away.' },
    fixes: [
      { situation: 'Tests', rewrite: 'Good. I prefer trouble undefeated.', explain: 'Accept + amplify tension.' },
      { situation: 'Logistics', rewrite: 'Speakeasy tomorrow. One seat left.', explain: 'Scarcity + hosting flips frame.' }
    ],
    recovery: ['Silence 2–3 days', 'Return hosted plan', 'Binary close'],
    principle: 'Begin Challenger, end Victor.',
    hidden_agenda: null,
    boundary_script: 'I like playful, not indecision. Drink Thu. Say “approved” if in.'
  };
}

/* ============================================================
   HELPERS
   ============================================================ */
function buildReceiptsFromScan(ai, input) {
  const out = [];
  if (ai?.message) out.push(oneLine(String(ai.message)).slice(0, 220));
  else {
    const lines = String(input || '').split('\n').map(s => oneLine(s)).filter(Boolean);
    if (lines[0]) out.push(lines[0].slice(0, 220));
    if (lines[1]) out.push(lines[1].slice(0, 220));
  }
  return out.length ? out : [oneLine(String(input || '')).slice(0, 220)];
}

function buildReceiptsFromPattern(ai, input) {
  const bullets = [];
  const items = Array.isArray(ai?.thread) ? ai.thread : [];
  if (items.length) {
    items.slice(0, 6).forEach(t => {
      const who = (t?.who || 'You').trim();
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
  if (lc.includes('defend') || lc.includes('test')) return { label: 'Test → Defense (loss)', confidence: 90 };
  if (lc.includes('admin') || lc.includes('logistic')) return { label: 'Admin pivot', confidence: 88 };
  if (lc.includes('host') || lc.includes('plan')) return { label: 'Hosted frame', confidence: 85 };
  return { label: 'Frame alignment', confidence: 80 };
}

function inferTargetingFromText(text) {
  const lc = text.toLowerCase();
  if (lc.includes('petition') || lc.includes('beg')) return 'You played Petitioner; be Curator.';
  if (lc.includes('host')) return 'You played Curator; keep crown.';
  if (lc.includes('defend')) return 'You played Defendant; be Challenger.';
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
  const plan = /\b(thu|fri|sat|sun|tonight|tomorrow)\b/i.test(s);
  const host = /\b(i(?:'m| am)?|my)\b.*\b(reserved|booked|host|plan|arranged)/i
