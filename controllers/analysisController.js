// controllers/analysisController.js - VIRAL MONSTER VERSION + SSE keep-alive for Analyze

const { analyzeWithAI, getMentorResponse } = require('../services/aiService');

// -------- helpers for SSE ----------
function startSSE(res) {
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Nginx: disable buffering
  const keepAlive = setInterval(() => {
    if (!res.writableEnded) res.write(`: ping\n\n`);
  }, 15000);
  const stop = () => clearInterval(keepAlive);
  return { stop };
}
function sse(res, obj) {
  res.write(`data: ${JSON.stringify(obj)}\n\n`);
}
function wantStream(reqBody, reqQuery) {
  if (reqBody?.options?.stream) return true;
  const q = (reqQuery?.stream ?? '').toString().trim();
  return q === '1' || q === 'true';
}

// UNIFIED ANALYZE ROUTE - Enhanced for viral-worthy insights, now with optional SSE
exports.unifiedAnalyze = async (req, res) => {
  res.setTimeout?.(125000);
  try {
    const { tab, message, messages, tone, relationship, content_type, subject_name, options } = req.body || {};
    const stream = wantStream(req.body, req.query);

    if (stream) {
      const { stop } = startSSE(res);
      sse(res, { type: 'meta', status: 'started', tab, ts: new Date().toISOString() });

      try {
        if (tab === 'scan' && message) {
          const analysisData = await analyzeWithAI(message, tone, 'scan');
          sse(res, { type: 'data', tab: 'scan', payload: buildScanResponse(analysisData, { relationship, tone, content_type, subject_name }) });
          sse(res, { type: 'complete', done: true });
          stop(); res.end(); return;
        } else if (tab === 'pattern' && messages && Array.isArray(messages)) {
          const combined = messages.map((m, i) => `[Message ${i + 1}]: ${m}`).join('\n---\n');
          const analysisData = await analyzeWithAI(combined, tone, 'pattern');
          sse(res, { type: 'data', tab: 'pattern', payload: buildPatternResponse(analysisData, { relationship, tone, content_type, subject_name, count: messages.length }) });
          sse(res, { type: 'complete', done: true });
          stop(); res.end(); return;
        } else {
          sse(res, { type: 'error', error: 'invalid_request', reason: 'Provide "tab":"scan" with message OR "tab":"pattern" with messages[]' });
          sse(res, { type: 'complete', done: true });
          stop(); res.end(); return;
        }
      } catch (e) {
        sse(res, { type: 'error', error: 'analyze_failed' });
        sse(res, { type: 'complete', done: true });
        stop(); res.end(); return;
      }
    }

    // -------- Normal JSON mode (unchanged shape) --------
    const { tab, message, messages, tone: _tone } = req.body;

    if (tab === 'scan' && message) {
      const analysisData = await analyzeWithAI(message, tone, 'scan');
      const response = buildScanResponse(analysisData, { relationship, tone, content_type, subject_name });
      return res.status(200).json({ success: true, data: response.data });
    } else if (tab === 'pattern' && messages && Array.isArray(messages)) {
      const combinedMessage = messages.map((msg, index) => `[Message ${index + 1}]: ${msg}`).join('\n---\n');
      const analysisData = await analyzeWithAI(combinedMessage, tone, 'pattern');
      const response = buildPatternResponse(analysisData, { relationship, tone, content_type, subject_name, count: messages.length });
      return res.status(200).json({ success: true, data: response.data });
    } else {
      return res.status(400).json({
        error: 'Invalid request format detected',
        details: 'For scan analysis: provide "tab": "scan" and "message". For pattern analysis: provide "tab": "pattern" and "messages" array.',
        received: { tab, hasMessage: !!message, hasMessages: !!messages, messageCount: messages ? messages.length : 0 }
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

// Helper to keep JSON response construction identical to your original
function buildScanResponse(analysisData, ctx) {
  const { relationship, tone, content_type, subject_name } = ctx || {};
  return {
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
      viral_insights: analysisData.viralInsights || analysisData.viral_insights || undefined,
      attachment_analysis: analysisData.attachmentAnalysis || analysisData.attachment_analysis || undefined,
      manipulation_map: analysisData.manipulationMap || analysisData.manipulation_map || undefined,
      pattern: null,
      ambiguity: null
    }
  };
}

function buildPatternResponse(analysisData, ctx) {
  const { relationship, tone, content_type, subject_name, count } = ctx || {};
  return {
    success: true,
    data: {
      context: {
        tab: 'pattern',
        relationship: relationship || 'Unknown',
        tone,
        content_type: content_type || 'dm',
        subject_name: subject_name || 'Subject',
        message_count: count,
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
        cycle: `Behavioral cycle detected across ${count} messages`,
        prognosis: 'Pattern analysis reveals communication trends',
        escalation_detected: false,
        consistency_score: 75
      },
      viral_insights: analysisData.viralInsights || analysisData.viral_insights || undefined,
      attachment_analysis: analysisData.attachmentAnalysis || analysisData.attachment_analysis || undefined,
      manipulation_map: analysisData.manipulationMap || analysisData.manipulation_map || undefined,
      ambiguity: null,
      hidden_agenda: analysisData.hiddenAgenda || analysisData.hidden_agenda,
      archetypes: analysisData.archetypes,
      trigger_pattern_map: analysisData.triggerPatternMap || analysisData.trigger_pattern_map,
      contradictions: analysisData.contradictions,
      weapons: analysisData.weapons,
      forecast: analysisData.forecast,
      counter_intervention: analysisData.counterIntervention || analysisData.counter_intervention,
      long_game: analysisData.longGame || analysisData.long_game
    }
  };
}

// Keep your dedicated routes as-is (optional: add the same stream switch there if you want)
exports.analyzeScan = exports.unifiedAnalyze;
exports.analyzePattern = exports.unifiedAnalyze;

// ENHANCED MENTOR CHAT ROUTE (unchanged from your working version)
exports.mentorChat = async (req, res) => {
  res.setTimeout?.(125000);
  try {
    const { mentor, user_text, userText, preset, options } = req.body;
    const actualUserText = user_text || userText;
    if (!mentor || !actualUserText || !preset) {
      return res.status(400).json({
        error: 'Missing critical mentor parameters',
        required: ['mentor', 'user_text', 'preset'],
        received: { mentor: !!mentor, user_text: !!actualUserText, preset: !!preset }
      });
    }

    if (options?.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

      try {
        const mentorResponse = await getMentorResponse(mentor, actualUserText, preset, options);
        sse(res, { type: 'wisdom_incoming', mentor, preset, timestamp: new Date().toISOString() });
        sse(res, { type: 'wisdom', text: mentorResponse.response, viral_score: mentorResponse.viralScore || 85, mentor });
        sse(res, { type: 'complete', done: true, mentor, preset, wisdom_delivered: true, timestamp: new Date().toISOString() });
        res.end();
      } catch (error) {
        sse(res, { type: 'error', error: 'Mentor wisdom temporarily unavailable', fallback: true });
        sse(res, { type: 'complete', done: true });
        res.end();
      }
    } else {
      const mentorResponse = await getMentorResponse(mentor, actualUserText, preset, options);
      res.json({
        success: true,
        data: {
          ...mentorResponse,
          context: {
            mentor,
            preset,
            user_query: actualUserText.substring(0, 100),
            response_type: 'legendary_wisdom',
            timestamp: new Date().toISOString()
          },
          metadata: { wisdom_level: 'legendary', viral_potential: mentorResponse.viralScore || 85, authenticity_score: 95, actionability: 90 }
        },
        message: `${mentor.charAt(0).toUpperCase() + mentor.slice(1)} has spoken - wisdom delivered`
      });
    }
  } catch (error) {
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
