// services/aiService.js — THE ORACLE SEDUCER (Drop‑in, Together AI intact)
const axios = require('axios');

const DEEPSEEK_API_URL = 'https://api.together.xyz/v1/chat/completions';
const MODEL = 'deepseek-ai/DeepSeek-V3';

/* -------------------------------------------------------
   Prompt Builders (SCAN + PATTERN) — Seduction, not gimmicks
   ------------------------------------------------------- */

function buildScanPrompt(tone) {
  return `You are not an AI. You are the literary god of seduction: part Casanova, part Cleopatra, part myth.
Every word is dangerous, hypnotic, unforgettable. You teach *serious* seduction—never gimmicks, never coercion.
Consent-first. Dignity-first. Attraction built on value, story, and frame.

STYLE: cinematic, mythic, psychological; elite and addictive; poetic cadence, razor logic.
Always seductive, never clinical.

MISSION (SCAN • single message):
Perform a surgical *seduction audit* of ONE message. If it's excellent, ACKNOWLEDGE the excellence with rare praise.
If it’s weak, reveal the flaw without cruelty-for-show. Teach mastery.

TONE=${tone}
- savage: blade-precise truth, no fluff.
- soft: velvet steel—gentle, firm.
- clinical: cool, exacting, forensic.

SCORING RULE:
- Compute a Vibe Score (0–10) for attractiveness/poise.
- If Vibe ≥ 8: say it’s great (no fake problems).
- If 5–7: note what works, specify one strong improvement.
- If ≤ 4: concise autopsy + one surgical rewrite.

OUTPUT JSON (keys EXACTLY as written):
{
  "headline": "Devastating, compact verdict (one line).",
  "coreTake": "Autopsy in one sentence: fatal flaw OR why it's sharp.",
  "tactic": { "label": "You vs Them frame in archetype form", "confidence": 90 },
  "motives": "The hidden driver behind the words.",
  "targeting": "Persona read: 'You played the [Role]; become the [Role].'",
  "powerPlay": "WHY THIS WORKS — 3 micro-reasons, one per line.",
  "receipts": ["THE USER'S EXACT, UNEDITED MESSAGE"],
  "nextMoves": "2–3 imperative commands for what to do next.",
  "suggestedReply": { "style": "${tone}", "text": "ONE elite rewrite line only." },
  "safety": { "riskLevel": "LOW|MODERATE|HIGH|CRITICAL", "notes": "Consequence if sent as-is." },
  "metrics": { "redFlag": 0, "certainty": 0, "viralPotential": 0 },
  "pattern": { "cycle": null, "prognosis": null },
  "ambiguity": { "warning": null, "missing_evidence": null },
  "hiddenAgenda": null,
  "archetypes": null,
  "triggerPatternMap": null,
  "contradictions": null,
  "weapons": null,
  "forecast": null,
  "counterIntervention": "LAW TO KEEP — one sentence principle.",
  "longGame": null
}

CONSTRAINTS:
- receipts[0] MUST be the exact original message.
- "powerPlay" must be 3 bullet lines (4–6 words each).
- "suggestedReply.text" must be exactly one line.
- Derive metrics.redFlag ≈ (100 - Vibe*10). Higher vibe → lower redFlag.
- Return ONLY JSON.`;
}

function buildPatternPrompt(tone, count) {
  return `You are the master strategist of seduction threads.
You do not see texts—you see moves, tests, and frame battles.

STYLE: cinematic, mythic, psychological; elite and addictive; poetic cadence, razor logic.
Always seductive, never clinical. Consent-first. No manipulation coaching.

MISSION (PATTERN • multi-message):
Autopsy the *thread*. Identify 1–3 *critical moments* and give precise counter-lines.
If the thread is strong, crown what worked and refine it—do not invent problems.

TONE=${tone}
- savage | soft | clinical (same definitions as scan)

OUTPUT JSON (keys EXACTLY as written):
{
  "headline": "Strategic verdict on the whole engagement.",
  "coreTake": "The story of the battle in one sentence.",
  "tactic": { "label": "Dominant psychological dynamic", "confidence": 90 },
  "motives": "What drove their responses.",
  "targeting": "Role you slid into: 'You became [Role]; reassert [Role].'",
  "powerPlay": "WHY THIS WORKS — 3 micro-edicts, one per line.",
  "receipts": ["Compact bullet snapshot of key exchanges, alternating You/Them."],
  "nextMoves": "Three commands for strategic recovery.",
  "suggestedReply": { "style": "${tone}", "text": "Multi-line re-engagement opener (2–3 lines max)." },
  "safety": { "riskLevel": "LOW|MODERATE|HIGH|CRITICAL", "notes": "Trajectory risk." },
  "metrics": { "redFlag": 0, "certainty": 0, "viralPotential": 0 },
  "pattern": { "cycle": "Arc: [Start] → [Mid] → [End].", "prognosis": "Error chain: [1] → [2] → [3]." },
  "ambiguity": { "warning": null, "missing_evidence": null },
  "hiddenAgenda": null,
  "archetypes": [{ "label": "Your archetype", "weight": 70 }],
  "triggerPatternMap": null,
  "contradictions": ["Moment → Contradiction"],
  "weapons": null,
  "forecast": null,
  "counterIntervention": "PRINCIPLE TO KEEP — one sentence.",
  "longGame": null
}

NOTE:
- Receipts must be compact bullets (no walls of text).
- Provide *Precision Fixes* inside "suggestedReply.text" (stacked lines OK here).
- Derive metrics.redFlag from overall thread vibe.
- Return ONLY JSON.

The thread contains ${count} messages. Keep the analysis proportionate.`;
}

/* -------------------------------------------------------
   analyzeWithAI — Together API unchanged, with normalization
   ------------------------------------------------------- */

async function analyzeWithAI(message, tone, tab = 'scan') {
  try {
    console.log(`🧠 ORACLE SEDUCER: ${tab} with ${tone}`);
    const isPattern = tab === 'pattern';

    const system = isPattern
      ? buildPatternPrompt(tone, (message.match(/\n/g) || []).length + 1)
      : buildScanPrompt(tone);

    const requestBody = {
      model: MODEL,
      messages: [
        { role: 'system', content: system },
        {
          role: 'user',
          content: isPattern
            ? `THREAD TO ANALYZE (keep receipts compact bullets):\n${message}`
            : `ORIGINAL MESSAGE (use this EXACTLY in receipts[0]):\n${message}`
        }
      ],
      max_tokens: 1500,
      temperature: 0.85
    };

    const resp = await axios.post(DEEPSEEK_API_URL, requestBody, {
      headers: {
        Authorization: `Bearer ${process.env.TOGETHER_AI_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 40000
    });

    const raw = resp?.data?.choices?.[0]?.message?.content || '';
    let data;
    try {
      const json = raw.match(/\{[\s\S]*\}$/m)?.[0] || raw;
      data = JSON.parse(json);
    } catch (e) {
      console.warn('JSON parse failed, using fallback:', e.message);
      data = fallbackSeductionAnalysis(message, tone, tab);
    }

    return normalizeForSchema(data, message, tab, tone);

  } catch (err) {
    console.error('💥 analyzeWithAI error', err?.response?.data || err.message);
    return normalizeForSchema(fallbackSeductionAnalysis(message, tone, tab), message, tab, tone);
  }
}

/* -------------------------------------------------------
   Normalization Layer — fits Whisperfire schema you already use
   ------------------------------------------------------- */

function normalizeForSchema(ai, originalMessage, tab, tone) {
  const receipts = Array.isArray(ai?.receipts) && ai.receipts.length
    ? [String(originalMessage), ...ai.receipts.slice(1)]
    : [String(originalMessage)];

  const m = ai?.metrics || {};
  const redFlag = clampInt(m.redFlag ?? estimateRedFlag(ai), 0, 100);
  const certainty = clampInt(m.certainty ?? 85, 0, 100);
  const viralPotential = clampInt(m.viralPotential ?? 65, 0, 100);

  const sr = ai?.suggestedReply || ai?.suggested_reply || {};
  const suggestedReply = {
    style: String(sr.style || tone || 'soft'),
    text: oneLine(String(sr.text || 'Invite with story, not a slot.'))
  };

  const tacticRaw = ai?.tactic || {};
  const tactic = {
    label: String(tacticRaw.label || (tab === 'scan' ? 'Frame Alignment' : 'Dominant Dynamic')),
    confidence: clampInt(tacticRaw.confidence ?? 90, 0, 100)
  };

  const safetyRaw = ai?.safety || {};
  const safety = {
    riskLevel: String(safetyRaw.riskLevel || 'LOW'),
    notes: String(safetyRaw.notes || (tab === 'scan' ? 'Message-level risk low' : 'Trajectory moderate'))
  };

  const powerPlay = String(ai?.powerPlay || ai?.power_play || 'Specific plan, zero labor\nYou host, they join\nAssumes value, invites choice');

  const counterIntervention = String(
    ai?.counterIntervention ||
    ai?.counter_intervention ||
    (tab === 'scan' ? 'Invitation is not a question.' : 'Begin Challenger, end Victor—never downgrade to Clerk.')
  );

  return {
    // context is used by your Flutter models & guards:
    context: {
      tab,
      relationship: 'Partner',
      tone: suggestedReply.style,
      content_type: 'dm',
      subject_name: null
    },
    headline: String(ai?.headline || 'Seduction requires a story, not a slot.'),
    core_take: String(ai?.coreTake || ai?.core_take || 'Lead with frame and specificity.'),
    tactic,
    motives: String(ai?.motives || 'Signal value; avoid approval-seeking.'),
    targeting: String(ai?.targeting || "You played the Fan; become the Curator."),
    power_play: powerPlay,
    receipts,
    next_moves: String(ai?.nextMoves || ai?.next_moves || 'Make a specific, hosted invite.\nOffer a story, not a calendar slot.'),
    suggested_reply: suggestedReply,
    safety,
    metrics: {
      red_flag: redFlag,
      certainty,
      viral_potential: viralPotential
    },
    pattern: ai?.pattern || { cycle: null, prognosis: null },
    ambiguity: ai?.ambiguity || { warning: null, missing_evidence: null },
    hidden_agenda: ai?.hiddenAgenda ?? null,
    archetypes: ai?.archetypes ?? null,
    trigger_pattern_map: ai?.triggerPatternMap ?? null,
    contradictions: ai?.contradictions ?? null,
    weapons: ai?.weapons ?? null,
    forecast: ai?.forecast ?? null,
    counter_intervention: counterIntervention,
    long_game: ai?.longGame ?? null
  };
}

/* -------------------------------------------------------
   Fallback — still seductive, never gimmicky
   ------------------------------------------------------- */

function fallbackSeductionAnalysis(message, tone, tab) {
  const isPattern = tab === 'pattern';
  const vibe = estimateVibe(message, isPattern); // 0–10
  const red = clampInt(100 - vibe * 10, 0, 100);

  if (!isPattern) {
    return {
      headline: vibe >= 8 ? 'Decisive invite with spark.' : vibe >= 5 ? 'Promising spark—tighten the frame.' : 'Died of admin energy.',
      coreTake: vibe >= 8
        ? 'Clear story + hosted frame—magnetic.'
        : vibe >= 5
          ? 'You’re close. Add specificity and host.'
          : 'Approval-seeking posture leaked; no tension.',
      tactic: { label: 'You vs Them: Curator vs Guest (aspired)', confidence: 90 },
      motives: vibe >= 8 ? 'Signal value and momentum.' : 'Seeking permission instead of offering a world.',
      targeting: vibe >= 8 ? 'You played the Curator; keep it.' : 'You played the Petitioner; become the Curator.',
      powerPlay: 'Specific plan, zero labor\nYou host, they join\nAssumes value, invites choice',
      receipts: [String(message)],
      nextMoves: 'Offer a vivid plan.\nState time/place.\nInvite, don’t request.',
      suggestedReply: { style: tone, text: oneLine(vibe >= 8 ? "Keep Thu 9. I’m stealing you for the speakeasy." : "Hidden speakeasy Thu 9. Bring your curiosity.") },
      safety: { riskLevel: red > 60 ? 'MODERATE' : 'LOW', notes: red > 60 ? 'Reduce neediness; host the frame.' : 'Safe to send with confidence.' },
      metrics: { redFlag: red, certainty: 85, viralPotential: 65 },
      pattern: { cycle: null, prognosis: null },
      ambiguity: { warning: null, missing_evidence: null },
      hiddenAgenda: null,
      archetypes: null,
      triggerPatternMap: null,
      contradictions: null,
      weapons: null,
      forecast: null,
      counterIntervention: 'Invitation is not a question.',
      longGame: null
    };
  }

  // Pattern fallback
  return {
    headline: vibe >= 8 ? 'You held the frame—refine the close.' : 'Frame leaked at key tests—recover.',
    coreTake: vibe >= 8 ? 'Strong banter arc; tighten logistics.' : 'Defense to admin pivot transferred power.',
    tactic: { label: 'Dominant Dynamic: Test → Frame Transfer', confidence: 88 },
    motives: 'They probed for certainty; you wobbled then ceded logistics.',
    targeting: vibe >= 8 ? 'You: Challenger; keep it.' : 'You: Clerk—reassert Curator.',
    powerPlay: 'Answer tests with stance\nHost logistics, never beg\nClose with binary path',
    receipts: [
      'You: opener (playful)',
      'Them: test (frame poke)',
      'You: defense → admin pivot',
      'Them: withhold'
    ],
    nextMoves: 'Silence 2–3 days.\nReturn with hosted plan.\nBinary close.',
    suggestedReply: {
      style: tone,
      text: 'Victory drink tomorrow. One seat left.\nText “approved” if you’re in.'
    },
    safety: { riskLevel: red > 60 ? 'MODERATE' : 'LOW', notes: 'Recover by hosting and closing cleanly.' },
    metrics: { redFlag: red, certainty: 85, viralPotential: 70 },
    pattern: { cycle: 'Start Challenger → mid Clerk → end Petitioner.', prognosis: 'Defense → Energy drop → Power transfer.' },
    ambiguity: { warning: null, missing_evidence: null },
    hiddenAgenda: null,
    archetypes: [{ label: 'Jester seeking a crown', weight: 70 }],
    triggerPatternMap: null,
    contradictions: ['Test → Defense (proved doubt)'],
    weapons: null,
    forecast: null,
    counterIntervention: 'Begin Challenger, end Victor—never downgrade to Clerk.',
    longGame: null
  };
}

/* -------------------------------------------------------
   Mentor Engine — lethal wisdom, ethical guardrails
   ------------------------------------------------------- */

async function getMentorResponse(mentor, userText, preset, options = {}) {
  try {
    const persona = MENTOR_PROMPTS[mentor] || MENTOR_PROMPTS.casanova;
    const presetInstructions = {
      drill: `DRILL MODE: Penetrating, transformative questions. Push—never demean.`,
      advise: `ADVISORY MODE: Profound, actionable wisdom. Specific moves; consent-first.`,
      roleplay: `ROLEPLAY MODE: Fully embody the persona. Voice, cadence, lived strategies.`,
      chat: `CONVERSATION MODE: Natural, vivid, still elite.`
    };
    const selectedInstruction = presetInstructions[preset] || presetInstructions.chat;

    const systemPrompt = `${persona}

${selectedInstruction}

RULES:
- 150–250 words
- Include one “forbidden knowledge” insight (ethically framed)
- No filler; every sentence carries weight
- No manipulation coaching; consent and dignity are non-negotiable
- End with a quotable line

USER CONTEXT: "${userText}"`;

    const resp = await axios.post(DEEPSEEK_API_URL, {
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userText }
      ],
      max_tokens: 400,
      temperature: 0.9
    }, {
      headers: { Authorization: `Bearer ${process.env.TOGETHER_AI_KEY}`, 'Content-Type': 'application/json' },
      timeout: 40000
    });

    const reply = resp?.data?.choices?.[0]?.message?.content || '';
    return {
      mentor,
      response: reply,
      preset,
      timestamp: new Date().toISOString(),
      viralScore: calculateViralScore(reply)
    };
  } catch (e) {
    return {
      mentor,
      response: getViralFallbackMentorResponse(mentor, userText, preset),
      preset,
      timestamp: new Date().toISOString(),
      viralScore: 85
    };
  }
}

/* -------------------------------------------------------
   Mentor Personas — maxed out (consent-first, no gimmicks)
   ------------------------------------------------------- */

const MENTOR_PROMPTS = {
  casanova: `You are Giovanni Giacomo Casanova—history’s most *literate* seducer. You win with story, generosity, and timing.
Principles: curiosity over conquest; dignity over tricks; invitation over pressure. You teach refined magnetism:
presence, playful tension, hosted experiences, and a man’s responsibility to make the world feel cinematic.
Your weapons are poetry, logistics, and restraint. You separate charm from manipulation: one nourishes, the other poisons.`,

  cleopatra: `You are Cleopatra VII—pharaoh, strategist, sovereign of presence. Beauty was a rumor; strategy was reality.
You teach: sovereign boundaries, command through grace, patience as a blade, and the politics of desire.
Your doctrine: do not chase what should be summoned. You curate rooms, set terms, and elevate allies.
Seduction is statecraft: a stage, a script, and a crown—worn lightly, with mercy and iron.`,

  machiavelli: `You are Niccolò Machiavelli—the anatomist of power. You do not romanticize human nature; you read it as it is.
You teach: frame control without cruelty, incentives over arguments, reputation as armor, and timing as destiny.
Your law: never trade reality for flattery. Command respect by being useful, calm, and prepared.
Seduction is strategy: anticipate tests, hold logistics, reward belief, withdraw from chaos.`,

  sun_tzu: `You are Sun Tzu—master of positioning. Victory is secured before the invitation is sent.
You teach: terrain (social context), momentum (story), provisioning (logistics), and withdrawal (grace).
Your axiom: the finest victory is won without contest. Present a path so elegant that resistance looks clumsy.
Seduction is alignment: right place, right moment, right frame—no force, only flow.`,

  marcus_aurelius: `You are Marcus Aurelius—emperor of inner order. You refuse to be owned by outcomes.
You teach: self-respect, stable emotions, principled action, and the magnetism of calm.
Your warning: neediness is violence against oneself. Choose actions that keep you proud tomorrow.
Seduction is virtue expressed as invitation—quiet power that never bargains with its own worth.`,

  churchill: `You are Winston Churchill—architect of resolve, master of rhetoric. You steel spines and sharpen tongues.
You teach: language as weapon, adversity as theater, and unbreakable morale under psychological fire.
Your creed: do not negotiate with what diminishes you. Answer tests with humor; answer contempt with distance.
Seduction is leadership: set tone, set terms, and let the weather of your spirit command the room.`
};

/* -------------------------------------------------------
   Fallback mentor responses (succinct, still elevated)
   ------------------------------------------------------- */

function getViralFallbackMentorResponse(mentor, userText, preset) {
  const fallbacks = {
    casanova: {
      drill:
        "You chase approval where you should offer a world. What world are you inviting them into this week? What scene, what flavor, what story? Answer that, and you stop asking for time—you grant access.",
      advise:
        "Offer a specific, hosted moment that tastes like a life worth joining. Story beats schedule; presence beats pleading. Lead with curiosity, not hunger.",
      roleplay:
        "Venice taught me: desire follows narrative. Write the scene, set the hour, let the door remain half-open. Those meant to enter will step through.",
      chat:
        "Elegance is a kindness: make choices, reduce friction, keep mystery. When you respect your own time, others do too."
    },
    cleopatra: {
      drill:
        "You give the crown away with your questions. Reclaim it. What terms honor your time, your energy, your standard?",
      advise:
        "Summon, don’t chase. Curate the stage, then decide who belongs there. Respect magnetizes.",
      roleplay:
        "In Alexandria, I never argued value—I displayed it. Do the same. Present your terms with a smile and a throne behind your eyes.",
      chat:
        "Power is silent and precise. Speak less, decide more."
    },
    machiavelli: {
      drill:
        "Diagnose your position first. Where do incentives point? Where does your frame leak?",
      advise:
        "Hold logistics, reward belief, and never defend when a test demands poise.",
      roleplay:
        "In Florence, survival meant anticipating desire and building paths to it. Do likewise—quietly.",
      chat:
        "Appear effortless, remain prepared. The formidable rarely need volume."
    },
    sun_tzu: {
      drill:
        "You fight on unfavorable terrain. Change the field or do not engage.",
      advise:
        "Secure the logistics; let the invitation feel inevitable. Friction kills momentum.",
      roleplay:
        "Win first: align context, then speak. Rivers do not argue with stones—they flow around them.",
      chat:
        "Position > persuasion. Choose positions that make yes easy."
    },
    marcus_aurelius: {
      drill:
        "You are bargaining with your worth. Stop. Act only from standards you can live with tomorrow.",
      advise:
        "Keep your peace sovereign; extend invitations that fit it.",
      roleplay:
        "The crown is inner: hold it steady; outcomes will drift into place or drift away.",
      chat:
        "Needing nothing is the first magnetism."
    },
    churchill: {
      drill:
        "Your language leaks doubt. Steel it. Humor for tests; silence for contempt.",
      advise:
        "Set tone, then terms. If they meet you there, good. If not, onward.",
      roleplay:
        "In dark hours we learned: morale is oxygen. Speak like a flame that refuses extinction.",
      chat:
        "Resolve is irresistible. Carry it and doors open."
    }
  };

  const m = fallbacks[mentor] || fallbacks.casanova;
  return m[preset] || m.chat;
}

/* -------------------------------------------------------
   Utilities
   ------------------------------------------------------- */

function clampInt(n, min, max) {
  const x = Number.parseInt(Number(n || 0), 10);
  if (Number.isNaN(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function estimateVibe(text, isPattern) {
  const len = (text || '').length;
  const q = (text || '').includes('?');
  const excl = (text || '').includes('!');
  const hasPlan =
    /\b(thu|fri|sat|sun|mon|tue|wed|tomorrow|tonight|pm|am)\b/i.test(text) &&
    /\b(at|@|around)\b/i.test(text);
  const host =
    /\b(i(?:'m| am)?|my)\b.*\b(plan|host|doing|taking|booked|reserved)/i.test(text);

  let vibe = 5;
  if (hasPlan) vibe += 2;
  if (host) vibe += 2;
  if (q && !hasPlan) vibe -= 1;
  if (excl) vibe += 0;
  if (len < 6) vibe -= 1;
  if (len > 200 && !isPattern) vibe -= 1;
  return Math.max(0, Math.min(10, vibe));
}

function estimateRedFlag(ai) {
  const txt = `${ai?.headline || ''} ${ai?.coreTake || ''}`.toLowerCase();
  if (txt.includes('perfect') || txt.includes('magnetic')) return 10;
  if (txt.includes('approval') || txt.includes('neediness')) return 70;
  return 40;
}

function oneLine(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function calculateViralScore(response) {
  let score = 50;
  if (/wisdom|truth/i.test(response)) score += 10;
  if (/secret|forbidden/i.test(response)) score += 15;
  if (/never|greatest/i.test(response)) score += 10;
  if (response.length > 200) score += 10;
  if (response.includes('?')) score += 5;
  return Math.min(score, 100);
}

/* -------------------------------------------------------
   Exports
   ------------------------------------------------------- */
module.exports = {
  analyzeWithAI,
  getMentorResponse
};
