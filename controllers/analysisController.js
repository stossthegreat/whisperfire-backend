// controllers/analysisController.js - VIRAL MONSTER VERSION (CLEAN OUTPUT)

// NOTE: same imports you already use
const { analyzeWithAI, getMentorResponse } = require('../services/aiService');

/* ────────────────────────────────────────────────────────────
   INLINE SANITIZERS (no external utils, safe for JSON/SSE)
   Removes mojibake (Â, â€™ etc), strips markdown asterisks,
   normalizes bullets to "• ", and enforces paragraph spacing.
──────────────────────────────────────────────────────────── */
function fixMojibake(s = '') {
  return String(s)
    .replace(/â€™/g, "'")
    .replace(/â€˜/g, "'")
    .replace(/â€œ|â€ś|â€ž|â€\x9d|â€ť/g, '"')
    .replace(/â€”|â€“/g, '—')
    .replace(/â€˘|â€¢/g, '•')
    .replace(/Â+/g, '')
    .replace(/Ã—/g, '×')
    .replace(/\uFFFD|\u0000/g, '');
}

function stripMarkdownNoise(s = '') {
  let out = String(s);
  // bold/italic/inline code/blockquote markers
  out = out.replace(/\*\*(.*?)\*\*/g, '$1')
           .replace(/\*(.*?)\*/g, '$1')
           .replace(/__(.*?)__/g, '$1')
           .replace(/_(.*?)_/g, '$1')
           .replace(/`([^`]+)`/g, '$1')
           .replace(/^[ \t]*>[ \t]?/gm, '');
  return out;
}

function normalizeBullets(s = '') {
  // turn "- foo" or "* foo" into "• foo" (but keep existing "•")
  return String(s)
    .replace(/^[ \t]*[-*][ \t]+/gm, '• ')
    .replace(/[ \t]+\n/g, '\n');
}

function ensureSentenceSpacing(s = '') {
  // ensure a space after punctuation if followed by a letter
  return String(s).replace(/([.!?])([A-Za-z])/g, '$1 $2');
}

function normalizeWhitespace(s = '') {
  return String(s)
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function paragraphize(s = '') {
  // Keep bullets on separate lines; combine plain lines into paragraphs
  const lines = String(s).split('\n');
  const out = [];
  let bucket = [];
  const flush = () => { if (bucket.length) { out.push(bucket.join(' ')); bucket = []; } };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { flush(); out.push(''); continue; }
    if (/^•\s/.test(line)) { flush(); out.push(line); continue; }
    bucket.push(line);
    if (/[.!?…]"?$/.test(line)) flush();
  }
  flush();
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function sanitizeText(s = '') {
  return paragraphize(
    normalizeWhitespace(
      ensureSentenceSpacing(
        normalizeBullets(
          stripMarkdownNoise(
            fixMojibake(s)
          )
        )
      )
    )
  );
}

function sanitizeDeep(value) {
  if (typeof value === 'string') return sanitizeText(value);
  if (Array.isArray(value)) return value.map(sanitizeDeep);
  if (value && typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) out[k] = sanitizeDeep(value[k]);
    return out;
  }
  return value;
}
/* ──────────────────────────────────────────────────────────── */

// UNIFIED ANALYZE ROUTE - Enhanced for viral-worthy insights
exports.unifiedAnalyze = async (req, res) => {
  // prevent Express from timing out long Together calls
  res.setTimeout?.(125000);

  try {
    console.log('🚀 VIRAL ANALYSIS ENGINE: Unified request received');
    console.log('📊 Request data:', req.body);

    const { tab, message, messages, tone, relationship, content_type, subject_name } = req.body;

    if (tab === 'scan' && message) {
      // ENHANCED SCAN ANALYSIS
      console.log(`🔍 SCAN ANALYSIS: Processing "${message}" with ${tone} tone`);

      const analysisData = await analyzeWithAI(message, tone, 'scan');
      const clean = sanitizeDeep(analysisData);

      const response = {
        success: true,
        data: {
          context: {
            tab: 'scan',
            relationship: relationship || 'Unknown',
            tone: tone,
            content_type: content_type || 'dm',
            subject_name: subject_name || 'Subject',
            timestamp: new Date().toISOString(),
            analysis_type: 'Single Message Deep Dive'
          },
          headline: clean.headline,
          core_take: clean.coreTake || clean.core_take,
          tactic: clean.tactic,
          motives: clean.motives,
          targeting: clean.targeting,
          power_play: clean.powerPlay || clean.power_play,
          receipts: clean.receipts,
          next_moves: clean.nextMoves || clean.next_moves,
          suggested_reply: clean.suggestedReply || clean.suggested_reply,
          safety: {
            risk_level: clean.safety?.riskLevel || clean.safety?.risk_level || 'LOW',
            notes: clean.safety?.notes || 'Standard communication detected'
          },
          metrics: {
            red_flag: clean.metrics?.redFlag || clean.metrics?.red_flag || 15,
            certainty: clean.metrics?.certainty || 70,
            viral_potential: clean.metrics?.viralPotential || clean.metrics?.viral_potential || 25,
            manipulation_score: clean.metrics?.manipulationScore || clean.metrics?.manipulation_score || 0,
            toxicity_level: clean.metrics?.toxicityLevel || clean.metrics?.toxicity_level || 0
          },
          // VIRAL ENHANCEMENTS
          viral_insights: clean.viralInsights || clean.viral_insights || {
            mind_blowing_truth: "Deep psychological patterns detected",
            quotable_wisdom: "Every message reveals the sender's deepest fears",
            psychology_explained: "Communication patterns reveal unconscious motivations",
            power_move: "Respond strategically, not emotionally"
          },
          attachment_analysis: clean.attachmentAnalysis || clean.attachment_analysis || {
            target_style: "analyzing",
            triggers_detected: ["emotional hooks", "validation seeking"],
            wound_exploited: "fear of rejection or abandonment",
            healing_needed: "secure communication patterns"
          },
          manipulation_map: clean.manipulationMap || clean.manipulation_map || {
            primary_tactic: "standard communication",
            secondary_tactics: ["emotional appeals"],
            counter_strategy: "maintain boundaries and respond authentically",
            future_patterns: "monitor for escalation or de-escalation"
          },
          pattern: null,
          ambiguity: null
        }
      };

      console.log('✨ SCAN ANALYSIS COMPLETE - Viral insights generated');
      return res.status(200).json(response);

    } else if (tab === 'pattern' && messages && Array.isArray(messages)) {
      // ENHANCED PATTERN ANALYSIS
      console.log(`🔄 PATTERN ANALYSIS: Processing ${messages.length} messages for deep behavioral patterns`);

      // Combine messages with enhanced context
      const combinedMessage = messages.map((msg, index) =>
        `[Message ${index + 1}]: ${msg}`
      ).join('\n---\n');

      const analysisData = await analyzeWithAI(combinedMessage, tone, 'pattern');
      const clean = sanitizeDeep(analysisData);

      const response = {
        success: true,
        data: {
          context: {
            tab: 'pattern',
            relationship: relationship || 'Unknown',
            tone: tone,
            content_type: content_type || 'dm',
            subject_name: subject_name || 'Subject',
            message_count: messages.length,
            timestamp: new Date().toISOString(),
            analysis_type: 'Multi-Message Pattern Analysis'
          },
          headline: clean.headline,
          core_take: clean.coreTake || clean.core_take,
          tactic: clean.tactic,
          motives: clean.motives,
          targeting: clean.targeting,
          power_play: clean.powerPlay || clean.power_play,
          receipts: clean.receipts,
          next_moves: clean.nextMoves || clean.next_moves,
          suggested_reply: clean.suggestedReply || clean.suggested_reply,
          safety: {
            risk_level: clean.safety?.riskLevel || clean.safety?.risk_level || 'LOW',
            notes: clean.safety?.notes || 'Pattern analysis complete'
          },
          metrics: {
            red_flag: clean.metrics?.redFlag || clean.metrics?.red_flag || 20,
            certainty: clean.metrics?.certainty || 80,
            viral_potential: clean.metrics?.viralPotential || clean.metrics?.viral_potential || 30,
            manipulation_score: clean.metrics?.manipulationScore || clean.metrics?.manipulation_score || 0,
            toxicity_level: clean.metrics?.toxicityLevel || clean.metrics?.toxicity_level || 0
          },
          // ENHANCED PATTERN FIELDS
          pattern: clean.pattern || {
            cycle: `Behavioral cycle detected across ${messages.length} messages`,
            prognosis: "Pattern analysis reveals communication trends",
            escalation_detected: false,
            consistency_score: 75
          },
          // VIRAL ENHANCEMENTS
          viral_insights: clean.viralInsights || clean.viral_insights || {
            mind_blowing_truth: "Recurring patterns reveal deeper psychological programming",
            quotable_wisdom: "People don't change their communication - they reveal who they are",
            psychology_explained: "Consistent communication patterns indicate core personality traits and attachment styles",
            power_move: "Use pattern recognition to predict and prepare for future interactions"
          },
          attachment_analysis: clean.attachmentAnalysis || clean.attachment_analysis || {
            target_style: "pattern-based assessment",
            triggers_detected: ["consistency markers", "escalation points"],
            wound_exploited: "chronic insecurity or control needs",
            healing_needed: "pattern interruption and conscious communication"
          },
          manipulation_map: clean.manipulationMap || clean.manipulation_map || {
            primary_tactic: "behavioral consistency",
            secondary_tactics: ["pattern establishment", "expectation setting"],
            counter_strategy: "break expected response patterns to disrupt manipulation cycles",
            future_patterns: "expect continuation of established behavioral trends"
          },
          ambiguity: null,
          // PATTERN-SPECIFIC ENHANCED FIELDS (matching original structure)
          hidden_agenda: clean.hiddenAgenda || clean.hidden_agenda,
          archetypes: clean.archetypes,
          trigger_pattern_map: clean.triggerPatternMap || clean.trigger_pattern_map,
          contradictions: clean.contradictions,
          weapons: clean.weapons,
          forecast: clean.forecast,
          counter_intervention: clean.counterIntervention || clean.counter_intervention,
          long_game: clean.longGame || clean.long_game
        }
      };

      console.log('🎯 PATTERN ANALYSIS COMPLETE - Behavioral insights unlocked');
      return res.status(200).json(response);

    } else {
      console.log('❌ INVALID REQUEST FORMAT');
      return res.status(400).json({
        error: 'Invalid request format detected',
        details: 'For scan analysis: provide "tab": "scan" and "message". For pattern analysis: provide "tab": "pattern" and "messages" array.',
        received: {
          tab,
          hasMessage: !!message,
          hasMessages: !!messages,
          messageCount: messages ? messages.length : 0
        }
      });
    }

  } catch (error) {
    console.error('💥 UNIFIED ANALYSIS ERROR:', error);
    res.status(500).json({
      error: 'Analysis engine encountered an error',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal processing error',
      timestamp: new Date().toISOString()
    });
  }
};

// ENHANCED SEPARATE SCAN ROUTE
exports.analyzeScan = async (req, res) => {
  res.setTimeout?.(125000);

  try {
    const { message, tone, relationship, content_type, subject_name } = req.body;

    if (!message || !tone) {
      return res.status(400).json({
        error: 'Missing critical analysis parameters',
        required: ['message', 'tone'],
        received: { message: !!message, tone: !!tone }
      });
    }

    console.log(`🔍 DEDICATED SCAN: Analyzing "${message.substring(0, 50)}..." with ${tone} intensity`);

    const analysisData = await analyzeWithAI(message, tone, 'scan');
    const clean = sanitizeDeep(analysisData);

    const response = {
      success: true,
      data: {
        context: {
          tab: 'scan',
          relationship: relationship || 'Unknown',
          tone: tone,
          content_type: content_type || 'dm',
          subject_name: subject_name || 'Subject',
          analysis_depth: 'deep_psychological_scan',
          timestamp: new Date().toISOString()
        },
        headline: clean.headline,
        core_take: clean.coreTake || clean.core_take,
        tactic: clean.tactic,
        motives: clean.motives,
        targeting: clean.targeting,
        power_play: clean.powerPlay || clean.power_play,
        receipts: clean.receipts,
        next_moves: clean.nextMoves || clean.next_moves,
        suggested_reply: clean.suggestedReply || clean.suggested_reply,
        safety: {
          risk_level: clean.safety?.riskLevel || clean.safety?.risk_level || 'LOW',
          notes: clean.safety?.notes || 'Psychological scan complete'
        },
        metrics: {
          red_flag: clean.metrics?.redFlag || clean.metrics?.red_flag || 15,
          certainty: clean.metrics?.certainty || 70,
          viral_potential: clean.metrics?.viralPotential || clean.metrics?.viral_potential || 25,
          manipulation_score: clean.metrics?.manipulationScore || 0,
          toxicity_level: clean.metrics?.toxicityLevel || 0
        },
        viral_insights: clean.viralInsights || {
          mind_blowing_truth: "Single message analysis reveals core communication patterns",
          quotable_wisdom: "Every word choice reveals unconscious psychological states",
          psychology_explained: "Message structure indicates underlying emotional drivers",
          power_move: "Respond to the psychology, not just the words"
        },
        attachment_analysis: clean.attachmentAnalysis || {
          target_style: "single-message assessment",
          triggers_detected: ["emotional markers detected"],
          wound_exploited: "analyzing for psychological vulnerabilities",
          healing_needed: "conscious communication practices"
        },
        manipulation_map: clean.manipulationMap || {
          primary_tactic: "message-level analysis",
          secondary_tactics: ["word choice patterns"],
          counter_strategy: "strategic response to underlying psychology",
          future_patterns: "monitor for escalation or pattern development"
        },
        pattern: null,
        ambiguity: null
      }
    };

    console.log('✨ DEDICATED SCAN COMPLETE');
    res.status(200).json(response);
  } catch (error) {
    console.error('💥 SCAN ERROR:', error);
    res.status(500).json({
      error: 'Scan analysis failed',
      timestamp: new Date().toISOString()
    });
  }
};

// ENHANCED SEPARATE PATTERN ROUTE
exports.analyzePattern = async (req, res) => {
  res.setTimeout?.(125000);

  try {
    const { messages, tone, relationship, content_type, subject_name } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0 || !tone) {
      return res.status(400).json({
        error: 'Invalid pattern analysis request',
        required: 'messages array (non-empty) and tone',
        received: {
          hasMessages: !!messages,
          isArray: Array.isArray(messages),
          messageCount: messages ? messages.length : 0,
          tone: !!tone
        }
      });
    }

    console.log(`🔄 DEDICATED PATTERN: Deep behavioral analysis of ${messages.length} messages`);

    const combinedMessage = messages.map((msg, index) =>
      `[Pattern Message ${index + 1}]: ${msg}`
    ).join('\n---PATTERN BREAK---\n');

    const analysisData = await analyzeWithAI(combinedMessage, tone, 'pattern');
    const clean = sanitizeDeep(analysisData);

    const response = {
      success: true,
      data: {
        context: {
          tab: 'pattern',
          relationship: relationship || 'Unknown',
          tone: tone,
          content_type: content_type || 'dm',
          subject_name: subject_name || 'Subject',
          message_count: messages.length,
          analysis_depth: 'deep_behavioral_pattern_analysis',
          timestamp: new Date().toISOString()
        },
        headline: clean.headline,
        core_take: clean.coreTake || clean.core_take,
        tactic: clean.tactic,
        motives: clean.motives,
        targeting: clean.targeting,
        power_play: clean.powerPlay || clean.power_play,
        receipts: clean.receipts,
        next_moves: clean.nextMoves || clean.next_moves,
        suggested_reply: clean.suggestedReply || clean.suggested_reply,
        safety: {
          risk_level: clean.safety?.riskLevel || clean.safety?.risk_level || 'LOW',
          notes: 'Deep pattern analysis complete'
        },
        metrics: {
          red_flag: clean.metrics?.redFlag || clean.metrics?.red_flag || 20,
          certainty: clean.metrics?.certainty || 80,
          viral_potential: clean.metrics?.viralPotential || clean.metrics?.viral_potential || 30,
          manipulation_score: clean.metrics?.manipulationScore || 0,
          toxicity_level: clean.metrics?.toxicityLevel || 0
        },
        pattern: clean.pattern || {
          cycle: `Advanced behavioral cycle mapped across ${messages.length} interactions`,
          prognosis: "Deep pattern analysis reveals psychological programming",
          escalation_detected: messages.length > 3,
          consistency_score: 85
        },
        viral_insights: clean.viralInsights || {
          mind_blowing_truth: "Behavioral patterns reveal unconscious psychological programming that drives all future interactions",
          quotable_wisdom: "Show me someone's patterns, and I'll show you their soul",
          psychology_explained: "Consistent communication patterns indicate deep-seated psychological drivers and unhealed wounds",
          power_move: "Break their expected pattern to disrupt their psychological programming"
        },
        attachment_analysis: clean.attachmentAnalysis || {
          target_style: "pattern-revealed attachment style",
          triggers_detected: ["recurring emotional patterns", "consistency indicators"],
          wound_exploited: "chronic psychological patterns indicate deep emotional wounds",
          healing_needed: "pattern interruption therapy and conscious communication training"
        },
        manipulation_map: clean.manipulationMap || {
          primary_tactic: "behavioral conditioning through pattern establishment",
          secondary_tactics: ["consistency pressure", "expectation management", "emotional conditioning"],
          counter_strategy: "systematic pattern disruption and boundary enforcement",
          future_patterns: "expect intensification of established patterns when disrupted"
        },
        ambiguity: null,
        // ENHANCED PATTERN-SPECIFIC FIELDS (matching original structure)
        hidden_agenda: clean.hiddenAgenda || clean.hidden_agenda,
        archetypes: clean.archetypes,
        trigger_pattern_map: clean.triggerPatternMap || clean.trigger_pattern_map,
        contradictions: clean.contradictions,
        weapons: clean.weapons,
        forecast: clean.forecast,
        counter_intervention: clean.counterIntervention || clean.counter_intervention,
        long_game: clean.longGame || clean.long_game
      }
    };

    console.log('🎯 DEDICATED PATTERN ANALYSIS COMPLETE - Behavioral blueprint decoded');
    res.status(200).json(response);
  } catch (error) {
    console.error('💥 PATTERN ERROR:', error);
    res.status(500).json({
      error: 'Pattern analysis failed',
      timestamp: new Date().toISOString()
    });
  }
};

// ENHANCED MENTOR CHAT ROUTE (left intact)
exports.mentorChat = async (req, res) => {
  // mentor is quick, but keep same protection for consistency
  res.setTimeout?.(125000);

  try {
    console.log('👑 VIRAL MENTOR ENGINE: Request received');
    console.log('📊 Mentor data:', req.body);

    const { mentor, user_text, userText, preset, options, userId } = req.body;

    // Handle both user_text and userText for compatibility
    const actualUserText = user_text || userText;

    if (!mentor || !actualUserText || !preset) {
      return res.status(400).json({
        error: 'Missing critical mentor parameters',
        required: ['mentor', 'user_text', 'preset'],
        received: {
          mentor: !!mentor,
          user_text: !!actualUserText,
          preset: !!preset
        }
      });
    }

    console.log(`👑 ${mentor.toUpperCase()} SUMMONED: ${preset} mode - "${actualUserText.substring(0, 50)}..."`);

    // Check if streaming is requested
    if (options?.stream) {
      // ENHANCED STREAMING RESPONSE (SSE)
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

      try {
        console.log('📡 STREAMING MODE: Generating legendary wisdom...');
        const mentorResponse = await getMentorResponse(mentor, actualUserText, preset, options);

        // Enhanced streaming with metadata
        res.write(`data: ${JSON.stringify({
          type: 'wisdom_incoming',
          mentor: mentor,
          preset: preset,
          timestamp: new Date().toISOString()
        })}\n\n`);

        // Send the actual wisdom
        res.write(`data: ${JSON.stringify({
          type: 'wisdom',
          text: mentorResponse.response,
          viral_score: mentorResponse.viralScore || 85,
          mentor: mentor
        })}\n\n`);

        // Send completion with metadata
        res.write(`data: ${JSON.stringify({
          type: 'complete',
          done: true,
          mentor: mentor,
          preset: preset,
          wisdom_delivered: true,
          timestamp: new Date().toISOString()
        })}\n\n`);

        res.end();
        console.log(`✨ ${mentor.toUpperCase()} WISDOM DELIVERED via stream`);
      } catch (error) {
        console.error('💥 STREAMING MENTOR ERROR:', error);
        res.write(`data: ${JSON.stringify({
          type: 'error',
          error: 'Mentor wisdom temporarily unavailable',
          fallback: true
        })}\n\n`);
        res.write(`data: ${JSON.stringify({
          type: 'complete',
          done: true
        })}\n\n`);
        res.end();
      }
    } else {
      // ENHANCED REGULAR JSON RESPONSE
      console.log('📜 STANDARD MODE: Generating wisdom response...');
      const mentorResponse = await getMentorResponse(mentor, actualUserText, preset, options);

      res.json({
        success: true,
        data: {
          ...mentorResponse,
          context: {
            mentor: mentor,
            preset: preset,
            user_query: actualUserText.substring(0, 100),
            response_type: 'legendary_wisdom',
            timestamp: new Date().toISOString()
          },
          metadata: {
            wisdom_level: 'legendary',
            viral_potential: mentorResponse.viralScore || 85,
            authenticity_score: 95,
            actionability: 90
          }
        },
        message: `${mentor.charAt(0).toUpperCase() + mentor.slice(1)} has spoken - wisdom delivered`
      });

      console.log(`✨ ${mentor.toUpperCase()} WISDOM DELIVERED via JSON`);
    }
  } catch (error) {
    console.error('💥 MENTOR CHAT ERROR:', error);
    res.status(500).json({
      error: 'Mentor wisdom temporarily unavailable',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal mentor error',
      timestamp: new Date().toISOString(),
      suggestion: 'The ancient wisdom requires a moment to channel properly'
    });
  }
};

module.exports = {
  unifiedAnalyze: exports.unifiedAnalyze,
  analyzeScan: exports.analyzeScan,
  analyzePattern: exports.analyzePattern,
  mentorChat: exports.mentorChat
};
