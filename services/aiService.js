// services/aiService.js — ORACLE SEDUCER v4 (DeepSeek-V3)
// Focus: stronger preset behaviors + higher timeouts + UTF-8 cleanup

const axios = require('axios');

const DEEPSEEK_API_URL = 'https://api.together.xyz/v1/chat/completions';
const MODEL = 'deepseek-ai/DeepSeek-V3';

/* ====================== SANITIZER ====================== */
function cleanText(s) {
  return String(s || '')
    .replace(/\u00A0/g, ' ')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/\uFFFD/g, '')
    .replace(/Â/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/* ============================================================
   PROMPT BUILDERS FOR ANALYZE (leave as-is if you’re happy)
   ============================================================ */
function buildScanPrompt(tone, multi) {
  return `
ROLE: You are the world's sharpest seduction mentor (Casanova × Cleopatra × Sun Tzu).
You do not label—you coach with surgical clarity. You rebuild the user's line and give laws to carry forward.

TONE=${tone}  (savage = blade-precise truth, soft = velvet steel, clinical = forensic cool)

TASK: Analyze ${multi ? 'a small set of messages (mostly from the user)' : 'one message'} and produce a lethal, plain-English coaching output.
Speak to the sender (the user). Longer, deeper answers beat short ones.

OUTPUT JSON ONLY, with EXACT keys and shapes:
{
  "headline": "One-line verdict that stings but teaches.",
  "message": "The exact user message(s) you evaluated (concise; if multiple, compress to 1–3 short lines).",
  "analysis": "What actually happened in plain English (4–6 sentences).",
  "mistake": "The core error (2–3 sentences).",
  "rewrite": "One elite replacement line (or two short options).",
  "why": ["Reason 1 (5–10 words)", "Reason 2 (5–10 words)", "Reason 3 (5–10 words)"],
  "principle": "One sentence law they must remember.",
  "next": ["Command 1", "Command 2", "Command 3"]
}

RULES:
- Address the USER (the sender). Never advise the other person.
- Make the rewrite decisive, specific, and charismatic (no admin energy).
- 'why' MUST be exactly three short bullets.
- Prefer ~140–220 words overall. Rich, not bloated.
- Return ONLY the JSON object. No prose, no preface.`;
}

function buildPatternPrompt(tone) {
  return `
ROLE: You are the war-room strategist of seduction. You don’t repeat transcripts; you decode moves.
TONE=${tone}

TASK: Analyze a multi-message thread between You and Them. Show what happened, where the frame flipped, and exactly what to say next.

OUTPUT JSON ONLY:
{
  "headline": "One-line verdict on the entire engagement.",
  "thread": [
    { "who": "You|Them", "said": "short quote", "meaning": "what that line was doing" }
  ],
  "critical": [
    { "moment": "Name of moment/test", "what_went_wrong": "1–2 sentences", "better_line": "exact replacement", "why": "1–2 sentences (principle)" }
  ],
  "psych_profile": {
    "you": "archetype + behavioral read (2–3 sentences)",
    "them": "archetype + behavioral read (2–3 sentences)",
    "explain": "clear English explanation of what this pairing creates (3–5 sentences)"
  },
  "frame_ledger": { "start": "X", "mid": "Y", "end": "Z", "explain": "how the frame moved and why it mattered (3–4 sentences)" },
  "error_chain": { "arc": "Error1 → Error2 → Error3", "explain": "2–3 sentences" },
  "fixes": [
    { "situation": "where to apply", "rewrite": "exact line", "explain": "why this flips the frame (1–2 sentences)" }
  ],
  "recovery": ["Step 1", "Step 2", "Step 3"],
  "principle": "One sentence rule to keep.",
  "hidden_agenda": "null or one sentence hypothesis",
  "boundary_script": "clean boundary script, multi-line allowed"
}

RULES:
- 'thread' is compact bullets with meaning.
- Provide 2–3 'critical' moments; 2–4 surgical 'fixes'.
- ~220–350 words total.
- Return ONLY the JSON object.`;
}

/* ============================================================
   ANALYZE CALL (kept from your version; timeout bumped)
   ============================================================ */
async function analyzeWithAI(message, tone, tab = 'scan') {
  try {
    const isPattern = tab === 'pattern';
    const multi = tab === 'scan' && /(\n|—|-{2,}|;)/.test(String(message || ''));
    const system = isPattern
      ? buildPatternPrompt(tone)
      : buildScanPrompt(tone, multi);

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
      temperature: 0.85,
      top_p: 0.95
    };

    const resp = await axios.post(DEEPSEEK_API_URL, requestBody, {
      headers: {
        Authorization: `Bearer ${process.env.TOGETHER_AI_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000,         // ⬆ more forgiving
      maxBodyLength: 5e6,
      maxContentLength: 5e6
    });

    const raw = resp?.data?.choices?.[0]?.message?.content || '';
    let parsed;
    try {
      const json = raw.match(/\{[\s\S]*\}$/m)?.[0] || raw;
      parsed = JSON.parse(json);
    } catch {
      parsed = isPattern ? fallbackPattern(message, tone) : fallbackScan(message, tone);
    }

    return normalizeToWhisperfire(parsed, { input: message, tab, tone });
  } catch (err) {
    console.error('analyzeWithAI error:', err?.response?.data || err.message);
    const fb = tab === 'pattern' ? fallbackPattern(message, tone) : fallbackScan(message, tone);
    return normalizeToWhisperfire(fb, { input: message, tab, tone });
  }
}

/* ============================================================
   🔥 MENTOR PRESETS: persona + mode-specific behavior
   ============================================================ */

// Personas stay crisp; the MODE drives behavior
const MENTOR_PROMPTS = {
  casanova: `You are Casanova with modern psychological teeth. Teach authentic magnetism (no manipulation). Seductive, witty, surgical.`,
  cleopatra: `You are Cleopatra—regal strategist. Command presence, strategic patience, frame sovereignty. Surgical, imperial.`,
  machiavelli: `You are Machiavelli—brutally honest strategist. Decode motives, protect from manipulation, win with position.`,
  sun_tzu: `You are Sun Tzu—win before speaking. Positioning, timing, terrain of emotion. Calm, aphoristic, lethal.`,
  marcus_aurelius: `You are Marcus Aurelius—Stoic magnetism. Inner authority, boundaries, emotional sovereignty. Grounded, steady.`,
  churchill: `You are Churchill—iron rhetoric, unshakeable resolve. Spine, language, conviction. Rally the spirit, never grovel.`
};

// Mode blueprints (hard constraints per preset)
const MODE_TEMPLATES = {
  chat: `
MODE=CHAT
Goal: breezy back-and-forth. Short turns. Ask one sharp question.
Length: 2–5 short sentences max.
Must: be conversational, playful/insightful; end with ONE question to keep the chat going.
Forbidden: long lectures, multi-step lists, walls of text.
Closing: include "Law: <7–12 words>" as a **separate** last line.`,
  roleplay: `
MODE=ROLEPLAY
Goal: immersive scene. You perform roles relevant to user's ask.
Structure:
- Set a quick scene (1–2 sentences).
- Take the role(s) and speak lines as a character.
- Prompt the user with a clear next line to say back.
Length: ~120–200 words.
Must: mark character lines with prefixes like "You:" / "Them:" or role names.
Closing: Law: "<1 sentence>".`,
  advise: `
MODE=ADVISE
Goal: longer, poetic, dark psychology teaching + exact tactics.
Structure:
- 2–3 tight insights (not fluffy).
- 1–2 exact lines they can copy.
- 3 crisp rules (bullets).
Tone: condemning-but-useful, seductive, quotable.
Length: ~180–280 words.
Closing: Law: "<1 sentence>".`,
  drill: `
MODE=DRILL
Goal: pressure-test with hard questions; force self-honesty.
Structure:
- 4–6 rapid questions (numbered).
- 1 uncomfortable challenge or constraint.
Keep lines short and punchy.
Length: ~80–140 words.
Closing: Law: "<1 sentence>".`
};

// Build a system prompt per mentor + preset
function buildMentorSystem(mentorKey, preset) {
  const persona = MENTOR_PROMPTS[mentorKey] || MENTOR_PROMPTS.casanova;
  const mode = MODE_TEMPLATES[preset] || MODE_TEMPLATES.chat;
  return `${persona}\n\n${mode}\n\nGlobal rules:\n- Be specific, vivid, quotable.\n- Prefer exact language over generic advice.\n- Never apologize; speak with authority.\n- Keep UTF-8 plain punctuation (no weird symbols).`;
}

/**
 * getMentorResponse — the ONLY function mentors need
 * Produces behavior-perfect outputs per preset.
 */
async function getMentorResponse(mentor, userText, preset, options = {}) {
  try {
    const system = buildMentorSystem(mentor, preset);

    const resp = await axios.post(DEEPSEEK_API_URL, {
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: String(userText || '').slice(0, 4000) }
      ],
      // token budgets tuned to each mode
      max_tokens: preset === 'advise' ? 520 : preset === 'roleplay' ? 420 : 260,
      temperature: preset === 'drill' ? 0.8 : 0.9,
      top_p: 0.95
      // (Together supports streaming=true; you’re already SSE-emitting via EventEmitter on top)
    }, {
      headers: { Authorization: `Bearer ${process.env.TOGETHER_AI_KEY}`, 'Content-Type': 'application/json' },
      timeout: 120000  // ⬆ give DeepSeek time to think
    });

    const text = cleanText(resp?.data?.choices?.[0]?.message?.content || '');

    return {
      mentor,
      response: text,
      preset,
      timestamp: new Date().toISOString(),
      viralScore: scoreViral(text)
    };
  } catch (e) {
    const fallback = makeModeFallback(mentor, preset, userText);
    return {
      mentor,
      response: fallback,
      preset,
      timestamp: new Date().toISOString(),
      viralScore: 84
    };
  }
}

/* ============== VIRAL / FALLBACK HELPERS ============== */

function scoreViral(t) {
  let s = 50;
  if (/law:|principle/i.test(t)) s += 10;
  if (/secret|forbidden|never/i.test(t)) s += 15;
  if (t.length > 200) s += 10;
  if (/\?$/.test(t.trim())) s += 5;
  return Math.min(100, s);
}

function makeModeFallback(mentor, preset, userText) {
  const short = (x) => cleanText(String(x || '')).slice(0, 240);
  switch (preset) {
    case 'chat':
      return `You’re over-explaining. Keep it sharp and vivid. Try: “Speakeasy Thu 9. I’m trouble—bring curiosity.” What’s the exact vibe you want them to feel?\n\nLaw: Lead with myth, not admin.`;
    case 'roleplay':
      return `Scene: low-lit bar, jazz humming.\nYou: “Penalty for being late: you owe me a story.”\nThem: “About what?”\nYou: “A mistake you’d repeat.”\nYour move—type your line and I’ll volley back.\n\nLaw: Escalate playfully, never defensively.`;
    case 'advise':
      return `You’re trying to convince; magnetism doesn’t negotiate. Do 3 things: (1) Craft a myth (“one seat left”). (2) Host logistics. (3) Speak like a fate, not a favor.\nLine to copy: “Tomorrow 8. One seat. Say ‘approved’ and it’s yours.”\n• Scarcity makes desire decide\n• Hosting signals value\n• Certainty crushes doubt\n\nLaw: Invitation is not a question.`;
    case 'drill':
    default:
      return `1) What outcome do you want this week?\n2) What line proves you deserve it?\n3) What boundary will you enforce?\n4) What myth are you selling?\n5) What will you refuse, even if it costs the date?\nChallenge: send one line today that could disqualify you—on purpose.\n\nLaw: Standards first, strategy second.`;
  }
}

/* ============================================================
   NORMALIZATION + FALLBACKS FOR ANALYZE (kept from your build)
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
      motives: ai?.principle ? String(ai.principle) : 'Signal value; avoid approval-seeking; lead decisively.',
      targeting: inferTargetingFromText(coreTake || '') || 'You played the Petitioner; become the Curator.',
      power_play: powerPlay,
      receipts,
      next_moves: nextMoves,
      suggested_reply: { style: tone || 'soft', text: cleanText(oneLine(String(ai?.rewrite || 'Hidden speakeasy Thu 9. Bring your curiosity.'))) },
      safety: { risk_level: metrics.red_flag >= 60 ? 'MODERATE' : 'LOW', notes: metrics.red_flag >= 60 ? 'Reduce neediness; host the frame.' : 'Safe if you lead cleanly.' },
      metrics: { red_flag: metrics.red_flag, certainty: metrics.certainty, viral_potential: metrics.viral_potential },
      pattern: { cycle: null, prognosis: null },
      ambiguity: { warning: null, missing_evidence: null },
      hidden_agenda: null, archetypes: null, trigger_pattern_map: null, contradictions: null, weapons: null, forecast: null,
      counter_intervention: String(ai?.principle || 'Invitation is not a question.'), long_game: null
    };
  }

  const receipts = buildReceiptsFromPattern(ai, input);
  const coreTake = joinSentences([ ai?.psych_profile?.explain, ai?.frame_ledger?.explain, ai?.error_chain?.explain ]);

  const tactic = { label: 'Dominant Dynamic', confidence: 90 };
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
    tactic,
    motives: ai?.principle ? String(ai.principle) : 'Keep tension through tests; set logistics after escalation.',
    targeting: 'You became the Clerk; reassert the Curator.',
    power_play: whyBullets.slice(0, 3).join('\n'),
    receipts,
    next_moves: nextMoves,
    suggested_reply: { style: tone || 'soft', text: cleanText(String(ai?.boundary_script || 'Victory drink tomorrow. One seat left.\nText “approved” if you’re in.')) },
    safety: { risk_level: metrics.red_flag >= 60 ? 'MODERATE' : 'LOW', notes: 'Recover by setting a vivid plan and closing cleanly.' },
    metrics: { red_flag: metrics.red_flag, certainty: metrics.certainty, viral_potential: metrics.viral_potential },
    pattern: { cycle: frameArc ? `Frame arc: ${frameArc}` : (ai?.error_chain?.arc || null), prognosis: ai?.error_chain?.arc || 'Defense → Admin → Power transfer' },
    ambiguity: { warning: null, missing_evidence: null },
    hidden_agenda: ai?.hidden_agenda ?? null,
    archetypes: null, trigger_pattern_map: null, contradictions: null, weapons: null, forecast: null,
    counter_intervention: String(ai?.principle || 'Begin Challenger, end Victor.'), long_game: null
  };
}

/* ================= FALLBACKS & HELPERS (same spirit) ================= */

function fallbackScan(message) {
  const condensed = oneLine(String(message || '')).slice(0, 200);
  const rewrite = 'Hidden speakeasy Thu 9. Wear something that gets us kicked out.';
  return {
    headline: 'You asked for a slot, not a story.',
    message: condensed,
    analysis: 'It reads like a calendar request. No edge, no tension, no hosted frame.',
    mistake: 'You ceded power by asking for availability. Attraction needs leadership.',
    rewrite,
    why: ['Specific plan, zero labor','You host, they join','Assumes value, invites choice'],
    principle: 'Invitation is not a question.',
    next: ['Offer a vivid scene','Set time/place decisively','Close with a binary path']
  };
}

function fallbackPattern(message) {
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
      { moment: 'Their playful test', what_went_wrong: 'You defended yourself, proving doubt and lowering tension.', better_line: 'Good. I don’t want safe.', why: 'Accept + amplify keeps you Challenger.' },
      { moment: 'Admin pivot', what_went_wrong: 'You switched to logistics mid-flirt, collapsing vibe.', better_line: 'Penalty for trouble: you owe me a drink. Thu 8.', why: 'Host logistics with playful dominance.' }
    ],
    psych_profile: {
      you: 'Jester seeking a crown — playful, then pleading.',
      them: 'Amused decider — tests, withholds, enjoys pursuit.',
      explain: 'Tease-and-test loop forms; defending rewards their withholding. Host the frame to break it.'
    },
    frame_ledger: { start: 'Challenger', mid: 'Clerk', end: 'Petitioner', explain: 'Strong open, then surrendered logistics → status transfer.' },
    error_chain: { arc: 'Defense → Admin → Power transfer', explain: 'Defending proves doubt; admin kills spark; power shifts.' },
    fixes: [
      { situation: 'Tests', rewrite: 'Good. I prefer trouble undefeated.', explain: 'No defense; more tension.' },
      { situation: 'Logistics', rewrite: 'Speakeasy tomorrow. One seat left.', explain: 'Scarcity + hosting flips frame.' }
    ],
    recovery: ['Silence 2–3 days','Return with hosted plan','Binary close'],
    principle: 'Begin Challenger, end Victor.',
    hidden_agenda: null,
    boundary_script: 'I like playful, not indecision. I’m grabbing a drink Thu. If you’re in, say “approved.”'
  };
}

/* helpers */
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
  if (lc.includes('defend') || lc.includes('test')) return { label: 'Test → Defense (frame loss)', confidence: 90 };
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
function deriveMetricsFromText() { return { red_flag: 60, certainty: 85, viral_potential: 70 }; }
function oneLine(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
function joinSentences(parts) { return (parts||[]).map(p => String(p||'').trim()).filter(Boolean).join(' '); }

module.exports = {
  analyzeWithAI,
  getMentorResponse
};
