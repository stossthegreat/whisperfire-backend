// controllers/analysisController.js — VIRAL MONSTER (stabilized + clean text)
// - UTF-8 headers on JSON paths
// - Mojibake scrub (Â / â€™ / etc) + bullet/markdown cleanup
// - Paragraph shaping so long fields read cleanly in the UI
// - Same output fields you already consume (no shape changes)

const { analyzeWithAI, getMentorResponse } = require('../services/aiService');

/* ───────── text cleaners (same DNA as mentor controller) ───────── */
function fixSmartQuotes(s = '') {
  return String(s)
    .replace(/Â+/g, '')                             // stray Â
    .replace(/â€™|Ã¢â‚¬â„¢|â\u0080\u0099/g, "'")   // right single
    .replace(/â€˜|Ã¢â‚¬Ëœ|â\u0080\u0098/g, "'")    // left single
    .replace(/â€œ|Ã¢â‚¬Å“|â\u0080\u009C/g, '"')    // left double
    .replace(/â€�|Ã¢â‚¬Â|â\u0080\u009D/g, '"')    // right double
    .replace(/â€”|Ã¢â‚¬â¢|â\u0080\u0094/g, '—')  // em dash
    .replace(/â€“|Ã¢â‚¬â€œ|â\u0080\u0093/g, '–')   // en dash
    .replace(/\u00A0/g, ' ');                      // NBSP → space
}
function stripWeirdGlyphs(s = '') {
  return String(s)
    .replace(/[\u200B-\u200D\uFEFF]/g, '')         // zero-width junk
    .replace(/^[\*\u2022\-]{1,2}\s*/gm, '')        // leading bullets
    .replace(/[>`_#]/g, '');                       // stray md tokens
}
function paragraphize(s = '') {
  let t = fixSmartQuotes(stripWeirdGlyphs(String(s)));

  // Insert a space if punctuation glues to a Capital/quote
  t = t.replace(/([a-z0-9])([.!?])([A-Z"'])/g, '$1$2 $3');

  // Break around common labels so sections start on new lines
  t = t.replace(/\s*(?=(?:Headline:|Analysis:|Mistake:|Rewrite:|Why:|Principle:|Next|Diagnosis:|Psychology:|Plays|Lines:|Close:|Boundary|Recovery))/g, '\n\n');

  // Encourage readable paragraphs after sentence stops
  t = t.replace(/([.!?])\s+(?=[A-Z0-9"'\(])/g, '$1\n\n');

  // Normalize whitespace
  t = t.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n');
  return t.trim();
}
function deepClean(x) {
  if (x == null) return x;
  if (typeof x === 'string') return paragraphize(x);
  if (Array.isArray(x)) return x.map(deepClean);
  if (typeof x === 'object') {
    const o = {};
    for (const k of Object.keys(x)) o[k] = deepClean(x[k]);
    return o;
  }
  return x;
}
function setJsonUtf8(res) {
  if (!res.headersSent) res.setHeader('Content-Type', 'application/json; charset=utf-8');
}

/* ───────── UNIFIED ROUTE ───────── */
exports.unifiedAnalyze = async (req, res) => {
  // Give Together enough time; avoids server-side timeout
  res.setTimeout?.(125000);

  try {
    const { tab, message, messages, tone, relationship, content_type, subject_name } = req.body || {};
    console.log('🚀 ANALYZE unified →', { tab, tone, hasMessage: !!message, msgCount: Array.isArray(messages) ? messages.length : 0 });

    if (tab === 'scan' && message) {
      const analysisData = await analyzeWithAI(message, tone, 'scan');

      // Clean everything for spacing / glyphs
      const cleaned = deepClean(analysisData);

      const response = {
        success: true,
        data: {
          context: {
            tab: 'scan',
            relationship: relationship || 'Unknown',
            tone,
            content_type: content_type || 'dm',
            subject_name: subject_name || 'Subject',
            timestamp: new Date().toISOString(),
            analysis_type: 'Single Message Deep Dive'
          },
          headline: cleaned.headline,
          core_take: cleaned.coreTake || cleaned.core_take,
          tactic: cleaned.tactic,
          motives: cleaned.motives,
          targeting: cleaned.targeting,
          power_play: cleaned.powerPlay || cleaned.power_play,
          receipts: cleaned.receipts,
          next_moves: cleaned.nextMoves || cleaned.next_moves,
          suggested_reply: cleaned.suggestedReply || cleaned.suggested_reply,
          safety: {
            risk_level: cleaned.safety?.riskLevel || cleaned.safety?.risk_level || 'LOW',
            notes: cleaned.safety?.notes || 'Standard communication detected'
          },
          metrics: {
            red_flag: cleaned.metrics?.redFlag || cleaned.metrics?.red_flag || 15,
            certainty: cleaned.metrics?.certainty || 70,
            viral_potential: cleaned.metrics?.viralPotential || cleaned.metrics?.viral_potential || 25,
            manipulation_score: cleaned.metrics?.manipulationScore || cleaned.metrics?.manipulation_score || 0,
            toxicity_level: cleaned.metrics?.toxicityLevel || cleaned.metrics?.toxicity_level || 0
          },
          // Keep your extra blocks; cleaned for spacing
          viral_insights: cleaned.viralInsights || cleaned.viral_insights || {
            mind_blowing_truth: 'Deep psychological patterns detected',
            quotable_wisdom: "Every message reveals the sender's deepest fears",
            psychology_explained: 'Communication patterns reveal unconscious motivations',
            power_move: 'Respond strategically, not emotionally'
          },
          attachment_analysis: cleaned.attachmentAnalysis || cleaned.attachment_analysis || {
            target_style: 'analyzing',
            triggers_detected: ['emotional hooks', 'validation seeking'],
            wound_exploited: 'fear of rejection or abandonment',
            healing_needed: 'secure communication patterns'
          },
          manipulation_map: cleaned.manipulationMap || cleaned.manipulation_map || {
            primary_tactic: 'standard communication',
            secondary_tactics: ['emotional appeals'],
            counter_strategy: 'maintain boundaries and respond authentically',
            future_patterns: 'monitor for escalation or de-escalation'
          },
          pattern: null,
          ambiguity: null
        }
      };

      setJsonUtf8(res);
      return res.status(200).json(response);
    }

    if (tab === 'pattern' && messages && Array.isArray(messages)) {
      const combinedMessage = messages.map((msg, i) => `[Message ${i + 1}]: ${msg}`).join('\n---\n');
      const analysisData = await analyzeWithAI(combinedMessage, tone, 'pattern');

      const cleaned = deepClean(analysisData);

      const response = {
        success: true,
        data: {
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
          headline: cleaned.headline,
          core_take: cleaned.coreTake || cleaned.core_take,
          tactic: cleaned.tactic,
          motives: cleaned.motives,
          targeting: cleaned.targeting,
          power_play: cleaned.powerPlay || cleaned.power_play,
          receipts: cleaned.receipts,
          next_moves: cleaned.nextMoves || cleaned.next_moves,
          suggested_reply: cleaned.suggestedReply || cleaned.suggested_reply,
          safety: {
            risk_level: cleaned.safety?.riskLevel || cleaned.safety?.risk_level || 'LOW',
            notes: cleaned.safety?.notes || 'Pattern analysis complete'
          },
          metrics: {
            red_flag: cleaned.metrics?.redFlag || cleaned.metrics?.red_flag || 20,
            certainty: cleaned.metrics?.certainty || 80,
            viral_potential: cleaned.metrics?.viralPotential || cleaned.metrics?.viral_potential || 30,
            manipulation_score: cleaned.metrics?.manipulationScore || cleaned.metrics?.manipulation_score || 0,
            toxicity_level: cleaned.metrics?.toxicityLevel || cleaned.metrics?.toxicity_level || 0
          },
          pattern: cleaned.pattern || {
            cycle: `Behavioral cycle detected across ${messages.length} messages`,
            prognosis: 'Pattern analysis reveals communication trends',
            escalation_detected: false,
            consistency_score: 75
          },
          viral_insights: cleaned.viralInsights || cleaned.viral_insights || {
            mind_blowing_truth: 'Recurring patterns reveal deeper psychological programming',
            quotable_wisdom: "People don't change their communication - they reveal who they are",
            psychology_explained: 'Consistent communication patterns indicate core personality traits and attachment styles',
            power_move: 'Use pattern recognition to predict and prepare for future interactions'
          },
          attachment_analysis: cleaned.attachmentAnalysis || cleaned.attachment_analysis || {
            target_style: 'pattern-based assessment',
            triggers_detected: ['consistency markers', 'escalation points'],
            wound_exploited: 'chronic insecurity or control needs',
            healing_needed: 'pattern interruption and conscious communication'
          },
          manipulation_map: cleaned.manipulationMap || cleaned.manipulation_map || {
            primary_tactic: 'behavioral consistency',
            secondary_tactics: ['pattern establishment', 'expectation setting'],
            counter_strategy: 'break expected response patterns to disrupt manipulation cycles',
            future_patterns: 'expect continuation of established behavioral trends'
          },
          ambiguity: null,
          hidden_agenda: cleaned.hiddenAgenda || cleaned.hidden_agenda,
          archetypes: cleaned.archetypes,
          trigger_pattern_map: cleaned.triggerPatternMap || cleaned.trigger_pattern_map,
          contradictions: cleaned.contradictions,
          weapons: cleaned.weapons,
          forecast: cleaned.forecast,
          counter_intervention: cleaned.counterIntervention || cleaned.counter_intervention,
          long_game: cleaned.longGame || cleaned.long_game
        }
      };

      setJsonUtf8(res);
      return res.status(200).json(response);
    }

    // Bad input
    setJsonUtf8(res);
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
  } catch (error) {
    console.error('💥 UNIFIED ANALYSIS ERROR:', error?.message || error);
    setJsonUtf8(res);
    return res.status(500).json({
      error: 'Analysis engine encountered an error',
      details: process.env.NODE_ENV === 'development' ? String(error.message || error) : 'Internal processing error',
      timestamp: new Date().toISOString()
    });
  }
};

/* ───────── Dedicated Scan: same cleaning ───────── */
exports.analyzeScan = async (req, res) => {
  res.setTimeout?.(125000);
  try {
    const { message, tone, relationship, content_type, subject_name } = req.body || {};
    if (!message || !tone) {
      setJsonUtf8(res);
      return res.status(400).json({
        error: 'Missing critical analysis parameters',
        required: ['message', 'tone'],
        received: { message: !!message, tone: !!tone }
      });
    }

    const analysisData = await analyzeWithAI(message, tone, 'scan');
    const cleaned = deepClean(analysisData);

    setJsonUtf8(res);
    return res.status(200).json({
      success: true,
      data: {
        context: {
          tab: 'scan',
          relationship: relationship || 'Unknown',
          tone,
          content_type: content_type || 'dm',
          subject_name: subject_name || 'Subject',
          analysis_depth: 'deep_psychological_scan',
          timestamp: new Date().toISOString()
        },
        headline: cleaned.headline,
        core_take: cleaned.coreTake || cleaned.core_take,
        tactic: cleaned.tactic,
        motives: cleaned.motives,
        targeting: cleaned.targeting,
        power_play: cleaned.powerPlay || cleaned.power_play,
        receipts: cleaned.receipts,
        next_moves: cleaned.nextMoves || cleaned.next_moves,
        suggested_reply: cleaned.suggestedReply || cleaned.suggested_reply,
        safety: {
          risk_level: cleaned.safety?.riskLevel || cleaned.safety?.risk_level || 'LOW',
          notes: cleaned.safety?.notes || 'Psychological scan complete'
        },
        metrics: {
          red_flag: cleaned.metrics?.redFlag || cleaned.metrics?.red_flag || 15,
          certainty: cleaned.metrics?.certainty || 70,
          viral_potential: cleaned.metrics?.viralPotential || cleaned.metrics?.viral_potential || 25,
          manipulation_score: cleaned.metrics?.manipulationScore || 0,
          toxicity_level: cleaned.metrics?.toxicityLevel || 0
        },
        viral_insights: cleaned.viralInsights,
        attachment_analysis: cleaned.attachmentAnalysis,
        manipulation_map: cleaned.manipulationMap,
        pattern: null,
        ambiguity: null
      }
    });
  } catch (error) {
    console.error('💥 SCAN ERROR:', error?.message || error);
    setJsonUtf8(res);
    return res.status(500).json({ error: 'Scan analysis failed', timestamp: new Date().toISOString() });
  }
};

/* ───────── Dedicated Pattern: same cleaning ───────── */
exports.analyzePattern = async (req, res) => {
  res.setTimeout?.(125000);
  try {
    const { messages, tone, relationship, content_type, subject_name } = req.body || {};
    if (!messages || !Array.isArray(messages) || messages.length === 0 || !tone) {
      setJsonUtf8(res);
      return res.status(400).json({
        error: 'Invalid pattern analysis request',
        required: 'messages array (non-empty) and tone',
        received: { hasMessages: !!messages, isArray: Array.isArray(messages), messageCount: messages ? messages.length : 0, tone: !!tone }
      });
    }

    const combinedMessage = messages.map((msg, i) => `[Pattern Message ${i + 1}]: ${msg}`).join('\n---PATTERN BREAK---\n');
    const analysisData = await analyzeWithAI(combinedMessage, tone, 'pattern');
    const cleaned = deepClean(analysisData);

    setJsonUtf8(res);
    return res.status(200).json({
      success: true,
      data: {
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
        headline: cleaned.headline,
        core_take: cleaned.coreTake || cleaned.core_take,
        tactic: cleaned.tactic,
        motives: cleaned.motives,
        targeting: cleaned.targeting,
        power_play: cleaned.powerPlay || cleaned.power_play,
        receipts: cleaned.receipts,
        next_moves: cleaned.nextMoves || cleaned.next_moves,
        suggested_reply: cleaned.suggestedReply || cleaned.suggested_reply,
        safety: {
          risk_level: cleaned.safety?.riskLevel || cleaned.safety?.risk_level || 'LOW',
          notes: cleaned.safety?.notes || 'Deep pattern analysis complete'
        },
        metrics: {
          red_flag: cleaned.metrics?.redFlag || cleaned.metrics?.red_flag || 20,
          certainty: cleaned.metrics?.certainty || 80,
          viral_potential: cleaned.metrics?.viralPotential || cleaned.metrics?.viral_potential || 30,
          manipulation_score: cleaned.metrics?.manipulationScore || 0,
          toxicity_level: cleaned.metrics?.toxicityLevel || 0
        },
        pattern: cleaned.pattern || {
          cycle: `Advanced behavioral cycle mapped across ${messages.length} interactions`,
          prognosis: 'Deep pattern analysis reveals psychological programming',
          escalation_detected: messages.length > 3,
          consistency_score: 85
        },
        viral_insights: cleaned.viralInsights,
        attachment_analysis: cleaned.attachmentAnalysis,
        manipulation_map: cleaned.manipulationMap,
        ambiguity: null,
        hidden_agenda: cleaned.hiddenAgenda || cleaned.hidden_agenda,
        archetypes: cleaned.archetypes,
        trigger_pattern_map: cleaned.triggerPatternMap || cleaned.trigger_pattern_map,
        contradictions: cleaned.contradictions,
        weapons: cleaned.weapons,
        forecast: cleaned.forecast,
        counter_intervention: cleaned.counterIntervention || cleaned.counter_intervention,
        long_game: cleaned.longGame || cleaned.long_game
      }
    });
  } catch (error) {
    console.error('💥 PATTERN ERROR:', error?.message || error);
    setJsonUtf8(res);
    return res.status(500).json({ error: 'Pattern analysis failed', timestamp: new Date().toISOString() });
  }
};

/* ───────── Mentor passthrough (unchanged) ───────── */
exports.mentorChat = async (req, res) => {
  res.setTimeout?.(125000);
  try {
    const { mentor, user_text, userText, preset, options } = req.body || {};
    const actualUserText = user_text || userText;

    if (!mentor || !actualUserText || !preset) {
      setJsonUtf8(res);
      return res.status(400).json({
        error: 'Missing critical mentor parameters',
        required: ['mentor', 'user_text', 'preset'],
        received: { mentor: !!mentor, user_text: !!actualUserText, preset: !!preset }
      });
    }

    if (options?.stream) {
      res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

      try {
        const mentorResponse = await getMentorResponse(mentor, actualUserText, preset, options);
        res.write(`data: ${JSON.stringify({ type: 'wisdom_incoming', mentor, preset, timestamp: new Date().toISOString() })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'wisdom', text: paragraphize(mentorResponse.response), viral_score: mentorResponse.viralScore || 85, mentor })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'complete', done: true, mentor, preset, wisdom_delivered: true, timestamp: new Date().toISOString() })}\n\n`);
        res.end();
      } catch (error) {
        res.write(`data: ${JSON.stringify({ type: 'error', error: 'Mentor wisdom temporarily unavailable', fallback: true })}\n\n`);
        res.write(`data: ${JSON.stringify({ type: 'complete', done: true })}\n\n`);
        res.end();
      }
    } else {
      const mentorResponse = await getMentorResponse(mentor, actualUserText, preset, options);
      setJsonUtf8(res);
      return res.json({
        success: true,
        data: {
          ...mentorResponse,
          context: {
            mentor,
            preset,
            user_query: String(actualUserText).substring(0, 100),
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
    }
  } catch (error) {
    setJsonUtf8(res);
    return res.status(500).json({
      error: 'Mentor wisdom temporarily unavailable',
      details: process.env.NODE_ENV === 'development' ? String(error.message || error) : 'Internal mentor error',
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
