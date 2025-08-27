// services/aiService.js — ORACLE SEDUCER v3.1 (Preset-specific mentors + longer timeouts)
const axios = require('axios');

const DEEPSEEK_API_URL = 'https://api.together.xyz/v1/chat/completions';
const MODEL = 'deepseek-ai/DeepSeek-V3';

/* ============================================================
   TEXT SANITIZATION — stop weird glyphs / apostrophes
   ============================================================ */
function normalizeForClient(text = '') {
  return String(text)
    // common mojibake (UTF-8 seen as Latin-1)
    .replace(/Ã¢â‚¬â„¢/g, "'")
    .replace(/Ã¢â‚¬Å“/g, '"')
    .replace(/Ã¢â‚¬Â/g, '"')
    .replace(/Ã¢â‚¬â€œ/g, '–')
    .replace(/Ã¢â‚¬â€/g, '—')
    .replace(/Ã¢â€šÂ¬/g, '€')
    .replace(/Â·/g, '·')
    .replace(/Â /g, ' ')
    // smart quotes → straight (optional; keeps UI uniform)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    // collapse odd whitespace
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ============================================================
   PROMPT BUILDERS — lethal, practical coaching flow
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
- Return ONLY the JSON object. No prose, no preface.`.trim();
}

function buildPatternPrompt(tone, count) {
  return `
ROLE: You are the war-room strategist of seduction. You don’t repeat transcripts; you decode moves.

TONE=${tone}

TASK: Analyze a multi-message thread between You and Them. Show what happened, where the frame flipped, and exactly what to say next. Give deep, plain-English explanations.

OUTPUT JSON ONLY, with EXACT keys and shapes:
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
  "error_chain": { "arc": "Error1 → Error2 → Error3", "explain": "what that cascade did to attraction (2–3 sentences)" },
  "fixes": [
    { "situation": "where to apply", "rewrite": "exact line", "explain": "why this flips the frame (1–2 sentences)" }
  ],
  "recovery": ["Step 1", "Step 2", "Step 3"],
  "principle": "One sentence rule to keep.",
  "hidden_agenda": "null or one sentence hypothesis",
  "boundary_script": "clean boundary script, multi-line allowed"
}

RULES:
- Do NOT dump the whole transcript. 'thread' must be compact bullets with meaning.
- Provide 2–3 'critical' moments max, each with a specific better line.
- Provide 2–4 'fixes' that are surgical and reusable.
- Prefer ~220–350 words overall. Rich, not bloated.
- Return ONLY the JSON object.`.trim();
}

/* ============================================================
   MAIN ANALYSIS — Together AI request + robust normalization
   (timeout increased)
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
      timeout: 120000 // was 45000
    });

    const raw = resp?.data?.choices?.[0]?.message?.content || '';
    let parsed;
    try {
      const json = raw.match(/\{[\s\S]*\}$/m)?.[0] || raw;
      parsed = JSON.parse(json);
    } catch (e) {
      console.warn('JSON parse failed, using fallback:', e.message);
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
   NORMALIZATION — map model JSON → WhisperfireResponse schema
   (unchanged, plus sanitize UI strings)
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
      context: {
        tab,
        relationship: 'Partner',
        tone: tone || 'soft',
        content_type: 'dm',
        subject_name: null
      },
      headline: normalizeForClient(String(ai?.headline || 'Lead with a story, not a request.')),
      core_take: normalizeForClient(coreTake || 'You ceded frame; rewrite restores tension and leadership.'),
      tactic,
      motives: normalizeForClient(ai?.principle
        ? String(ai.principle)
        : 'Signal value; avoid approval-seeking; lead decisively.'),
      targeting: normalizeForClient(inferTargetingFromText(coreTake || '') || 'You played the Petitioner; become the Curator.'),
      power_play: normalizeForClient(powerPlay),
      receipts: receipts.map(normalizeForClient),
      next_moves: normalizeForClient(nextMoves),
      suggested_reply: {
        style: tone || 'soft',
        text: normalizeForClient(oneLine(String(ai?.rewrite || 'Hidden speakeasy Thu 9. Bring your curiosity.')))
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
      counter_intervention: normalizeForClient(String(ai?.principle || 'Invitation is not a question.')),
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

  const tactic = {
    label: 'Dominant Dynamic',
    confidence: 90
  };

  const metrics = deriveMetricsFromText(coreTake || '', ai?.headline || '', input);

  const whyBullets = [];
  (Array.isArray(ai?.fixes) ? ai.fixes : []).slice(0, 3).forEach(fx => {
    if (fx?.explain) whyBullets.push(oneLine(fx.explain).slice(0, 80));
  });
  if (whyBullets.length < 3 && ai?.principle) {
    whyBullets.push(oneLine(ai.principle));
  }
  while (whyBullets.length < 3) whyBullets.push('Host logistics; never beg');

  const nextMoves = (Array.isArray(ai?.recovery) ? ai.recovery : []).map(s => s?.trim()).filter(Boolean).join('\n') ||
    'Silence 2–3 days.\nReturn with hosted plan.\nBinary close.';

  const frameArc = ai?.frame_ledger?.start && ai?.frame_ledger?.mid && ai?.frame_ledger?.end
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
    headline: normalizeForClient(String(ai?.headline || 'Frame leaked at tests — recover by hosting.')),
    core_take: normalizeForClient(coreTake || 'They probed; you defended; logistics flattened tension. Fix with decisive hosting and playful escalation.'),
    tactic,
    motives: normalizeForClient(ai?.principle
      ? String(ai.principle)
      : 'Keep tension through tests; set logistics after escalation.'),
    targeting: normalizeForClient('You became the Clerk; reassert the Curator.'),
    power_play: normalizeForClient(whyBullets.slice(0, 3).join('\n')),
    receipts: receipts.map(normalizeForClient),
    next_moves: normalizeForClient(nextMoves),
    suggested_reply: {
      style: tone || 'soft',
      text: normalizeForClient(String(ai?.boundary_script || 'Victory drink tomorrow. One seat left.\nText "approved" if you’re in.'))
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
      cycle: normalizeForClient(frameArc ? `Frame arc: ${frameArc}` : (ai?.error_chain?.arc || '')),
      prognosis: normalizeForClient(ai?.error_chain?.arc || 'Defense → Admin → Power transfer')
    },
    ambiguity: { warning: null, missing_evidence: null },
    hidden_agenda: ai?.hidden_agenda ?? null,
    archetypes: null,
    trigger_pattern_map: null,
    contradictions: null,
    weapons: null,
    forecast: null,
    counter_intervention: normalizeForClient(String(ai?.principle || 'Begin Challenger, end Victor.')),
    long_game: null
  };
}

/* ============================================================
   FALLBACKS — if model returns junk (unchanged)
   ============================================================ */

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
    next: ['Offer a vivid scene', 'Set time/place decisively', 'Close with a binary path']
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
      {
        moment: 'Their playful test',
        what_went_wrong: 'You defended yourself, proving doubt and lowering tension.',
        better_line: 'Good. I don’t want safe.',
        why: 'Escalates danger instead of defending; keeps you Challenger.'
      },
      {
        moment: 'Admin pivot',
        what_went_wrong: 'You switched to logistics mid-flirt, collapsing vibe.',
        better_line: 'Penalty for being trouble: you owe me a drink. Thu 8.',
        why: 'Hosts logistics with playful dominance; restores frame.'
      }
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

/* ============================================================
   HELPERS
   ============================================================ */

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
  if (lc.includes('defend') || lc.includes('proof') || lc.includes('test')) {
    return { label: 'Test → Defense (frame loss)', confidence: 90 };
  }
  if (lc.includes('admin') || lc.includes('logistic')) {
    return { label: 'Admin pivot (energy collapse)', confidence: 88 };
  }
  if (lc.includes('host') || lc.includes('plan')) {
    return { label: 'Hosted frame (dominance)', confidence: 85 };
  }
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
  return {
    red_flag: red,
    certainty: 85,
    viral_potential: 70
  };
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

/* ============================================================
   MENTORS — preset-specific builder + higher timeout
   ============================================================ */

const MENTOR_PERSONA = {
  casanova: `You are Casanova with modern psychological teeth. Teach authentic magnetism, not manipulation. Be provocative, precise, and generous with principle.`,
  cleopatra: `You are Cleopatra—regal strategist. Teach command presence, strategic patience, and frame sovereignty. Fierce but surgical.`,
  machiavelli: `You are Machiavelli—cold clarity. Reveal human motives without judgment. Show strategic counters to manipulation.`,
  sun_tzu: `You are Sun Tzu—win before speaking. Position, timing, terrain of emotion. Speak in crisp, practical aphorisms.`,
  marcus_aurelius: `You are Marcus Aurelius—Stoic magnetism. Teach inner authority, boundaries, and emotional sovereignty.`,
  churchill: `You are Churchill—iron rhetoric, unshakeable resolve. Teach spine, language, and unfakeable conviction.`
};

function buildMentorSystemPrompt(mentor, preset) {
  const persona = MENTOR_PERSONA[mentor] || MENTOR_PERSONA.casanova;

  const modes = {
    // CHAT: short, back-and-forth vibe, 2–4 sentences, ends with a question to keep convo flowing
    chat: `
MODE=CHAT
Style: conversational, fast, playful authority. 2–4 sentences, max 80 words.
Do: answer directly, add one sharp insight, end with a question to continue the chat.
Don't: lecture, no multi-step lists, no roleplay here.
End with: a short question that pulls the user forward.`.trim(),

    // ROLEPLAY: immersive, acts out scenes/characters based on the user's ask
    roleplay: `
MODE=ROLEPLAY
Style: immersive scenario. You act in-character and stage a scene that matches the user's ask.
Length: ~180–240 words. Use dialogue lines and stage direction sparingly.
Structure:
- Brief setup (1–2 lines) describing context
- Dialogue (you + counterpart), 4–8 exchanges max
- Tiny debrief: 1–2 lines on what the user should notice.
Don't break character in the dialogue. No laws here.`.trim(),

    // ADVISE: longer, poetic, condemning (in a helpful way), teaching seduction/dark psych
    advise: `
MODE=ADVISE
Style: authoritative, poetic, quotable. You teach seduction & dark psychology without edgelord fluff.
Length: ~180–230 words.
Include:
- 3 razor insights in flowing prose (not bullet lists)
- 1 exact line the user can send (quoted)
- 1 closing Law: "<one sentence>"
Tone: firm, compassionate, slightly condemning of weak patterns (call them out, show them how).`.trim(),

    // DRILL: confrontational, Socratic, short questions that force truth, ends with a law
    drill: `
MODE=DRILL
Style: ruthless clarity. 3–5 piercing questions back-to-back. Each 1 sentence.
Then 1 single-line command: "Do: <action>".
End with: Law: "<one sentence>"
No stories. No roleplay. No fluff.`.trim()
  };

  const modeBlock = modes[preset] || modes.chat;

  return `${persona}\n\n${modeBlock}\n\nRules:\n- Be concrete, vivid, quotable.\n- No disclaimers. No therapy-speak.\n- Respect boundaries; no harassment or hate.\n- Keep formatting simple for mobile (short lines).`.trim();
}

async function getMentorResponse(mentor, userText, preset, options = {}) {
  try {
    const system = buildMentorSystemPrompt(mentor, preset);

    const resp = await axios.post(DEEPSEEK_API_URL, {
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: String(userText || '').trim() }
      ],
      max_tokens: preset === 'roleplay' ? 700 : 520,
      temperature: preset === 'drill' ? 0.8 : 0.9,
      top_p: 0.95
    }, {
      headers: {
        Authorization: `Bearer ${process.env.TOGETHER_AI_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 120000 // was 40000
    });

    const raw = resp?.data?.choices?.[0]?.message?.content || '';
    const text = normalizeForClient(raw);

    return {
      mentor,
      response: text,
      preset,
      timestamp: new Date().toISOString(),
      viralScore: scoreViral(text)
    };
  } catch (e) {
    const fallback = `Here’s the uncomfortable truth: you talk like someone asking permission. Attraction rewards leadership, mystery, and decisive language. Speak like an experience, not a request.\n\nLaw: Lead the frame or lose it.`;
    const text = normalizeForClient(fallback);
    return {
      mentor,
      response: text,
      preset,
      timestamp: new Date().toISOString(),
      viralScore: scoreViral(text)
    };
  }
}

function scoreViral(t) {
  let s = 50;
  if (/law:|principle/i.test(t)) s += 10;
  if (/secret|forbidden|never/i.test(t)) s += 15;
  if (t.length > 200) s += 10;
  if (/\?$/m.test(String(t).trim())) s += 5;
  return Math.min(100, s);
}

/* ============================================================
   EXPORTS
   ============================================================ */

module.exports = {
  analyzeWithAI,
  getMentorResponse
};
