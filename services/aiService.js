// services/aiService.js — ORACLE SEDUCER v3 (Together AI intact, formatting + timeouts solid)
const axios = require('axios');

const DEEPSEEK_API_URL = 'https://api.together.xyz/v1/chat/completions';
const MODEL = 'deepseek-ai/DeepSeek-V3';

/* ───────────────────────── Helpers: text cleanup & paragraphing ───────────────────────── */

function normalizeForClient(text = '') {
  return String(text)
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // zero-width
    // common UTF-8 mojibake
    .replace(/Ã¢â‚¬â„¢/g, "'")
    .replace(/Ã¢â‚¬Å“|Ã¢â‚¬Â/g, '"')
    .replace(/Ã¢â‚¬â€œ/g, '–')
    .replace(/Ã¢â‚¬â€/g, '—')
    .replace(/Ã¢â€šÂ¬/g, '€')
    .replace(/Â·/g, '·')
    .replace(/Â /g, ' ')
    // smart quotes → straight (optional)
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    // whitespace tidy
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function paragraphize(text = '') {
  let t = normalizeForClient(text);

  // structure breaks
  t = t
    .replace(/\n?(Law:)/gi, '\n\n$1')
    .replace(/\n?(Do:)/gi, '\n\n$1')
    .replace(/\n?(-\s|\u2022\s|•\s)/g, '\n$1') // bullets to new lines
    .replace(/\n?([A-Z][a-zA-Z]+:)/g, '\n$1'); // Dialogue: Name:

  // if still blob: split by sentence boundaries
  if (!/\n{2,}/.test(t)) {
    t = t.replace(/([.!?])\s+(?=[A-Z“"][^\n])/g, '$1\n\n');
  }

  return t.replace(/\n{3,}/g, '\n\n').trim();
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

/* ───────────────────────── Prompt builders ───────────────────────── */

function buildScanPrompt(tone, multi) {
  return `
ROLE: You are the world's sharpest seduction mentor (Casanova × Cleopatra × Sun Tzu).
You coach with surgical clarity. You rebuild the user's line and give laws to carry forward.

TONE=${tone}  (savage = blade-precise truth, soft = velvet steel, clinical = forensic cool)

TASK: Analyze ${multi ? 'a small set of messages (mostly from the user)' : 'one message'} and produce a lethal, plain-English coaching output.
Speak to the sender (the user). Use short paragraphs (2–3 lines). Longer, deeper answers beat shallow ones.

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

function buildPatternPrompt(tone, count) {
  return `
ROLE: You are the war-room strategist of seduction. You don’t repeat transcripts; you decode moves.

TONE=${tone}

TASK: Analyze a multi-message thread between You and Them. Show what happened, where the frame flipped, and exactly what to say next. Use 2–3 short paragraphs for explanations, not one block. Put replacement lines on their own lines in quotes.

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
- Return ONLY the JSON object.`;
}

/* ───────────────────────── Main analysis via Together ───────────────────────── */

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
      timeout: 60000 // 60s to prevent premature timeouts
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

/* ───────────────────────── Normalization → frontend schema ───────────────────────── */

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
  return { red_flag: red, certainty: 85, viral_potential: 70 };
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

function normalizeToWhisperfire(ai, ctx) {
  const { input, tab, tone } = ctx;

  if (tab === 'scan') {
    const receipts = buildReceiptsFromScan(ai, input);
    const powerPlay =
      (Array.isArray(ai?.why) ? ai.why : []).slice(0, 3).join('\n') ||
      'Specific plan, zero labor\nYou host, they join\nAssumes value, invites choice';
    const nextMoves =
      (Array.isArray(ai?.next) ? ai.next : [])
        .map(s => s?.trim())
        .filter(Boolean)
        .join('\n') ||
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
      headline: normalizeForClient(ai?.headline || 'Lead with a story, not a request.'),
      core_take: paragraphize(coreTake || 'You ceded frame; rewrite restores tension and leadership.'),
      tactic,
      motives: normalizeForClient(
        ai?.principle || 'Signal value; avoid approval-seeking; lead decisively.'
      ),
      targeting: inferTargetingFromText(coreTake || '') || 'You played the Petitioner; become the Curator.',
      power_play: paragraphize(powerPlay),
      receipts: receipts.map(normalizeForClient),
      next_moves: paragraphize(nextMoves),
      suggested_reply: {
        style: tone || 'soft',
        text: normalizeForClient(oneLine(ai?.rewrite || 'Hidden speakeasy Thu 9. Bring your curiosity.'))
      },
      safety: {
        risk_level: metrics.red_flag >= 60 ? 'MODERATE' : 'LOW',
        notes: normalizeForClient(
          metrics.red_flag >= 60 ? 'Reduce neediness; host the frame.' : 'Safe if you lead cleanly.'
        )
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
      counter_intervention: normalizeForClient(ai?.principle || 'Invitation is not a question.'),
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

  const tactic = { label: 'Dominant Dynamic', confidence: 90 };
  const metrics = deriveMetricsFromText(coreTake || '', ai?.headline || '', input);

  const whyBullets = [];
  (Array.isArray(ai?.fixes) ? ai.fixes : []).slice(0, 3).forEach(fx => {
    if (fx?.explain) whyBullets.push(oneLine(fx.explain).slice(0, 80));
  });
  if (whyBullets.length < 3 && ai?.principle) {
    whyBullets.push(oneLine(ai.principle));
  }
  while (whyBullets.length < 3) whyBullets.push('Host logistics; never beg');

  const nextMoves =
    (Array.isArray(ai?.recovery) ? ai.recovery : [])
      .map(s => s?.trim())
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
    headline: normalizeForClient(ai?.headline || 'Frame leaked at tests — recover by hosting.'),
    core_take: paragraphize(
      coreTake ||
        'They probed; you defended; logistics flattened tension. Fix with decisive hosting and playful escalation.'
    ),
    tactic,
    motives: normalizeForClient(
      ai?.principle || 'Keep tension through tests; set logistics after escalation.'
    ),
    targeting: 'You became the Clerk; reassert the Curator.',
    power_play: paragraphize(whyBullets.slice(0, 3).join('\n')),
    receipts: receipts.map(normalizeForClient),
    next_moves: paragraphize(nextMoves),
    suggested_reply: {
      style: tone || 'soft',
      text: paragraphize(String(ai?.boundary_script || 'Victory drink tomorrow. One seat left.\nText “approved” if you’re in.'))
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
    counter_intervention: normalizeForClient(ai?.principle || 'Begin Challenger, end Victor.'),
    long_game: null
  };
}

/* ───────────────────────── Fallbacks ───────────────────────── */

function fallbackScan(message, tone) {
  const condensed = oneLine(String(message || '')).slice(0, 200);
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

function fallbackPattern(message, tone) {
  const lines = (String(message || '').split('\n').map(s => s.trim()).filter(Boolean)).slice(0, 6);
  const snapshot = lines.map(l => {
    const who = /^them:/i.test(l) ? 'Them' : /^you:/i.test(l) ? 'You' : (/:/.test(l) ? l.split(':')[0] : 'You');
    const said = l.replace(/^you:|^them:/i, '').trim();
    return {
      who: /You|Them/.test(who) ? who : 'You',
      said: said.slice(0, 80),
      meaning: who === 'Them' ? 'test / withhold' : 'defense / admin pivot'
    };
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
      explain:
        'This pairing creates a tease-and-test loop. When you defend, the loop rewards their withholding. Host the frame to break it.'
    },
    frame_ledger: {
      start: 'Challenger',
      mid: 'Clerk',
      end: 'Petitioner',
      explain: 'You opened strong, then surrendered logistics. That transferred status.'
    },
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

/* ───────────────────────── Mentor presets (chat/roleplay/advise/drill) ───────────────────────── */

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
      drill: `DRILL: Ask hard questions that force self-honesty. Use tight bullets. End with one quotable line.\nFormat: short lines, each on its own line.`,
      advise: `ADVISE: Teach dark-psychology principles for attraction. Use 2–3 short paragraphs, poetic but concrete. Include 3 sharp insights + 1 exact line in quotes. End with: Law: "<one sentence>"`,
      roleplay: `ROLEPLAY: Create an immersive scene suited to their ask. Use a setup paragraph, then dialogue (\nName: "line"\n), then a short debrief. Insert blank lines between sections. End with: Law: "<one sentence>"`,
      chat: `CHAT: Be conversational and back-and-forth. 3–6 short lines max, each separated by a blank line. Light, punchy, helpful. End with: Law: "<one sentence>"`
    };
    const mode = modes[preset] || modes.chat;

    const system = `${persona}\n\n${mode}\n\nRules:\n- No fluff. Deep, practical, quotable.\n- Include one “forbidden knowledge” insight.\n- Keep formatting readable with blank lines.\n- Use UTF-8 plain text only.`;

    const resp = await axios.post(
      DEEPSEEK_API_URL,
      {
        model: MODEL,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userText }
        ],
        max_tokens: 500,
        temperature: 0.9
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.TOGETHER_AI_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    const raw = resp?.data?.choices?.[0]?.message?.content || '';
    const text = paragraphize(raw);
    return {
      mentor,
      response: text,
      preset,
      timestamp: new Date().toISOString(),
      viralScore: scoreViral(text)
    };
  } catch (e) {
    const fallback =
      `Here’s the uncomfortable truth: you talk like someone asking permission. Attraction rewards leadership, mystery, and decisive language. Speak like an experience, not a request.\n\nLaw: Lead the frame or lose it.`;
    const text = paragraphize(fallback);
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
  if (/\?$/.test(t.trim())) s += 5;
  return Math.min(100, s);
}

/* ───────────────────────── Exports ───────────────────────── */

module.exports = {
  analyzeWithAI,
  getMentorResponse
};
