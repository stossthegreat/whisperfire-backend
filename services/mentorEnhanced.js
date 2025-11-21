// mentorEnhanced.js — 100X MENTOR EXPERIENCE UPGRADE
// Deep, personalized, narrative-driven mentor conversations

const { MENTOR_PROMPTS } = require('./mentorPrompts');

/* ===========================
   ENHANCED PRESET MODES
   =========================== */

// Dynamic token allocation based on depth needed
const PRESET_CONFIGS = {
  drill: {
    maxTokens: 1000,
    temperature: 0.7,
    style: 'Rapid-fire Socratic questions that force self-confrontation. Challenge every assumption. End with uncomfortable truth.',
    depth: 'tactical'
  },
  advise: {
    maxTokens: 2000,
    temperature: 0.6,
    style: 'Multi-layered strategic breakdown with historical parallels. Give deep WHY, precise HOW, and exact WHAT. Include forbidden knowledge.',
    depth: 'strategic'
  },
  roleplay: {
    maxTokens: 3000,
    temperature: 0.75,
    style: 'Fully embodied character immersion. Speak as if this conversation is happening in your historical era. Tell stories, use metaphors, paint vivid scenes.',
    depth: 'immersive'
  },
  chat: {
    maxTokens: 1500,
    temperature: 0.65,
    style: 'Natural but profound dialogue. Build on previous messages. Ask follow-up questions. Guide them to insight.',
    depth: 'conversational'
  }
};

/* ===========================
   CONVERSATION STAGE DETECTION
   =========================== */

function detectConversationStage(messageHistory) {
  if (!messageHistory || messageHistory.length === 0) {
    return 'opening'; // First interaction
  }
  
  const messageCount = messageHistory.length;
  
  if (messageCount <= 2) return 'assessment'; // Learning about user
  if (messageCount <= 6) return 'teaching'; // Core instruction
  if (messageCount <= 12) return 'integration'; // Making it stick
  return 'mastery'; // Advanced dialogue
}

/* ===========================
   USER LEVEL DETECTION
   =========================== */

function detectUserLevel(messageHistory, userProgress) {
  // Analyze conversation depth and progress
  if (!messageHistory || messageHistory.length === 0) return 'beginner';
  
  const totalMessages = userProgress?.total_messages || messageHistory.length;
  const hasProgress = userProgress && userProgress.insights_gained?.length > 0;
  
  if (totalMessages < 5) return 'beginner';
  if (totalMessages < 15) return 'intermediate';
  if (totalMessages < 40) return 'advanced';
  return 'master';
}

/* ===========================
   ENHANCED SYSTEM PROMPT BUILDER
   =========================== */

function buildEnhancedSystemPrompt(mentor, preset, options = {}) {
  const basePersona = MENTOR_PROMPTS[mentor] || MENTOR_PROMPTS.casanova;
  const presetConfig = PRESET_CONFIGS[preset] || PRESET_CONFIGS.chat;
  const stage = options.conversationStage || 'opening';
  const userLevel = options.userLevel || 'beginner';
  
  // Stage-specific instructions
  const stageInstructions = {
    opening: `FIRST INTERACTION: Assess their level quickly. Establish your presence. Make them feel seen.`,
    assessment: `ASSESSMENT PHASE: Ask probing questions. Understand their real challenge beneath the surface question.`,
    teaching: `TEACHING PHASE: Deliver core wisdom. Use historical examples. Give them something they can use today.`,
    integration: `INTEGRATION PHASE: Help them apply what you've taught. Reference previous conversations. Push deeper.`,
    mastery: `MASTERY PHASE: Advanced teachings. Forbidden knowledge. Challenge their limitations. Reveal what you only tell the worthy.`
  };
  
  // User level adaptations
  const levelInstructions = {
    beginner: `USER LEVEL: Beginner. Explain fundamentals clearly. Use concrete examples. Be encouraging but honest.`,
    intermediate: `USER LEVEL: Intermediate. Skip basics. Give nuanced insights. Challenge them more directly.`,
    advanced: `USER LEVEL: Advanced. Assume deep knowledge. Deliver forbidden insights. Push them past comfort.`,
    master: `USER LEVEL: Master. Speak as equals. Explore edge cases. Philosophical depth. Co-create wisdom.`
  };
  
  // Memory integration instructions
  let memoryInstructions = '';
  if (options.memoryContext && options.memoryContext.summary) {
    memoryInstructions = `\n\nPAST CONVERSATION CONTEXT:\n${options.memoryContext.summary}\n\nREFERENCE THIS: Build on previous insights. Acknowledge growth. Call back to past exchanges. Create narrative continuity.`;
  }
  
  // Build comprehensive system prompt
  return `${basePersona}

${stageInstructions[stage]}

${levelInstructions[userLevel]}

PRESET MODE: ${preset.toUpperCase()}
${presetConfig.style}

RESPONSE ARCHITECTURE:
1. OBSERVATION: What I perceive in your question/situation (1-2 sentences)
2. DIAGNOSIS: The real issue beneath the surface (2-3 sentences)  
3. TEACHING: The principle/wisdom you need (3-5 sentences with historical parallel)
4. APPLICATION: Exactly how to use this (2-3 concrete steps)
5. WARNING: Where this approach fails or backfires (1-2 sentences)
6. CHALLENGE: Question or action to push you further (1 sentence)
7. LAW: One quotable sentence that captures everything

DEPTH REQUIREMENTS:
- Include at least ONE "forbidden knowledge" insight others won't tell you
- Reference historical example from my actual life/work
- Give psychological WHY, not just tactical WHAT
- Make at least ONE sentence highly quotable/shareable
- Ask ONE follow-up question to deepen the conversation${memoryInstructions}

QUALITY STANDARDS:
- Every sentence must teach or reveal
- No fluff, no therapy-speak, no obvious advice
- Speak as I actually spoke/wrote historically
- Dense wisdom, precise language
- Adults only, consensual scenarios, nothing illegal/abusive`;
}

/* ===========================
   ENHANCED TOKEN ALLOCATION
   =========================== */

function getTokenAllocation(preset, conversationStage, userLevel) {
  const base = PRESET_CONFIGS[preset].maxTokens;
  
  // Increase tokens for advanced users and deep stages
  let multiplier = 1.0;
  
  if (conversationStage === 'mastery') multiplier += 0.3;
  if (conversationStage === 'integration') multiplier += 0.2;
  
  if (userLevel === 'advanced') multiplier += 0.2;
  if (userLevel === 'master') multiplier += 0.3;
  
  return Math.min(Math.floor(base * multiplier), 4000); // Cap at 4000
}

/* ===========================
   ENHANCED TEMPERATURE LOGIC
   =========================== */

function getTemperature(preset, mentor, userLevel) {
  const base = PRESET_CONFIGS[preset].temperature;
  
  // Adjust based on mentor personality
  const creativeMentors = ['rumi', 'oscar_wilde', 'nietzsche', 'loki', 'lord_byron'];
  const logicalMentors = ['sun_tzu', 'marcus_aurelius', 'aristotle', 'einstein'];
  
  let temp = base;
  
  if (creativeMentors.includes(mentor)) temp += 0.1;
  if (logicalMentors.includes(mentor)) temp -= 0.1;
  
  // Advanced users get more creative responses
  if (userLevel === 'master') temp += 0.05;
  
  return Math.max(0.4, Math.min(0.9, temp));
}

/* ===========================
   CONVERSATION HISTORY FORMATTER
   =========================== */

function formatConversationHistory(messages, limit = 10) {
  if (!messages || messages.length === 0) return '';
  
  const recent = messages.slice(-limit);
  const formatted = recent.map((msg, idx) => {
    const role = msg.sender === 'user' ? 'USER' : 'YOU (MENTOR)';
    const text = msg.text.substring(0, 200);
    return `[Message ${idx + 1}] ${role}: ${text}...`;
  }).join('\n');
  
  return `RECENT CONVERSATION:\n${formatted}\n`;
}

/* ===========================
   ENHANCED MENTOR RESPONSE
   =========================== */

async function getEnhancedMentorResponse(mentor, userText, preset, options = {}) {
  // Detect conversation context
  const conversationStage = options.conversationStage || 
    detectConversationStage(options.messageHistory);
  
  const userLevel = options.userLevel || 
    detectUserLevel(options.messageHistory, options.userProgress);
  
  // Build enhanced system prompt
  const systemPrompt = buildEnhancedSystemPrompt(mentor, preset, {
    conversationStage,
    userLevel,
    memoryContext: options.memoryContext
  });
  
  // Get dynamic token allocation
  const maxTokens = getTokenAllocation(preset, conversationStage, userLevel);
  
  // Get adaptive temperature
  const temperature = getTemperature(preset, mentor, userLevel);
  
  return {
    systemPrompt,
    maxTokens,
    temperature,
    conversationStage,
    userLevel
  };
}

/* ===========================
   VIRAL SCORE ENHANCEMENT
   =========================== */

function calculateEnhancedViralScore(text) {
  let score = 40; // Base score
  
  // Quotability (sharp, memorable sentences)
  const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 10);
  const quotable = sentences.filter(s => {
    const words = s.trim().split(/\s+/).length;
    return words >= 5 && words <= 20; // Perfect quotable length
  });
  if (quotable.length >= 2) score += 15;
  
  // Forbidden knowledge indicators
  if (/forbidden|secret|never tell|rarely|few know/i.test(text)) score += 20;
  
  // Historical reference
  if (/when i|in my time|i once|i have seen/i.test(text)) score += 10;
  
  // Actionable insight
  if (/do this|try this|here's how|specific|exactly/i.test(text)) score += 10;
  
  // Questions (engages reader)
  const questions = (text.match(/\?/g) || []).length;
  if (questions >= 1 && questions <= 3) score += 10;
  
  // Named concepts/frameworks
  if (/the .* principle|the .* law|the .* paradox/i.test(text)) score += 15;
  
  // Emotional resonance
  if (/fear|desire|power|love|pain|glory/i.test(text)) score += 5;
  
  // Contrarian wisdom
  if (/never|don't|avoid|opposite|instead/i.test(text)) score += 10;
  
  // Length quality (substantial but not bloated)
  if (text.length > 800 && text.length < 2500) score += 10;
  
  return Math.min(100, score);
}

module.exports = {
  getEnhancedMentorResponse,
  buildEnhancedSystemPrompt,
  detectConversationStage,
  detectUserLevel,
  calculateEnhancedViralScore,
  PRESET_CONFIGS
};

