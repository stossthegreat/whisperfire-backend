// controllers/analysisController.js — VIRAL MONSTER (UTF-8, paragraph clean, strict tab)

const { analyzeWithAI, getMentorResponse, toCleanText } = require('../services/aiService');

// ---------- helpers: clean strings on selected keys ----------
function cleanStr(v) {
  if (typeof v !== 'string') return v;
  return toCleanText(v);
}
function cleanFields(obj, keys) {
  if (!obj || typeof obj !== 'object') return obj;
  keys.forEach(k => {
    if (typeof obj[k] === 'string') obj[k] = cleanStr(obj[k]);
  });
  return obj;
}
function cleanResultPayload(result) {
  if (!result || typeof result !== 'object') return result;

  // Top-level strings we render
  cleanFields(result, ['headline', 'core_take', 'power_play', 'next_moves', 'counter_intervention']);

  // receipts: array of strings
  if (Array.isArray(result.receipts)) {
    result.receipts = result.receipts.map(s => cleanStr(s));
  }

  // suggested_reply
  if (result.suggested_reply && typeof result.suggested_reply === 'object') {
    cleanFields(result.suggested_reply, ['text', 'style']);
  }

  // pattern subfields commonly shown
  if (result.pattern && typeof result.pattern === 'object') {
    cleanFields(result.pattern, ['cycle', 'prognosis']);
  }

  return result;
}

// UNIFIED ANALYZE ROUTE - Enhanced for viral-worthy insights
exports.unifiedAnalyze = async (req, res) => {
  try {
    console.log('🚀 VIRAL ANALYSIS ENGINE: Unified request received');
    console.log('📊 Request data:', req.body);

    const { tab, message, messages, tone, relationship, content_type, subject_name } = req.body;

    // Hard gate: only allow exactly the requested tab; never run both.
    if (tab === 'scan' && message) {
      console.log(`🔍 SCAN ANALYSIS: Processing "${String(message).slice(0, 120)}" tone=${tone}`);

      // one tab only
      const analysisData = await analyzeWithAI(message, tone, 'scan');

      // normalize naming variations
      const data = {
        context: {
          tab: 'scan',
          relationship: relationship || 'Unknown',
          tone,
          content_type: content_type || 'dm',
          subject_name: subject_name || 'Subject',
          timestamp: new Date().toISOString(),
          analysis_type: 'Single Message Deep Dive'
        },
        headline: analysisData.headline,
        core_take: analysisData.coreTake || analysisData.core_take,
        tactic: analysisData.tactic,
        motives: analysisData.motives,
        targeting: analysisData.targeting,
        power_play: analysisData.powerPlay || analysisData.power_play,
        receipts: analysisData.receipts,
        next_moves: analysisData.nextMoves || analysisData.next_moves,
        suggested_reply: analysisData.suggestedReply || analysisData.suggested_reply,
        safety: {
          risk_level: analysisData.safety?.riskLevel || analysisData.safety?.risk_level || 'LOW',
          notes: analysisData.safety?.notes || 'Standard communication detected'
        },
        metrics: {
          red_flag: analysisData.metrics?.redFlag || analysisData.metrics?.red_flag || 15,
          certainty: analysisData.metrics?.certainty || 70,
          viral_potential: analysisData.metrics?.viralPotential || analysisData.metrics?.viral_potential || 25,
          manipulation_score: analysisData.metrics?.manipulationScore || analysisData.metrics?.manipulation_score || 0,
          toxicity_level: analysisData.metrics?.toxicityLevel || analysisData.metrics?.toxicity_level || 0
        },
        // VIRAL ENHANCEMENTS (keep your shape)
        viral_insights: analysisData.viralInsights || analysisData.viral_insights || {
          mind_blowing_truth: 'Deep psychological patterns detected',
          quotable_wisdom: "Every message reveals the sender's deepest fears",
          psychology_explained: 'Communication patterns reveal unconscious motivations',
          power_move: 'Respond strategically, not emotionally'
        },
        attachment_analysis: analysisData.attachmentAnalysis || analysisData.attachment_analysis || {
          target_style: 'analyzing',
          triggers_detected: ['emotional hooks', 'validation seeking'],
          wound_exploited: 'fear of rejection or abandonment',
          healing_needed: 'secure communication patterns'
        },
        manipulation_map: analysisData.manipulationMap || analysisData.manipulation_map || {
          primary_tactic: 'standard communication',
          secondary_tactics: ['emotional appeals'],
          counter_strategy: 'maintain boundaries and respond authentically',
          future_patterns: 'monitor for escalation or de-escalation'
        },
        pattern: null,
        ambiguity: null
      };

      // Clean mojibake + paragraphs before sending
      cleanResultPayload(data);

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      console.log('✨ SCAN ANALYSIS COMPLETE - Viral insights generated');
      return res.status(200).json({ success: true, data });

    } else if (tab === 'pattern' && messages && Array.isArray(messages)) {
      console.log(`🔄 PATTERN ANALYSIS: Processing ${messages.length} messages`);

      const combinedMessage = messages
        .map((msg, index) => `[Message ${index + 1}]: ${msg}`)
        .join('\n---\n');

      // one tab only
      const analysisData = await analyzeWithAI(combinedMessage, tone, 'pattern');

      const data = {
        context: {
          tab: 'pattern',
          relationship: relationship || 'Unknown',
          tone,
          content_type: content_type || 'dm',
          subject_name: subject_name || 'Subject',
          message_count: messages.length,
          timestamp: new Date().toISOString(),
          analysis_type: 'Multi-Message Pattern Analysis'
        },
        headline: analysisData.headline,
        core_take: analysisData.coreTake || analysisData.core_take,
        tactic: analysisData.tactic,
        motives: analysisData.motives,
        targeting: analysisData.targeting,
        power_play: analysisData.powerPlay || analysisData.power_play,
        receipts: analysisData.receipts,
        next_moves: analysisData.nextMoves || analysisData.next_moves,
        suggested_reply: analysisData.suggestedReply || analysisData.suggested_reply,
        safety: {
          risk_level: analysisData.safety?.riskLevel || analysisData.safety?.risk_level || 'LOW',
          notes: analysisData.safety?.notes || 'Pattern analysis complete'
        },
        metrics: {
          red_flag: analysisData.metrics?.redFlag || analysisData.metrics?.red_flag || 20,
          certainty: analysisData.metrics?.certainty || 80,
          viral_potential: analysisData.metrics?.viralPotential || analysisData.metrics?.viral_potential || 30,
          manipulation_score: analysisData.metrics?.manipulationScore || analysisData.metrics?.manipulation_score || 0,
          toxicity_level: analysisData.metrics?.toxicityLevel || analysisData.metrics?.toxicity_level || 0
        },
        pattern: analysisData.pattern || {
          cycle: `Behavioral cycle detected across ${messages.length} messages`,
          prognosis: 'Pattern analysis reveals communication trends',
          escalation_detected: false,
          consistency_score: 75
        },
        // VIRAL ENHANCEMENTS
        viral_insights: analysisData.viralInsights || analysisData.viral_insights || {
          mind_blowing_truth: 'Recurring patterns reveal deeper psychological programming',
          quotable_wisdom: "People don't change their communication - they reveal who they are",
          psychology_explained: 'Consistent patterns indicate core personality traits and attachment styles',
          power_move: 'Use pattern recognition to predict and prepare for future interactions'
        },
        attachment_analysis: analysisData.attachmentAnalysis || analysisData.attachment_analysis || {
          target_style: 'pattern-based assessment',
          triggers_detected: ['consistency markers', 'escalation points'],
          wound_exploited: 'chronic insecurity or control needs',
          healing_needed: 'pattern interruption and conscious communication'
        },
        manipulation_map: analysisData.manipulationMap || analysisData.manipulation_map || {
          primary_tactic: 'behavioral consistency',
          secondary_tactics: ['pattern establishment', 'expectation setting'],
          counter_strategy: 'break expected response patterns to disrupt manipulation cycles',
          future_patterns: 'expect continuation of established behavioral trends'
        },
        ambiguity: null,
        // keep your extended fields
        hidden_agenda: analysisData.hiddenAgenda || analysisData.hidden_agenda,
        archetypes: analysisData.archetypes,
        trigger_pattern_map: analysisData.triggerPatternMap || analysisData.trigger_pattern_map,
        contradictions: analysisData.contradictions,
        weapons: analysisData.weapons,
        forecast: analysisData.forecast,
        counter_intervention: analysisData.counterIntervention || analysisData.counter_intervention,
        long_game: analysisData.longGame || analysisData.long_game
      };

      cleanResultPayload(data);

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      console.log('🎯 PATTERN ANALYSIS COMPLETE - Behavioral insights unlocked');
      return res.status(200).json({ success: true, data });

    } else {
      console.log('❌ INVALID REQUEST FORMAT');
      return res.status(400).json({
        error: 'Invalid request format detected',
        details:
          'For scan analysis: provide "tab": "scan" and "message". For pattern analysis: provide "tab": "pattern" and "messages" array.',
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
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(500).json({
      error: 'Analysis engine encountered an error',
      details: process.env.NODE_ENV === 'development' ? error.message : 'Internal processing error',
      timestamp: new Date().toISOString()
    });
  }
};

// ENHANCED SEPARATE SCAN ROUTE
exports.analyzeScan = async (req, res) => {
  try {
    const { message, tone, relationship, content_type, subject_name } = req.body;

    if (!message || !tone) {
      return res.status(400).json({
        error: 'Missing critical analysis parameters',
        required: ['message', 'tone'],
        received: { message: !!message, tone: !!tone }
      });
    }

    console.log(`🔍 DEDICATED SCAN: "${String(message).slice(0, 120)}" tone=${tone}`);

    const analysisData = await analyzeWithAI(message, tone, 'scan');

    const data = {
      context: {
        tab: 'scan',
        relationship: relationship || 'Unknown',
        tone,
        content_type: content_type || 'dm',
        subject_name: subject_name || 'Subject',
        analysis_depth: 'deep_psychological_scan',
        timestamp: new Date().toISOString()
      },
      headline: analysisData.headline,
      core_take: analysisData.coreTake || analysisData.core_take,
      tactic: analysisData.tactic,
      motives: analysisData.motives,
      targeting: analysisData.targeting,
      power_play: analysisData.powerPlay || analysisData.power_play,
      receipts: analysisData.receipts,
      next_moves: analysisData.nextMoves || analysisData.next_moves,
      suggested_reply: analysisData.suggestedReply || analysisData.suggested_reply,
      safety: {
        risk_level: analysisData.safety?.riskLevel || analysisData.safety?.risk_level || 'LOW',
        notes: analysisData.safety?.notes || 'Psychological scan complete'
      },
      metrics: {
        red_flag: analysisData.metrics?.redFlag || analysisData.metrics?.red_flag || 15,
        certainty: analysisData.metrics?.certainty || 70,
        viral_potential: analysisData.metrics?.viralPotential || analysisData.metrics?.viral_potential || 25,
        manipulation_score: analysisData.metrics?.manipulationScore || 0,
        toxicity_level: analysisData.metrics?.toxicityLevel || 0
      },
      viral_insights: analysisData.viralInsights || {
        mind_blowing_truth: 'Single message analysis reveals core communication patterns',
        quotable_wisdom: "Every word choice reveals unconscious psychological states",
        psychology_explained: 'Message structure indicates underlying emotional drivers',
        power_move: 'Respond to the psychology, not just the words'
      },
      attachment_analysis: analysisData.attachmentAnalysis || {
        target_style: 'single-message assessment',
        triggers_detected: ['emotional markers detected'],
        wound_exploited: 'analyzing for psychological vulnerabilities',
        healing_needed: 'conscious communication practices'
      },
      manipulation_map: analysisData.manipulationMap || {
        primary_tactic: 'message-level analysis',
        secondary_tactics: ['word choice patterns'],
        counter_strategy: 'strategic response to underlying psychology',
        future_patterns: 'monitor for escalation or pattern development'
      },
      pattern: null,
      ambiguity: null
    };

    cleanResultPayload(data);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    console.log('✨ DEDICATED SCAN COMPLETE');
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('💥 SCAN ERROR:', error);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(500).json({
      error: 'Scan analysis failed',
      timestamp: new Date().toISOString()
    });
  }
};

// ENHANCED SEPARATE PATTERN ROUTE
exports.analyzePattern = async (req, res) => {
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

    console.log(`🔄 DEDICATED PATTERN: ${messages.length} messages`);

    const combinedMessage = messages
      .map((msg, index) => `[Pattern Message ${index + 1}]: ${msg}`)
      .join('\n---PATTERN BREAK---\n');

    const analysisData = await analyzeWithAI(combinedMessage, tone, 'pattern');

    const data = {
      context: {
        tab: 'pattern',
        relationship: relationship || 'Unknown',
        tone,
        content_type: content_type || 'dm',
        subject_name: subject_name || 'Subject',
        message_count: messages.length,
        analysis_depth: 'deep_behavioral_pattern_analysis',
        timestamp: new Date().toISOString()
      },
      headline: analysisData.headline,
      core_take: analysisData.coreTake || analysisData.core_take,
      tactic: analysisData.tactic,
      motives: analysisData.motives,
      targeting: analysisData.targeting,
      power_play: analysisData.powerPlay || analysisData.power_play,
      receipts: analysisData.receipts,
      next_moves: analysisData.nextMoves || analysisData.next_moves,
      suggested_reply: analysisData.suggestedReply || analysisData.suggested_reply,
      safety: {
        risk_level: analysisData.safety?.riskLevel || analysisData.safety?.risk_level || 'LOW',
        notes: analysisData.safety?.notes || 'Deep pattern analysis complete'
      },
      metrics: {
        red_flag: analysisData.metrics?.redFlag || analysisData.metrics?.red_flag || 20,
        certainty: analysisData.metrics?.certainty || 80,
        viral_potential: analysisData.metrics?.viralPotential || analysisData.metrics?.viral_potential || 30,
        manipulation_score: analysisData.metrics?.manipulationScore || 0,
        toxicity_level: analysisData.metrics?.toxicityLevel || 0
      },
      pattern: analysisData.pattern || {
        cycle: `Advanced behavioral cycle mapped across ${messages.length} interactions`,
        prognosis: 'Deep pattern analysis reveals psychological programming',
        escalation_detected: messages.length > 3,
        consistency_score: 85
      },
      viral_insights: analysisData.viralInsights || {
        mind_blowing_truth: 'Behavioral patterns reveal unconscious psychological programming that drives all future interactions',
        quotable_wisdom: "Show me someone's patterns, and I'll show you their soul",
        psychology_explained: 'Consistent communication patterns indicate deep-seated psychological drivers and unhealed wounds',
        power_move: 'Break their expected pattern to disrupt their psychological programming'
      },
      attachment_analysis: analysisData.attachmentAnalysis || {
        target_style: 'pattern-revealed attachment style',
        triggers_detected: ['recurring emotional patterns', 'consistency indicators'],
        wound_exploited: 'chronic psychological patterns indicate deep emotional wounds',
        healing_needed: 'pattern interruption therapy and conscious communication training'
      },
      manipulation_map: analysisData.manipulationMap || {
        primary_tactic: 'behavioral conditioning through pattern establishment',
        secondary_tactics: ['consistency pressure', 'expectation management', 'emotional conditioning'],
        counter_strategy: 'systematic pattern disruption and boundary enforcement',
        future_patterns: 'expect intensification of established patterns when disrupted'
      },
      ambiguity: null,
      // extended fields
      hidden_agenda: analysisData.hiddenAgenda || analysisData.hidden_agenda,
      archetypes: analysisData.archetypes,
      trigger_pattern_map: analysisData.triggerPatternMap || analysisData.trigger_pattern_map,
      contradictions: analysisData.contradictions,
      weapons: analysisData.weapons,
      forecast: analysisData.forecast,
      counter_intervention: analysisData.counterIntervention || analysisData.counter_intervention,
      long_game: analysisData.longGame || analysisData.long_game
    };

    cleanResultPayload(data);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    console.log('🎯 DEDICATED PATTERN ANALYSIS COMPLETE - Behavioral blueprint decoded');
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('💥 PATTERN ERROR:', error);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(500).json({
      error: 'Pattern analysis failed',
      timestamp: new Date().toISOString()
    });
  }
};

// ENHANCED MENTOR CHAT ROUTE
exports.mentorChat = async (req, res) => {
  try {
    console.log('👑 VIRAL MENTOR ENGINE: Request received');
    console.log('📊 Mentor data:', req.body);

    const { mentor, user_text, userText, preset, options } = req.body;

    // Handle both user_text and userText for compatibility
    const actualUserText = user_text || userText;

    if (!mentor || !actualUserText || !preset) {
      return res.status(400).json({
        error: 'Missing critical mentor parameters',
        required: ['mentor', 'user_text', 'preset'],
        received: { mentor: !!mentor, user_text: !!actualUserText, preset: !!preset }
      });
    }

    console.log(`👑 ${String(mentor).toUpperCase()} SUMMONED: ${preset} mode - "${String(actualUserText).slice(0, 100)}..."`);

    // STREAMING?
    if (options?.stream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

      try {
        const mentorResponse = await getMentorResponse(mentor, actualUserText, preset, options);
        const clean = toCleanText(mentorResponse.response);

        res.write(`data: ${JSON.stringify({ type: 'wisdom_incoming', mentor, preset, timestamp: new Date().toISOString() })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'wisdom', text: clean, viral_score: mentorResponse.viralScore || 85, mentor })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'complete', done: true, mentor, preset, wisdom_delivered: true, timestamp: new Date().toISOString() })}\n\n`);
        res.end();
        console.log(`✨ ${String(mentor).toUpperCase()} WISDOM DELIVERED via stream`);
      } catch (error) {
        console.error('💥 STREAMING MENTOR ERROR:', error);
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'Mentor wisdom temporarily unavailable', fallback: true })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'complete', done: true })}\n\n`);
        res.end();
      }
    } else {
      // JSON RESPONSE
      const mentorResponse = await getMentorResponse(mentor, actualUserText, preset, options);
      const clean = toCleanText(mentorResponse.response);

      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.json({
        success: true,
        data: {
          ...mentorResponse,
          response: clean,
          context: {
            mentor,
            preset,
            user_query: String(actualUserText).slice(0, 200),
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

      console.log(`✨ ${String(mentor).toUpperCase()} WISDOM DELIVERED via JSON`);
    }
  } catch (error) {
    console.error('💥 MENTOR CHAT ERROR:', error);
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
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
