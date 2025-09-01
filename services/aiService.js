// services/aiService.js — ORACLE SEDUCER v7
const axios = require('axios');

const DEEPSEEK_API_URL = "https://api.together.xyz/v1/chat/completions";
const MODEL = "deepseek-ai/DeepSeek-V3";

/* ============================================================
   HELPERS
   ============================================================ */
function oneLine(s) {
  return String(s || "").replace(/\s+/g, " ").trim();
}
function clampInt(n, min, max) {
  const x = parseInt(n, 10);
  if (isNaN(x)) return min;
  return Math.max(min, Math.min(max, x));
}
function joinSentences(parts) {
  return (parts || [])
    .map((p) => String(p || "").trim())
    .filter(Boolean)
    .join(" ");
}

/* ============================================================
   PROMPTS: SCAN & PATTERN
   ============================================================ */
function buildScanPrompt(tone, multi) {
  return `
ROLE: Forensic seduction mentor. You strip lines bare, show the error, rebuild stronger.

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
- NO markdown, NO asterisks, NO emojis.
- Exactly 3 bullets in "why".
- Use blank lines inside strings when helpful.
- 140–220 words. Adults only, consent presumed.`;
}

function buildPatternPrompt(tone) {
  return `
ROLE: War-room strategist. You decode patterns, not transcripts.

TONE=${tone}

OUTPUT JSON ONLY:
{
  "headline": "...",
  "thread": [{ "who": "You|Them", "said": "...", "meaning": "..." }],
  "critical": [{ "moment": "...", "what_went_wrong": "...", "better_line": "...", "why": "..." }],
  "psych_profile": { "you": "...", "them": "...", "explain": "..." },
  "frame_ledger": { "start": "...", "mid": "...", "end": "...", "explain": "..." },
  "error_chain": { "arc": "...", "explain": "..." },
  "fixes": [{ "situation": "...", "rewrite": "...", "explain": "..." }],
  "recovery": ["...", "...", "..."],
  "principle": "...",
  "hidden_agenda": "...",
  "boundary_script": "..."
}

RULES:
- Compact bullets. No transcript dump.
- 2–3 critical moments.
- 220–350 words.
- NO markdown, NO emojis.`;
}

/* ============================================================
   MAIN ANALYSIS
   ============================================================ */
async function analyzeWithAI(message, tone, tab = "scan") {
  const isPattern = tab === "pattern";
  const multi = !isPattern && /(\n|—|-{2,}|;)/.test(String(message || ""));
  const system = isPattern ? buildPatternPrompt(tone) : buildScanPrompt(tone, multi);

  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: message }
    ],
    max_tokens: isPattern ? 1800 : 1200,
    temperature: 0.92,
    top_p: 0.95,
  };

  try {
    const resp = await axios.post(DEEPSEEK_API_URL, body, {
      headers: { Authorization: `Bearer ${process.env.TOGETHER_AI_KEY}` },
      timeout: 90000, // no premature cutoffs
    });

    const raw = resp?.data?.choices?.[0]?.message?.content || "";
    let parsed;
    try {
      const json = raw.match(/\{[\s\S]*\}$/m)?.[0] || raw;
      parsed = JSON.parse(json);
    } catch {
      parsed = { headline: "Parse failed", message, analysis: raw };
    }
    return parsed;
  } catch (err) {
    console.error("analyzeWithAI error:", err.message);
    return { headline: "Error", message, analysis: "Fallback" };
  }
}

/* ============================================================
   MENTORS
   ============================================================ */
const MENTORS = {
  casanova: "Casanova—sharp, quotable, tactical charm.",
  cleopatra: "Cleopatra—regal strategist, elegant power.",
  machiavelli: "Machiavelli—brutal clarity, motives revealed.",
  sun_tzu: "Sun Tzu—timing, positioning, emotional terrain.",
  marcus_aurelius: "Marcus—Stoic magnetism, inner authority.",
  churchill: "Churchill—iron rhetoric, momentum, conviction.",
};

function buildMentorPrompt(mentor, preset) {
  const persona = MENTORS[mentor] || MENTORS.casanova;
  const COMMON = `
RULES:
- NO markdown, NO emojis, NO stars.
- Use blank lines between paragraphs.
- Finish with: Law: "<one sentence>"`;

  const modes = {
    chat: `
CHAT MODE
- 100–160 words
- Back-and-forth energy, short paras
- End with one quotable line`,
    roleplay: `
ROLEPLAY MODE
- Write as a mini-scene (setup → tension → payoff)
- 180–240 words
- End with: Use: "..."`,
    advise: `
ADVISE MODE
- 3 bullet insights
- 1 exact line
- 1 principle
- 200–280 words`,
    drill: `
DRILL MODE
- 12 numbered short questions
- Then one COMMAND
- End with Law: "..."`,
  };

  return `${persona}\n${modes[preset] || modes.chat}\n${COMMON}`;
}

async function getMentorResponse(mentor, userText, preset = "chat") {
  const system = buildMentorPrompt(mentor, preset);
  const body = {
    model: MODEL,
    messages: [
      { role: "system", content: system },
      { role: "user", content: userText }
    ],
    max_tokens: preset === "roleplay" ? 700 : 500,
    temperature: 0.95,
  };

  try {
    const resp = await axios.post(DEEPSEEK_API_URL, body, {
      headers: { Authorization: `Bearer ${process.env.TOGETHER_AI_KEY}` },
      timeout: 90000,
    });
    return resp?.data?.choices?.[0]?.message?.content || "";
  } catch (err) {
    console.error("getMentorResponse error:", err.message);
    return "Law: Lead the frame or lose it.";
  }
}

/* ============================================================
   EXPORTS
   ============================================================ */
module.exports = { analyzeWithAI, getMentorResponse };
