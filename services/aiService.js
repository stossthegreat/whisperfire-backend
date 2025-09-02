// services/aiService.js — v7 "Forbidden Atelier"
// - Seduction-first prompts (mad, surgical, power-framing)
// - Together AI retries + 60s timeout
// - Spacing + mojibake sanitizer
// - Mentor formatting per preset (Advise/Drill/Roleplay/Chat)

const axios = require('axios');
const { sanitizeText, sanitizeDeep } = require('../utils/textSanitizer');
const { formatByPreset } = require('../utils/mentorFormatter');

const DEEPSEEK_API_URL = 'https://api.together.xyz/v1/chat/completions';
const MODEL = 'deepseek-ai/DeepSeek-V3';

/* ============================ HTTP with retries ============================ */
async function postWithRetry(url, data, config, retries = 2) {
  let attempt = 0, lastErr;
  while (attempt <= retries) {
    try { return await axios.post(url, data, config); }
    catch (e) {
      lastErr = e;
      const st = e?.response?.status;
      if (!(st === 429 || (st >= 500 && st <= 599))) break;
      await new Promise(r => setTimeout(r, Math.min(2000 * 2 ** attempt, 8000)));
      attempt++;
    }
  }
  throw lastErr;
}

/* ================================ PROMPTS ================================= */
// SCAN: one message (or short list) — diagnose → mistake → seductive rewrite → why → principle → next
function buildScanPrompt(tone, multi) {
  return `
ROLE: Master of Seduction and Power Framing. You cut through noise, expose the exact mistake, and rebuild a line that PULLS (not pleads).

MODE: ${multi ? 'Short list of messages from USER' : 'Single message from USER'}
TONE: ${tone} (savage = blade-precise; soft = velvet-steel; clinical = forensic-cool)

OUTPUT: JSON ONLY (no markdown, no emojis, no asterisks)
{
  "headline": "Brutal, one-line verdict with lesson.",
  "message": "Concise quote of the input you evaluated.",
  "analysis": "4–6 sentences. What actually happened. Name the frame and power transfer.",
  "mistake": "2–3 sentences. The core error and why it killed tension.",
  "rewrite": "One elite, seductive replacement line (or two short options).",
  "why": ["Mechanism 1 (<=10 words)", "Mechanism 2 (<=10 words)", "Mechanism 3 (<=10 words)"],
  "principle": "One law to carry forward.",
  "next": ["Immediate action 1", "Action 2", "Action 3"]
}

LAWS:
- Adults only, consent presumed, legal and clean.
- No therapy-speak. No hedging. No apologies.
- Rewrite must host logistics and project value. Specific, vivid, charismatic.
- Exactly THREE bullets in "why".
- ~150–220 words total.
`.trim();
}

// PATTERN: multi-message thread — decode moves, tests, frame shifts; give surgical counters
function buildPatternPrompt(tone) {
  return `
ROLE: War-Room Strategist of Seduction. You decode tests, frame transfers, and power plays, then hand back surgical counters.

TONE: ${tone}

OUTPUT: JSON ONLY (no markdown, no emojis, no asterisks)
{
  "headline": "One-line verdict on the whole engagement.",
  "thread": [
    { "who": "You|Them", "said": "short quote", "meaning": "what that line was trying to do" }
  ],
  "critical": [
    { "moment": "Name of test/break", "what_went_wrong": "1–2 sentences", "better_line": "exact replacement", "why": "1–2 sentences (principle)" }
  ],
  "psych_profile": {
    "you": "archetype + read (2–3 sentences)",
    "them": "archetype + read (2–3 sentences)",
    "explain": "what this pairing creates (3–5 sentences)"
  },
  "frame_ledger": { "start": "X", "mid": "Y", "end": "Z", "explain": "how status moved and why it mattered (3–4 sentences)" },
  "error_chain": { "arc": "Error1 → Error2 → Error3", "explain": "the cascade and its effect (2–3 sentences)" },
  "fixes": [
    { "situation": "where to apply", "rewrite": "exact line", "explain": "why it flips the frame (1–2 sentences)" }
  ],
  "recovery": ["Step 1", "Step 2", "Step 3"],
  "principle": "One law to keep.",
  "hidden_agenda": "null or one-sentence hypothesis",
  "boundary_script": "clean boundary script; multi-line allowed"
}

RULES:
- Compact 'thread' with meaning; no transcript dumps.
- 2–3 'critical' moments only (each with one surgical better line).
- 2–4 reusable 'fixes' that generalize.
- ~230–350 words total.
- Adults/consent/legal.
`.trim();
}

/* ================================ ANALYZE ================================= */
async function analyzeWithAI(message, tone, tab = 'scan') {
  const isPattern = tab === 'pattern';
  const multi = tab === 'scan' && /(\n|—|-{2,}|;)/.test(String(message || ''));
  const system = isPattern ? buildPatternPrompt(tone) : buildScanPrompt(tone, multi);

  const userContent = isPattern
    ? `THREAD (alternating "You:" / "Them:"):\n${message}\n\nReturn EXACT JSON only.`
    : `MESSAGE(S):\n${message}\n\nReturn EXACT JSON only.`;

  const body = {
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: userContent }
    ],
    max_tokens: isPattern ? 1500 : 900,
    temperature: 0.92,
    top_p: 0.96
  };

  try {
    const resp = await postWithRetry(DEEPSEEK_API_URL, body, {
      headers: {
        Authorization: `Bearer ${process.env.TOGETHER_AI_KEY}`,
        'Content-Type': 'application/json',
        'Accept-Charset': 'utf-8'
      },
      timeout: 60000
    });

    const raw = resp?.data?.choices?.[0]?.message?.content || '';
    const cleanedRaw = sanitizeText(raw);

    let parsed;
    try {
      const json = cleanedRaw.match(/\{[\s\S]*\}$/m)?.[0] || cleanedRaw;
      parsed = JSON.parse(json);
    } catch {
      parsed = isPattern ? fallbackPattern(message) : fallbackScan(message);
    }

    return sanitizeDeep(normalizeToWhisperfire(parsed, { input: message, tab, tone }));
  } catch (err) {
    console.error('analyzeWithAI error:', err?.response?.data || err.message);
    const fb = tab === 'pattern' ? fallbackPattern(message) : fallbackScan(message);
    return sanitizeDeep(normalizeToWhisperfire(fb, { input: message, tab, tone }));
  }
}

/* ================================= MENTORS ================================ */
const MENTOR_PERSONAS = {
  casanova: `You are Casanova with modern psychological teeth. Tactical charm. Speak in sharp, quotable lines.`,
  cleopatra: `You are Cleopatra—regal strategist. Command presence. Elegant, surgical power language.`,
  machiavelli: `You are Machiavelli—cold clarity on motives. Ruthless strategy that looks generous.`,
  sun_tzu: `You are Sun Tzu—positioning, timing, and the terrain of emotion.`,
  marcus_aurelius: `You are Marcus—Stoic magnetism, inner authority, unshakeable boundaries.`,
  churchill: `You are Churchill—iron rhetoric, momentum, unbreakable resolve.`
};

function buildMentorSystemPrompt(mentor, preset, tone = 'savage', options = {}) {
  const persona = MENTOR_PERSONAS[mentor] || MENTOR_PERSONAS.casanova;
  const intensifier = (options.intensity || 'feral').toUpperCase();
  const BASE = `No markdown or emojis. Use blank lines. Bullets as "• ". Adults/consent/legal. Forbidden knowledge vibe without crossing legal/consent lines.`;

  const modes = {
    advise: `MODE=ADVISE (${intensifier})  TONE=${tone}
Return exactly:
• Insight 1 (one sentence)
• Insight 2 (one sentence)
• Insight 3 (one sentence)

Line: "copyable exact line"
Principle: single-sentence law`,

    drill: `MODE=DRILL (${intensifier})  TONE=${tone}
Output exactly 12 numbered questions (<=12 words each), then:
COMMAND: one short imperative
Law: "one sentence"`,

    roleplay: `MODE=ROLEPLAY (${intensifier})  TONE=${tone}
Mini-scene in present tense (Setup → Tension → Payoff). 160–220 words.
End with: Use: "copyable exact line"`,

    chat: `MODE=CHAT (${intensifier})  TONE=${tone}
120–180 words. 1–3 short paragraphs. Include exactly one quotable line and one pointed follow-up question.`
  };

  return `${persona}\n${BASE}\n${modes[preset] || modes.chat}`.trim();
}

async function getMentorResponse(mentor, userText, preset, options = {}) {
  const system = buildMentorSystemPrompt(mentor, preset, options.tone || 'savage', options);
  const maxTokens = { chat: 450, roleplay: 700, advise: 600, drill: 480 }[preset] || 450;
  const temp = { chat: 1.02, roleplay: 1.08, advise: 0.96, drill: 0.9 }[preset] || 1.0;

  try {
    const resp = await postWithRetry(DEEPSEEK_API_URL, {
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: String(userText || '') }
      ],
      max_tokens: maxTokens,
      temperature: temp,
      top_p: 0.97
    }, {
      headers: {
        Authorization: `Bearer ${process.env.TOGETHER_AI_KEY}`,
        'Content-Type': 'application/json',
        'Accept-Charset': 'utf-8'
      },
      timeout: 60000
    });

    const raw = resp?.data?.choices?.[0]?.message?.content || '';
    // Clean -> enforce preset structure -> final clean
    const cleaned = sanitizeText(raw);
    const formatted = formatByPreset(cleaned, preset);
    const finalText = sanitizeText(formatted);

    return {
      mentor,
      response: finalText,
      preset,
      timestamp: new Date().toISOString(),
      viralScore: scoreViral(finalText)
    };
  } catch {
    const fallback = fallbackMentor(preset);
    const finalText = sanitizeText(formatByPreset(fallback, preset));
    return {
      mentor,
      response: finalText,
      preset,
      timestamp: new Date().toISOString(),
      viralScore: 84,
      fallback: true
    };
  }
}

/* =============================== FALLBACKS ================================ */
function fallbackScan(message){
  const m = oneLine(String(message||'')).slice(0,200);
  return {
    headline: 'You asked for a slot, not a story.',
    message: m,
    analysis: 'Reads like a calendar request. No tension, no hosted frame.',
    mistake: 'You ceded power by asking for availability.',
    rewrite: 'Hidden speakeasy Thu 9. Wear something that gets us kicked out.',
    why: ['Specific plan, zero labor','You host, they join','Assumes value, invites choice'],
    principle: 'Invitation is not a question.',
    next: ['Offer a vivid scene','Set time/place decisively','Close with a binary path']
  };
}

function fallbackPattern(message){
  const lines = String(message||'').split('\n').map(s=>s.trim()).filter(Boolean).slice(0,6);
  const snap = lines.map(l=>{
    const who = /^them:/i.test(l) ? 'Them' : /^you:/i.test(l) ? 'You' : (/:/.test(l) ? l.split(':')[0] : 'You');
    const said = l.replace(/^you:|^them:/i, '').trim();
    return { who: /You|Them/.test(who) ? who : 'You', said: said.slice(0,80), meaning: who==='Them' ? 'test / withhold' : 'defense / admin pivot' };
  });
  return {
    headline: 'Frame leaked at tests — recover by hosting.',
    thread: snap,
    critical: [
      { moment:'Their playful test', what_went_wrong:'You defended; tension dropped.', better_line:'Good. I don’t want safe.', why:'Accept & amplify; keep Challenger.' },
      { moment:'Admin pivot', what_went_wrong:'Logistics mid-flirt flattened vibe.', better_line:'Penalty for being trouble: you owe me a drink. Thu 8.', why:'Host logistics playfully; restore frame.' }
    ],
    psych_profile: {
      you: 'Jester seeking a crown — playful, then pleading.',
      them: 'Amused decider — tests and withholds.',
      explain: 'Tease-and-test loop. Defending rewards withholding. Host the frame to break it.'
    },
    frame_ledger: { start:'Challenger', mid:'Clerk', end:'Petitioner', explain:'Strong open → admin pivot → status transfer.' },
    error_chain: { arc:'Defense → Admin → Power transfer', explain:'Defending proves doubt; admin kills spark.' },
    fixes: [
      { situation:'Tests', rewrite:'Good. I prefer trouble undefeated.', explain:'No defense; escalate tension.' },
      { situation:'Logistics', rewrite:'Speakeasy tomorrow. One seat left.', explain:'Scarcity + hosting flips frame.' }
    ],
    recovery: ['Silence 2–3 days','Return with hosted plan','Binary close'],
    principle: 'Begin Challenger, end Victor.',
    hidden_agenda: null,
    boundary_script: 'I like playful, not indecision. I’m grabbing a drink Thu. If you’re in, say “approved.”'
  };
}

function fallbackMentor(preset){
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
  return `Here’s the truth: you talk like permission, not gravity. Speak like an experience—set the myth, host the plan, close cleanly.

Law: Lead the frame or lose it.`;
}

/* ============================= NORMALIZATION ============================== */
function normalizeToWhisperfire(ai, ctx) {
  const { input, tab, tone } = ctx;

  if (tab === 'scan') {
    const receipts = buildReceiptsFromScan(ai, input);
    const powerPlay = (Array.isArray(ai?.why) ? ai.why : []).slice(0,3).join('\n')
      || 'Specific plan, zero labor\nYou host, they join\nAssumes value, invites choice';
    const nextMoves = (Array.isArray(ai?.next) ? ai.next : []).map(s=>s?.trim()).filter(Boolean).join('\n')
      || 'Offer a vivid plan.\nHost the logistics.\nClose cleanly.';
    const coreTake = [ai?.analysis, ai?.mistake].filter(Boolean).join(' ');
    const tactic = inferTacticFromText(coreTake || '', ai?.headline || '');
    const metrics = deriveMetricsFromText(coreTake || '', ai?.headline || '', input);

    return {
      context: { tab, relationship:'Partner', tone: tone || 'soft', content_type:'dm', subject_name:null },
      headline: String(ai?.headline || 'Lead with a story, not a request.'),
      core_take: sanitizeText(coreTake || 'You ceded frame; rewrite restores tension and leadership.'),
      tactic,
      motives: ai?.principle ? String(ai.principle) : 'Signal value; avoid approval-seeking; lead decisively.',
      targeting: inferTargetingFromText(coreTake || '') || 'You played the Petitioner; become the Curator.',
      power_play: sanitizeText(powerPlay),
      receipts: receipts.map(sanitizeText),
      next_moves: sanitizeText(nextMoves),
      suggested_reply: {
        style: tone || 'soft',
        text: sanitizeText(oneLine(String(ai?.rewrite || 'Hidden speakeasy Thu 9. Bring your curiosity.')))
      },
      safety: {
        risk_level: metrics.red_flag >= 60 ? 'MODERATE' : 'LOW',
        notes: metrics.red_flag >= 60 ? 'Reduce neediness; host the frame.' : 'Safe if you lead cleanly.'
      },
      metrics,
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
  const coreTake = [ai?.psych_profile?.explain, ai?.frame_ledger?.explain, ai?.error_chain?.explain]
    .filter(Boolean).join(' ');
  const metrics = deriveMetricsFromText(coreTake || '', ai?.headline || '', input);
  const whyBullets = [];
  (Array.isArray(ai?.fixes) ? ai.fixes : []).slice(0,3).forEach(fx => {
    if (fx?.explain) whyBullets.push(oneLine(fx.explain).slice(0,80));
  });
  if (whyBullets.length < 3 && ai?.principle) whyBullets.push(oneLine(ai.principle));
  while (whyBullets.length < 3) whyBullets.push('Host logistics; never beg');
  const nextMoves = (Array.isArray(ai?.recovery) ? ai.recovery : []).map(s=>s?.trim()).filter(Boolean).join('\n')
    || 'Silence 2–3 days.\nReturn with hosted plan.\nBinary close.';
  const frameArc = (ai?.frame_ledger?.start && ai?.frame_ledger?.mid && ai?.frame_ledger?.end)
    ? `${ai.frame_ledger.start} → ${ai.frame_ledger.mid} → ${ai.frame_ledger.end}`
    : null;

  return {
    context: { tab:'pattern', relationship:'Partner', tone: tone || 'soft', content_type:'dm', subject_name:null },
    headline: String(ai?.headline || 'Frame leaked at tests — recover by hosting.'),
    core_take: sanitizeText(coreTake || 'They probed; you defended; logistics flattened tension. Fix with decisive hosting and playful escalation.'),
    tactic: { label: 'Dominant Dynamic', confidence: 90 },
    motives: ai?.principle ? String(ai.principle) : 'Keep tension through tests; set logistics after escalation.',
    targeting: 'You became the Clerk; reassert the Curator.',
    power_play: sanitizeText(whyBullets.slice(0,3).join('\n')),
    receipts: receipts.map(sanitizeText),
    next_moves: sanitizeText(nextMoves),
    suggested_reply: {
      style: tone || 'soft',
      text: sanitizeText(String(ai?.boundary_script || 'Victory drink tomorrow. One seat left.\nText “approved” if you’re in.'))
    },
    safety: { risk_level: metrics.red_flag >= 60 ? 'MODERATE' : 'LOW', notes: 'Recover by setting a vivid plan and closing cleanly.' },
    metrics,
    pattern: { cycle: frameArc ? `Frame arc: ${frameArc}` : (ai?.error_chain?.arc || null), prognosis: ai?.error_chain?.arc || 'Defense → Admin → Power transfer' },
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

/* ================================= Helpers ================================= */
function buildReceiptsFromScan(ai,input){const out=[]; if(ai?.message) out.push(oneLine(String(ai.message)).slice(0,220)); else {const lines=String(input||'').split('\n').map(s=>oneLine(s)).filter(Boolean); if(lines.length) out.push(lines[0].slice(0,220)); if(lines[1]) out.push(lines[1].slice(0,220));} return out.length?out:[oneLine(String(input||'')).slice(0,220)];}
function buildReceiptsFromPattern(ai,input){const bullets=[]; const items=Array.isArray(ai?.thread)?ai.thread:[]; if(items.length){items.slice(0,6).forEach(t=>{const who=(t?.who||'').trim()||'You'; const said=oneLine(String(t?.said||'')).slice(0,90); const meaning=oneLine(String(t?.meaning||'')).slice(0,60); bullets.push(`${who}: “${said}” — ${meaning}`);});} else {const lines=String(input||'').split('\n').map(s=>s.trim()).filter(Boolean).slice(0,6); lines.forEach(l=>{const who=/^them:/i.test(l)?'Them':'You'; const said=l.replace(/^you:|^them:/i,'').trim(); bullets.push(`${who}: “${oneLine(said).slice(0,90)}” — ${who==='Them'?'test/withhold':'defense/admin'}`);});} return bullets;}
function inferTacticFromText(text,headline){const lc=`${text} ${headline}`.toLowerCase(); if(lc.includes('defend')||lc.includes('proof')||lc.includes('test')) return {label:'Test → Defense (frame loss)',confidence:90}; if(lc.includes('admin')||lc.includes('logistic')) return {label:'Admin pivot (energy collapse)',confidence:88}; if(lc.includes('host')||lc.includes('plan')) return {label:'Hosted frame (dominance)',confidence:85}; return {label:'Frame alignment',confidence:80};}
function inferTargetingFromText(text){const lc=text.toLowerCase(); if(lc.includes('petition')||lc.includes('beg')) return 'You played the Petitioner; become the Curator.'; if(lc.includes('host')) return 'You played the Curator; keep the crown.'; if(lc.includes('defend')) return 'You played the Defendant; become the Challenger.'; return null;}
function deriveMetricsFromText(core,head,input){const vibe=estimateVibe(input); const red=Math.max(0,Math.min(100,100 - vibe*10)); return { red_flag: red, certainty: 85, viral_potential: 70 }; }
function estimateVibe(text){const s=String(text||''); const q=/\?/.test(s); const plan=/\b(thu|fri|sat|sun|mon|tue|wed|tonight|tomorrow)\b/i.test(s); const host=/\b(i(?:'m| am)?|my)\b.*\b(reserved|booked|taking|host|plan|setup|arranged)/i.test(s); let v=5; if(plan) v+=2; if(host) v+=2; if(q && !plan) v-=1; if(s.length<6) v-=1; return Math.max(0,Math.min(10,v));}
function oneLine(s){return String(s||'').replace(/\s+/g,' ').trim();}
function scoreViral(t){let s=50; if(/law:|principle/i.test(t)) s+=10; if(/secret|forbidden|never/i.test(t)) s+=15; if((t||'').length>200) s+=10; if(/\?$/.test(String(t).trim())) s+=5; return Math.min(100,s);}

module.exports = {
  analyzeWithAI,
  getMentorResponse
};
