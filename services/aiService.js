// services/aiService.js — ORACLE SEDUCER v5 (ASCII-safe, no markdown, hard drill)
const axios = require('axios');

const DEEPSEEK_API_URL = 'https://api.together.xyz/v1/chat/completions';
const MODEL = 'deepseek-ai/DeepSeek-V3';

/* --------------------------- ANALYZE PROMPTS --------------------------- */

function buildScanPrompt(tone, multi) {
  return `
ROLE: Elite strategist (Casanova x Cleopatra x Sun Tzu). Decode the user's line(s). Rebuild a pull, not a plea.
TONE=${tone}

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
- PLAIN TEXT JSON values. No markdown, no asterisks, no emojis.
- 140–220 words total.`;
}

function buildPatternPrompt(tone) {
  return `
ROLE: War-room strategist. Decode frame transfers across a thread.
TONE=${tone}

OUTPUT JSON ONLY:
{
  "headline": "...",
  "thread": [{"who":"You|Them","said":"...","meaning":"..."}],
  "critical": [{"moment":"...","what_went_wrong":"...","better_line":"...","why":"..."}],
  "psych_profile": {"you":"...","them":"...","explain":"..."},
  "frame_ledger": {"start":"X","mid":"Y","end":"Z","explain":"..."},
  "error_chain": {"arc":"A -> B -> C","explain":"..."},
  "fixes": [{"situation":"...","rewrite":"...","explain":"..."}],
  "recovery": ["...","...","..."],
  "principle": "...",
  "hidden_agenda": "null or one sentence",
  "boundary_script": "..."
}

RULES:
- PLAIN TEXT JSON values. No markdown, no emojis.
- 220–350 words.`;
}

/* ------------------------------ ANALYZE ------------------------------- */

async function analyzeWithAI(message, tone, tab = 'scan') {
  const system = tab === 'pattern' ? buildPatternPrompt(tone) : buildScanPrompt(tone, /\n|—|--|;/.test(String(message||'')));

  const requestBody = {
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: tab === 'pattern'
          ? `THREAD (lines "You:"/"Them:"):\n${message}\nReturn ONLY the JSON object.`
          : `MESSAGE(S):\n${message}\nReturn ONLY the JSON object.` }
    ],
    max_tokens: tab === 'pattern' ? 1800 : 1200,
    temperature: 0.9,
    top_p: 0.95
  };

  try {
    const resp = await axios.post(DEEPSEEK_API_URL, requestBody, {
      headers: { Authorization: `Bearer ${process.env.TOGETHER_AI_KEY}`, 'Content-Type': 'application/json' },
      timeout: 55000
    });
    const raw = resp?.data?.choices?.[0]?.message?.content || '';
    let parsed;
    try {
      const json = raw.match(/\{[\s\S]*\}$/m)?.[0] || raw;
      parsed = JSON.parse(json);
    } catch {
      parsed = tab === 'pattern' ? fallbackPattern(message) : fallbackScan(message);
    }
    return normalizeToWhisperfire(parsed, { input: message, tab, tone });
  } catch (e) {
    const fb = tab === 'pattern' ? fallbackPattern(message) : fallbackScan(message);
    return normalizeToWhisperfire(fb, { input: message, tab, tone });
  }
}

/* -------------------------- NORMALIZATION ----------------------------- */

function normalizeToWhisperfire(ai, ctx) {
  const { input, tab, tone } = ctx;
  if (tab === 'scan') {
    const receipts = buildReceiptsFromScan(ai, input);
    const powerPlay = (Array.isArray(ai?.why) ? ai.why : []).slice(0,3).join('\n') ||
      'Specific plan, zero labor\nYou host, they join\nAssumes value, invites choice';
    const nextMoves = (Array.isArray(ai?.next) ? ai.next : []).map(s=>s?.trim()).filter(Boolean).join('\n') ||
      'Offer a vivid plan.\nHost the logistics.\nClose cleanly.';
    const coreTake = join([ai?.analysis, ai?.mistake]);

    const tactic = inferTactic(coreTake || '', ai?.headline || '');
    const metrics = deriveMetrics(coreTake || '', ai?.headline || '', input);

    return {
      context: { tab, relationship:'Partner', tone: tone||'soft', content_type:'dm', subject_name:null },
      headline: String(ai?.headline || 'Lead with a story, not a request.'),
      core_take: coreTake || 'You ceded frame; rewrite restores tension and leadership.',
      tactic,
      motives: ai?.principle ? String(ai.principle) : 'Signal value; avoid approval-seeking; lead decisively.',
      targeting: targetHint(coreTake || '') || 'You played the Petitioner; become the Curator.',
      power_play: powerPlay,
      receipts,
      next_moves: nextMoves,
      suggested_reply: { style: tone||'soft', text: oneLine(String(ai?.rewrite || 'Hidden speakeasy Thu 9. Bring your curiosity.')) },
      safety: { risk_level: metrics.red_flag >= 60 ? 'MODERATE' : 'LOW', notes: metrics.red_flag >= 60 ? 'Reduce neediness; host the frame.' : 'Safe if you lead cleanly.' },
      metrics: { red_flag: metrics.red_flag, certainty: metrics.certainty, viral_potential: metrics.viral_potential },
      pattern: { cycle:null, prognosis:null },
      ambiguity: { warning:null, missing_evidence:null },
      hidden_agenda: null, archetypes:null, trigger_pattern_map:null, contradictions:null, weapons:null, forecast:null,
      counter_intervention: String(ai?.principle || 'Invitation is not a question.'), long_game: null
    };
  }

  // pattern
  const receipts = buildReceiptsFromPattern(ai, input);
  const coreTake = join([ai?.psych_profile?.explain, ai?.frame_ledger?.explain, ai?.error_chain?.explain]);
  const metrics = deriveMetrics(coreTake || '', ai?.headline || '', input);

  const whyBullets = [];
  (Array.isArray(ai?.fixes) ? ai.fixes : []).slice(0,3).forEach(f => { if (f?.explain) whyBullets.push(oneLine(f.explain).slice(0,80)); });
  if (whyBullets.length < 3 && ai?.principle) whyBullets.push(oneLine(ai.principle));
  while (whyBullets.length < 3) whyBullets.push('Host logistics; never beg');

  const nextMoves = (Array.isArray(ai?.recovery) ? ai.recovery : []).map(s=>s?.trim()).filter(Boolean).join('\n')
    || 'Silence 2–3 days.\nReturn with hosted plan.\nBinary close.';

  const frameArc = ai?.frame_ledger?.start && ai?.frame_ledger?.mid && ai?.frame_ledger?.end
    ? `${ai.frame_ledger.start} -> ${ai.frame_ledger.mid} -> ${ai.frame_ledger.end}` : null;

  return {
    context: { tab:'pattern', relationship:'Partner', tone: tone||'soft', content_type:'dm', subject_name:null },
    headline: String(ai?.headline || 'Frame leaked at tests -- recover by hosting.'),
    core_take: coreTake || 'They probed; you defended; logistics flattened tension. Fix with decisive hosting and playful escalation.',
    tactic: { label:'Dominant Dynamic', confidence:90 },
    motives: ai?.principle ? String(ai.principle) : 'Keep tension through tests; set logistics after escalation.',
    targeting: 'You became the Clerk; reassert the Curator.',
    power_play: whyBullets.slice(0,3).join('\n'),
    receipts,
    next_moves: nextMoves,
    suggested_reply: { style: tone||'soft', text: String(ai?.boundary_script || 'Victory drink tomorrow. One seat left.\nText "approved" if you’re in.') },
    safety: { risk_level: metrics.red_flag >= 60 ? 'MODERATE' : 'LOW', notes:'Recover by setting a vivid plan and closing cleanly.' },
    metrics: { red_flag: metrics.red_flag, certainty: metrics.certainty, viral_potential: metrics.viral_potential },
    pattern: { cycle: frameArc ? `Frame arc: ${frameArc}` : (ai?.error_chain?.arc || null), prognosis: ai?.error_chain?.arc || 'Defense -> Admin -> Power transfer' },
    ambiguity: { warning:null, missing_evidence:null },
    hidden_agenda: ai?.hidden_agenda ?? null,
    archetypes:null, trigger_pattern_map:null, contradictions:null, weapons:null, forecast:null,
    counter_intervention: String(ai?.principle || 'Begin Challenger, end Victor.'), long_game:null
  };
}

/* ------------------------------ FALLBACKS ------------------------------ */

function fallbackScan(message) {
  const condensed = oneLine(String(message || '')).slice(0,200);
  const vibe = estimateVibe(message);
  const rewrite = vibe >= 7
    ? 'Keep Thu 9. I\'m stealing you for the speakeasy.'
    : 'Hidden speakeasy Thu 9. Wear something that gets us kicked out.';
  return {
    headline: vibe >= 7 ? 'Clean invite. Tighten the myth.' : 'You asked for a slot, not a story.',
    message: condensed,
    analysis: vibe >= 7
      ? 'You lead with a plan. Add mystique and scarcity to raise pull.'
      : 'It reads like a calendar request. No edge, no tension, no hosted frame.',
    mistake: vibe >= 7
      ? 'Logistics are solid, but energy is flat: no myth, no scarcity.'
      : 'You ceded power by asking for availability. Attraction needs leadership.',
    rewrite,
    why: ['Specific plan, zero labor','You host, they join','Assumes value, invites choice'],
    principle: 'Invitation is not a question.',
    next: ['Offer a vivid scene','Set time/place decisively','Close with a binary path']
  };
}

function fallbackPattern(message) {
  const lines = String(message || '').split('\n').map(s=>s.trim()).filter(Boolean).slice(0,6);
  const snapshot = lines.map(l => {
    const who = /^them:/i.test(l) ? 'Them' : /^you:/i.test(l) ? 'You' : /:/.test(l) ? l.split(':')[0] : 'You';
    const said = l.replace(/^you:|^them:/i,'').trim();
    return { who: /You|Them/.test(who) ? who : 'You', said: said.slice(0,80), meaning: who==='Them'?'test / withhold':'defense / admin pivot' };
  });
  return {
    headline: 'Frame leaked at tests -- recover by hosting.',
    thread: snapshot,
    critical: [
      { moment:'Their playful test', what_went_wrong:'You defended yourself, proving doubt and lowering tension.', better_line:'Good. I don\'t want safe.', why:'Accepts and escalates; keeps Challenger frame.' },
      { moment:'Admin pivot', what_went_wrong:'You switched to logistics mid-flirt, collapsing vibe.', better_line:'Penalty for being trouble: you owe me a drink. Thu 8.', why:'Hosts logistics with playful dominance; restores frame.' }
    ],
    psych_profile: { you:'Jester seeking a crown -- playful, then pleading.', them:'Amused decider -- tests, withholds, enjoys pursuit.', explain:'Tease-and-test loop. Defending rewards their withholding. Host the frame to break it.' },
    frame_ledger: { start:'Challenger', mid:'Clerk', end:'Petitioner', explain:'You opened strong, then surrendered logistics. Status transferred.' },
    error_chain: { arc:'Defense -> Admin -> Power transfer', explain:'Defending proves doubt; admin kills spark; power moves to them.' },
    fixes: [
      { situation:'Tests', rewrite:'Good. I prefer trouble undefeated.', explain:'Accept and amplify -- more tension, no defense.' },
      { situation:'Logistics', rewrite:'Speakeasy tomorrow. One seat left.', explain:'Scarcity + hosting flips the frame.' }
    ],
    recovery:['Silence 2–3 days','Return with hosted plan','Binary close'],
    principle:'Begin Challenger, end Victor.',
    hidden_agenda:null,
    boundary_script:'I like playful, not indecision. I\'m grabbing a drink Thu. If you\'re in, say "approved".'
  };
}

/* ------------------------------ HELPERS -------------------------------- */

function buildReceiptsFromScan(ai, input) {
  const out = [];
  if (ai?.message) out.push(oneLine(String(ai.message)).slice(0,220));
  else {
    const lines = String(input||'').split('\n').map(s=>oneLine(s)).filter(Boolean);
    if (lines.length) out.push(lines[0].slice(0,220));
    if (lines[1]) out.push(lines[1].slice(0,220));
  }
  return out.length ? out : [oneLine(String(input||'')).slice(0,220)];
}

function buildReceiptsFromPattern(ai, input) {
  const bullets = [];
  const items = Array.isArray(ai?.thread) ? ai.thread : [];
  if (items.length) {
    items.slice(0,6).forEach(t=>{
      const who = (t?.who||'').trim() || 'You';
      const said = oneLine(String(t?.said||'')).slice(0,90);
      const meaning = oneLine(String(t?.meaning||'')).slice(0,60);
      bullets.push(`${who}: "${said}" -- ${meaning}`);
    });
  } else {
    const lines = String(input||'').split('\n').map(s=>s.trim()).filter(Boolean).slice(0,6);
    lines.forEach(l=>{
      const who = /^them:/i.test(l)?'Them':'You';
      const said = l.replace(/^you:|^them:/i,'').trim();
      bullets.push(`${who}: "${oneLine(said).slice(0,90)}" -- ${who==='Them'?'test/withhold':'defense/admin'}`);
    });
  }
  return bullets;
}

function inferTactic(text, headline) {
  const lc = `${text} ${headline}`.toLowerCase();
  if (lc.includes('defend') || lc.includes('proof') || lc.includes('test')) return { label:'Test -> Defense (frame loss)', confidence:90 };
  if (lc.includes('admin') || lc.includes('logistic')) return { label:'Admin pivot (energy collapse)', confidence:88 };
  if (lc.includes('host') || lc.includes('plan')) return { label:'Hosted frame (dominance)', confidence:85 };
  return { label:'Frame alignment', confidence:80 };
}

function targetHint(text) {
  const lc = text.toLowerCase();
  if (lc.includes('petition') || lc.includes('beg')) return 'You played the Petitioner; become the Curator.';
  if (lc.includes('host')) return 'You played the Curator; keep the crown.';
  if (lc.includes('defend')) return 'You played the Defendant; become the Challenger.';
  return null;
}

function deriveMetrics(core, head, input) {
  const vibe = estimateVibe(input);
  const red = clampInt(100 - vibe*10, 0, 100);
  return { red_flag:red, certainty:86, viral_potential:74 };
}

function estimateVibe(text) {
  const s = String(text||'');
  const q = /\?/.test(s);
  const plan = /\b(thu|fri|sat|sun|mon|tue|wed|tonight|tomorrow)\b/i.test(s);
  const host = /\b(i(?:'m| am)?|my)\b.*\b(reserved|booked|taking|host|plan|setup|arranged)/i.test(s);
  let v = 5; if (plan) v+=2; if (host) v+=2; if (q && !plan) v-=1; if (s.length<6) v-=1;
  return Math.max(0, Math.min(10, v));
}

function oneLine(s){ return String(s||'').replace(/\s+/g,' ').trim(); }
function join(parts){ return (parts||[]).map(p=>String(p||'').trim()).filter(Boolean).join(' '); }
function clampInt(n,min,max){ const x = parseInt(Number(n||0),10); if (Number.isNaN(x)) return min; return Math.max(min, Math.min(max, x)); }

/* ----------------------------- MENTOR PROMPTS -------------------------- */

const MENTOR_PROMPTS = {
  casanova: `You are Casanova with tactical psychology. Speak in quotable, plain text.`,
  cleopatra: `You are Cleopatra—regal strategist. Commanding, surgical, plain text.`,
  machiavelli:`You are Machiavelli—cold clarity. Strategic, plain text.`,
  sun_tzu:   `You are Sun Tzu—positioning, timing. Plain text.`,
  marcus_aurelius:`You are Marcus—Stoic magnetism. Grounded, plain text.`,
  churchill: `You are Churchill—iron rhetoric. Plain text.`
};

function presetPrompts(mentor) {
  const p = MENTOR_PROMPTS[mentor] || MENTOR_PROMPTS.casanova;
  const common = `
OUTPUT RULES:
- PLAIN TEXT ONLY. No markdown, no asterisks, no emojis.
- ASCII only (use straight quotes ' and ").
- Separate paragraphs with ONE blank line.
- If you must list, use lines starting with "- " (hyphen + space).
- Do NOT write labels like "Insight 1", "Tip 2", etc. Just write the content.`;

  return {
    chat: `${p}

MODE=CHAT
- 80–140 words.
- Conversational. Ask ONE sharp follow-up question.
- Include ONE quotable line.

${common}`,

    roleplay: `${p}

MODE=ROLEPLAY
- Scene in present tense: Setup -> Tension -> Payoff.
- 160–220 words.
- End with a copyable line prefixed exactly with: Use:

${common}`,

    advise: `${p}

MODE=ADVISE
- Three sharp insights as simple lines, then one exact line, then one principle.
- 180–240 words total.
- Format example (no numbers, no "Insight 1/2/3"):
- Insight text
- Insight text
- Insight text
Line: "..."
Principle: ...

${common}`,

    drill: `${p}

MODE=DRILL
- Four ruthless questions (<=16 words each).
- Then one command line starting with "Do:".
- End with: Law: <one sentence>

${common}`
  };
}

async function getMentorResponse(mentor, userText, preset, options = {}) {
  const modes = presetPrompts(mentor);
  const system = modes[preset] || modes.chat;

  try {
    const resp = await axios.post(DEEPSEEK_API_URL, {
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userText }
      ],
      max_tokens: 600,
      temperature: 0.95,
      top_p: 0.95
    }, {
      headers: { Authorization: `Bearer ${process.env.TOGETHER_AI_KEY}`, 'Content-Type': 'application/json' },
      timeout: 55000
    });

    const text = resp?.data?.choices?.[0]?.message?.content || '';
    return {
      mentor, response: text, preset,
      timestamp: new Date().toISOString(),
      viralScore: scoreViral(text)
    };
  } catch {
    const fallback = `Uncomfortable truth: you speak like permission, not gravity.

Do: Set a vivid plan and close cleanly.

Law: Lead the frame or lose it.`;
    return { mentor, response: fallback, preset, timestamp: new Date().toISOString(), viralScore: 84 };
  }
}

function scoreViral(t){
  let s=50; if(/law:|principle/i.test(t)) s+=10; if(/secret|forbidden|never/i.test(t)) s+=15; if(t.length>200)s+=10; if(/\?$/.test(t.trim()))s+=5; return Math.min(100,s);
}

module.exports = {
  analyzeWithAI,
  getMentorResponse
};
