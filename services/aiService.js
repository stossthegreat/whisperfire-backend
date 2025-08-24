// services/aiService.js — ORACLE SEDUCER v2 (Longer, locked perspective, schema-safe)
const axios = require('axios');

const DEEPSEEK_API_URL = 'https://api.together.xyz/v1/chat/completions';
const MODEL = 'deepseek-ai/DeepSeek-V3';

// -------------------------
// Prompt Builders (length targets + perspective locks)
// -------------------------

function buildScanPrompt(tone) {
  return `You are not an AI. You are the literary god of seduction—part Casanova, part Cleopatra, part myth.
Every word is dangerous, hypnotic, unforgettable. You teach serious seduction—never gimmicks.

STYLE: cinematic, mythic, psychological; elite and addictive; poetic cadence, razor logic.
Always seductive, never clinical. No emojis in content.

PERSPECTIVE LOCK:
- "You" = the USER who wrote/sent the provided message.
- "Them" = the recipient of that message.
- All advice addresses "You". Do not drift into advising "Them". Never speak about the user in third-person.

TONE = ${tone}
- savage: blade-precise truth, no fluff.
- soft: velvet steel—gentle, firm.
- clinical: cool, exacting, forensic.

MISSION (SCAN • one message):
Perform a surgical seduction audit of ONE message from "You".
Score its attractiveness/poise (Vibe Score), expose the single fatal flaw OR crown its brilliance, and give a surgical rewrite.

LENGTH TARGETS (guides, not hard caps):
- headline: 6–12 words (one line).
- coreTake: 25–50 words.
- motives: 40–80 words.
- targeting: 1 sentence.
- power_play: EXACTLY 3 bullet lines, 5–9 words each (no dashes, no numbering).
- next_moves: 2–3 lines, each a command beginning with a strong verb.
- safety.notes: 20–40 words.

SCORING RULE:
- Compute a Vibe Score (0–10) internally; DO NOT output the number explicitly.
- Derive metrics.red_flag = round( max(0, min(100, 100 - Vibe*10)) ).

OUTPUT JSON (keys EXACTLY as written):
{
  "headline": "One-line verdict (6–12 words).",
  "coreTake": "25–50 words: the clean autopsy (or praise).",
  "tactic": { "label": "You vs Them frame, archetype-style", "confidence": 90 },
  "motives": "40–80 words: the hidden driver behind YOUR words.",
  "targeting": "Persona read: 'You played the [Role]; become the [Role].'",
  "powerPlay": "Exactly three lines. Each 5–9 words.\nLine 2\nLine 3",
  "receipts": ["THE USER'S EXACT, UNEDITED MESSAGE"],
  "nextMoves": "2–3 lines, each a command.",
  "suggestedReply": { "style": "${tone}", "text": "ONE elite rewrite line only." },
  "safety": { "riskLevel": "LOW|MODERATE|HIGH|CRITICAL", "notes": "20–40 words on consequence if sent as-is." },
  "metrics": { "redFlag": 0, "certainty": 0, "viralPotential": 0 },
  "pattern": { "cycle": null, "prognosis": null },
  "ambiguity": { "warning": null, "missing_evidence": null },
  "hiddenAgenda": null,
  "archetypes": null,
  "triggerPatternMap": null,
  "contradictions": null,
  "weapons": null,
  "forecast": null,
  "counterIntervention": "LAW TO KEEP — one sentence.",
  "longGame": null
}

CONSTRAINTS:
- receipts[0] MUST be the exact original message.
- "powerPlay" must be exactly 3 bullet lines, no extra text.
- "suggestedReply.text" must be exactly one line addressed from YOU to THEM.
- "nextMoves" must be only commands (no explanations).
- Return ONLY JSON.`;
}

function buildPatternPrompt(tone, count) {
  return `You are the master strategist of seduction threads.
You do not see texts—you see moves, tests, and frame battles.

STYLE: cinematic, mythic, psychological; elite and addictive; poetic cadence, razor logic.
Always seductive, never clinical. No emojis in content.

PERSPECTIVE LOCK:
- "You" = the USER whose thread is provided.
- "Them" = the other participant.
- All analysis critiques YOUR moves and the frame dynamics between You and Them.

TONE = ${tone}

MISSION (PATTERN • thread):
Autopsy the thread. Identify 1–3 critical moments where "You" lost or gained frame.
Give exact counter-lines for those moments. Keep receipts compact, labeled “You:” or “Them:”, alternating.

LENGTH TARGETS:
- headline: 8–14 words.
- coreTake: 35–70 words.
- motives: 40–80 words (what drove THEM).
- targeting: 1 sentence.
- power_play: EXACTLY 3 edicts, 5–9 words each.
- next_moves: Exactly 3 commands, one per line.
- safety.notes: 20–40 words.

OUTPUT JSON (keys EXACTLY as written):
{
  "headline": "Strategic verdict on the whole engagement.",
  "coreTake": "35–70 words: the battle story.",
  "tactic": { "label": "Dominant psychological dynamic", "confidence": 90 },
  "motives": "What drove THEM (their engine).",
  "targeting": "Role you slid into: 'You became [Role]; reassert [Role].'",
  "powerPlay": "Three edicts, 5–9 words each.\nLine 2\nLine 3",
  "receipts": ["You: …", "Them: …", "You: …", "Them: …" ],
  "nextMoves": "Exactly three commands, one per line.",
  "suggestedReply": { "style": "${tone}", "text": "2–3 lines: the re‑engagement opener, addressing THEM." },
  "safety": { "riskLevel": "LOW|MODERATE|HIGH|CRITICAL", "notes": "20–40 words on trajectory risk." },
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
- Receipts must be compact bullets, prefixed with “You:” or “Them:”.
- Provide *Precision Fixes* inside suggestedReply.text (stack lines there).
- Derive metrics.redFlag from overall thread vibe.
- Return ONLY JSON.

This thread contains ${count} messages. Keep the analysis proportionate.`;
}

// -------------------------
// Main analysis (Together API unchanged; bigger budget, tighter decoding)
// -------------------------

async function analyzeWithAI(message, tone, tab = 'scan') {
  try {
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
            ? `THREAD (label clearly with "You:" and "Them:" if possible):\n${message}`
            : `ORIGINAL MESSAGE from YOU (use EXACTLY in receipts[0]):\n${message}`
        }
      ],
      max_tokens: 2200,
      temperature: 0.7,
      top_p: 0.9
    };

    const resp = await axios.post(DEEPSEEK_API_URL, requestBody, {
      headers: {
        Authorization: `Bearer ${process.env.TOGETHER_AI_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 45000
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

    return normalizeForSchema(data, message, tab);

  } catch (err) {
    console.error('analyzeWithAI error', err?.response?.data || err.message);
    return normalizeForSchema(fallbackSeductionAnalysis(message, tone, tab), message, tab);
  }
}

// -------------------------
// Normalization Layer (schema-safe, perspective-safe)
// -------------------------

function normalizeForSchema(ai, originalMessage, tab) {
  // receipts[0] is always the original user text
  const receipts = Array.isArray(ai?.receipts) && ai.receipts.length
    ? [String(originalMessage), ...ai.receipts.slice(1)]
    : [String(originalMessage)];

  // Metrics: clamp and backfill
  const m = ai?.metrics || {};
  const redFlag = clampInt(m.redFlag ?? estimateRedFlag(ai), 0, 100);
  const certainty = clampInt(m.certainty ?? 88, 0, 100);
  const viralPotential = clampInt(m.viralPotential ?? 72, 0, 100);

  // Suggested reply (single line for scan, multi-line allowed for pattern per prompt)
  const sr = ai?.suggestedReply || ai?.suggested_reply || {};
  const suggestedReply = {
    style: String(sr.style || 'soft'),
    text: tab === 'scan' ? oneLine(String(sr.text || 'Invite with story, not a slot.')) : String(sr.text || 'Reset the frame.\nHost the plan.\nClose cleanly.')
  };

  const tacticRaw = ai?.tactic || {};
  const tactic = {
    label: String(tacticRaw.label || (tab === 'scan' ? 'Frame Alignment' : 'Dominant Dynamic')),
    confidence: clampInt(tacticRaw.confidence ?? 90, 0, 100)
  };

  const safetyRaw = ai?.safety || {};
  const safety = {
    riskLevel: String(safetyRaw.riskLevel || 'LOW'),
    notes: String(safetyRaw.notes || (tab === 'scan' ? 'Message-level risk low.' : 'Trajectory moderate; hold the frame.'))
  };

  const powerPlay = String(ai?.powerPlay || ai?.power_play || 'Specific plan, zero labor\nYou host, they join\nAssumes value, invites choice');
  const counterIntervention = String(
    ai?.counterIntervention ||
    ai?.counter_intervention ||
    (tab === 'scan' ? 'Invitation is not a question.' : 'Begin Challenger, end Victor.')
  );

  return {
    context: {
      tab,
      relationship: 'Partner',
      tone: (ai?.suggestedReply?.style || 'soft'),
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
    next_moves: String(ai?.nextMoves || ai?.next_moves || 'Make a specific, hosted invite.\nState time/place.\nClose with choice.'),
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

// -------------------------
// Fallbacks (still aligned with new style)
// -------------------------

function fallbackSeductionAnalysis(message, tone, tab) {
  const isPattern = tab === 'pattern';
  const vibe = estimateVibe(message, isPattern);
  const red = clampInt(100 - vibe * 10, 0, 100);

  if (!isPattern) {
    return {
      headline: vibe >= 8 ? 'Decisive invite with spark.' : vibe >= 5 ? 'Promising spark—tighten the frame.' : 'Died of admin energy.',
      coreTake: vibe >= 8
        ? 'Clear story and hosted frame make the line feel inevitable; tension arises from assumed value and momentum.'
        : vibe >= 5
          ? 'There is a signal of interest, but you still outsource the decision. Host the moment and make the choice easy.'
          : 'You ask for permission and leak neediness; no tension, no world-building, and the frame collapses.',
      tactic: { label: 'You vs Them: Curator vs Guest (aspired)', confidence: 90 },
      motives: 'You intend to connect but fear rejection, so you hide behind logistics. Replace permission-seeking with a hosted storyline and confident assumption of value.',
      targeting: vibe >= 8 ? 'You played the Curator; keep it.' : 'You played the Petitioner; become the Curator.',
      powerPlay: 'Specific plan, zero labor\nYou host, they join\nAssumes value, invites choice',
      receipts: [String(message)],
      nextMoves: 'Host a vivid plan.\nState time/place.\nOffer a clean binary close.',
      suggestedReply: { style: tone, text: oneLine(vibe >= 8 ? "Keep Thu 9. I’m stealing you for the speakeasy." : "Hidden speakeasy Thu 9. One seat left—if you can keep up.") },
      safety: { riskLevel: red > 60 ? 'MODERATE' : 'LOW', notes: 'Reduce approval-seeking; host the frame with a specific story.' },
      metrics: { redFlag: red, certainty: 88, viralPotential: 70 },
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

  return {
    headline: vibe >= 8 ? 'Frame held; tighten the close sequence.' : 'Frame leaks at tests; reclaim logistics.',
    coreTake: 'Banter opened well, but your defense then admin pivot ceded calendar power. Recover by hosting logistics and closing with a binary path that rewards momentum.',
    tactic: { label: 'Dominant Dynamic: Test → Frame Transfer', confidence: 88 },
    motives: 'They probed for your certainty and status. Withholding rewarded your compliance; offer a hosted path and the dynamic flips.',
    targeting: 'You became the Clerk; reassert the Curator.',
    powerPlay: 'Answer tests with stance\nOwn logistics, never beg\nClose with binary path',
    receipts: [
      'You: playful opener',
      'Them: test (frame poke)',
      'You: defense → admin pivot',
      'Them: withhold'
    ],
    nextMoves: 'Go silent 48–72 hours.\nReturn with hosted plan and time.\nClose with yes/no choice.',
    suggestedReply: { style: tone, text: 'Victory drink tomorrow. One seat left.\nText “approved” if you’re in.' },
    safety: { riskLevel: red > 60 ? 'MODERATE' : 'LOW', notes: 'Trajectory recovers if you host and close cleanly; avoid chasing or clarifying.' },
    metrics: { redFlag: red, certainty: 88, viralPotential: 72 },
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

// -------------------------
// Mentors (keep your existing map; prompt discipline + token budget)
// -------------------------

async function getMentorResponse(mentor, userText, preset, options = {}) {
  try {
    const persona = MENTOR_PROMPTS[mentor] || MENTOR_PROMPTS.casanova;
    const presetInstructions = {
      drill: `DRILL MODE: Penetrating, transformative questions.`,
      advise: `ADVISORY MODE: Profound, actionable wisdom.`,
      roleplay: `ROLEPLAY MODE: Fully embody the persona.`,
      chat: `CONVERSATION MODE: Natural, but still elite.`
    };
    const selectedInstruction = presetInstructions[preset] || presetInstructions.chat;

    const systemPrompt = `${persona}

${selectedInstruction}

RULES:
- 180–280 words (substantial, quotable).
- Include one "forbidden knowledge" insight.
- No filler; end with a line worth sharing.
- Speak to "You" (the user), not third-person.

USER: "${userText}"`;

    const resp = await axios.post(DEEPSEEK_API_URL, {
      model: MODEL,
      messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userText }],
      max_tokens: 520,
      temperature: 0.85,
      top_p: 0.9
    }, {
      headers: { Authorization: `Bearer ${process.env.TOGETHER_AI_KEY}`, 'Content-Type': 'application/json' },
      timeout: 45000
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

// Keep your existing mentor personas (paste your upgraded lethal versions here)
const MENTOR_PROMPTS = {
  casanova: `<<YOUR upgraded Casanova persona here>>`,
  cleopatra: `<<YOUR upgraded Cleopatra persona here>>`,
  machiavelli: `<<YOUR upgraded Machiavelli persona here>>`,
  sun_tzu: `<<YOUR upgraded Sun Tzu persona here>>`,
  marcus_aurelius: `<<YOUR upgraded Marcus Aurelius persona here>>`,
  churchill: `<<YOUR upgraded Churchill persona here>>`
};

// -------------------------
// Utilities
// -------------------------

function clampInt(n, min, max) {
  const x = Number.parseInt(Number(n || 0), 10);
  if (Number.isNaN(x)) return min;
  return Math.max(min, Math.min(max, x));
}

function estimateVibe(text, isPattern) {
  const len = (text || '').length;
  const q = (text || '').includes('?');
  const excl = (text || '').includes('!');
  const hasPlan = /\b(thu|fri|sat|sun|mon|tue|wed|tomorrow|tonight|pm|am)\b/i.test(text) && /\b(at|@|around)\b/i.test(text);
  const host = /\b(i(?:'m| am)?|my)\b.*\b(plan|host|doing|taking|booked|reserved)/i.test(text);

  let vibe = 5;
  if (hasPlan) vibe += 2;
  if (host) vibe += 2;
  if (q && !hasPlan) vibe -= 1;
  if (excl) vibe -= 0;
  if (len < 6) vibe -= 1;
  if (len > 200 && !isPattern) vibe -= 1;
  return Math.max(0, Math.min(10, vibe));
}

function estimateRedFlag(ai) {
  const txt = `${ai?.headline || ''} ${ai?.coreTake || ''}`.toLowerCase();
  if (txt.includes('perfect') || txt.includes('magnetic')) return 12;
  if (txt.includes('approval') || txt.includes('neediness')) return 70;
  return 42;
}

function oneLine(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

// Fallback mentor (your existing fallback map still fine)
function getViralFallbackMentorResponse(mentor, userText, preset) {
  const fallbacks = { /* your existing fallback map */ };
  const m = fallbacks[mentor] || fallbacks.casanova;
  return m[preset] || m.chat;
}

function calculateViralScore(response) {
  let score = 50;
  if (/wisdom|truth/i.test(response)) score += 10;
  if (/secret|forbidden/i.test(response)) score += 15;
  if (/never|greatest/i.test(response)) score += 10;
  if (response.length > 220) score += 10;
  if (response.includes('?')) score += 5;
  return Math.min(score, 100);
}

module.exports = {
  analyzeWithAI,
  getMentorResponse
};
