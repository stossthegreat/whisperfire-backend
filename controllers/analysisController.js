// controllers/analysisController.js

const { analyzeWithAI, getMentorResponse } = require('../services/aiService');

// UNIFIED ANALYZE ROUTE - Handles both scan and pattern based on 'tab' field
exports.unifiedAnalyze = async (req, res) => {
    try {
        console.log('Unified analyze request received:', req.body);
        
        const { tab, message, messages, tone, relationship, content_type, subject_name } = req.body;

        if (tab === 'scan' && message) {
            // Handle scan analysis
            console.log(`Processing SCAN analysis: "${message}" with tone: ${tone}`);
            
            const analysisData = await analyzeWithAI(message, tone, 'scan');
            
            const response = {
                success: true,
                data: {
                    context: {
                        tab: 'scan',
                        relationship: relationship || 'Partner',
                        tone: tone,
                        contentType: content_type || 'dm',
                        subjectName: subject_name
                    },
                    ...analysisData
                }
            };
            
            return res.status(200).json(response);
            
        } else if (tab === 'pattern' && messages && Array.isArray(messages)) {
            // Handle pattern analysis
            console.log(`Processing PATTERN analysis with ${messages.length} messages`);
            
            // Combine messages for analysis
            const combinedMessage = messages.join('\n---\n');
            const analysisData = await analyzeWithAI(combinedMessage, tone, 'pattern');
            
            const response = {
                success: true,
                data: {
                    context: {
                        tab: 'pattern',
                        relationship: relationship || 'Partner',
                        tone: tone,
                        contentType: content_type || 'dm',
                        subjectName: subject_name
                    },
                    ...analysisData,
                    // Add pattern-specific fields
                    pattern: analysisData.pattern || {
                        cycle: `Analysis of ${messages.length} messages`,
                        prognosis: "Pattern analysis complete"
                    }
                }
            };
            
            return res.status(200).json(response);
            
        } else {
            return res.status(400).json({ 
                error: 'Invalid request. For scan analysis, provide "tab": "scan" and "message". For pattern analysis, provide "tab": "pattern" and "messages" array.',
                received: { tab, hasMessage: !!message, hasMessages: !!messages }
            });
        }
        
    } catch (error) {
        console.error('Unified analyze error:', error);
        res.status(500).json({ 
            error: 'Error processing analysis request.',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// SEPARATE SCAN ROUTE
exports.analyzeScan = async (req, res) => {
    try {
        const { message, tone, relationship, content_type, subject_name } = req.body;
        
        if (!message || !tone) {
            return res.status(400).json({ 
                error: 'Missing required fields: message and tone are required' 
            });
        }
        
        console.log(`Processing separate SCAN analysis: "${message}" with tone: ${tone}`);
        
        const analysisData = await analyzeWithAI(message, tone, 'scan');
        
        const response = {
            success: true,
            data: {
                context: {
                    tab: 'scan',
                    relationship: relationship || 'Partner',
                    tone: tone,
                    contentType: content_type || 'dm',
                    subjectName: subject_name
                },
                ...analysisData
            }
        };
        
        res.status(200).json(response);
    } catch (error) {
        console.error('Scan analysis error:', error);
        res.status(500).json({ error: 'Error processing scan request.' });
    }
};

// SEPARATE PATTERN ROUTE
exports.analyzePattern = async (req, res) => {
    try {
        const { messages, tone, relationship, content_type, subject_name } = req.body;
        
        if (!messages || !Array.isArray(messages) || messages.length === 0 || !tone) {
            return res.status(400).json({ 
                error: 'Missing required fields: messages (array) and tone are required' 
            });
        }
        
        console.log(`Processing separate PATTERN analysis with ${messages.length} messages`);
        
        const combinedMessage = messages.join('\n---\n');
        const analysisData = await analyzeWithAI(combinedMessage, tone, 'pattern');
        
        const response = {
            success: true,
            data: {
                context: {
                    tab: 'pattern',
                    relationship: relationship || 'Partner',
                    tone: tone,
                    contentType: content_type || 'dm',
                    subjectName: subject_name
                },
                ...analysisData,
                pattern: analysisData.pattern || {
                    cycle: `Analysis of ${messages.length} messages`,
                    prognosis: "Pattern analysis complete"
                }
            }
        };
        
        res.status(200).json(response);
    } catch (error) {
        console.error('Pattern analysis error:', error);
        res.status(500).json({ error: 'Error processing pattern request.' });
    }
};

// MENTOR CHAT ROUTE
exports.mentorChat = async (req, res) => {
    try {
        console.log('Mentor chat request received:', req.body);
        
        const { mentor, user_text, userText, preset, options, userId } = req.body;
        
        // Handle both user_text and userText
        const actualUserText = user_text || userText;
        
        if (!mentor || !actualUserText || !preset) {
            return res.status(400).json({ 
                error: 'Missing required fields: mentor, user_text, and preset are required',
                received: { mentor, user_text: actualUserText, preset }
            });
        }

        console.log(`Processing mentor chat: ${mentor} - ${preset} - "${actualUserText}"`);
        
        // Check if streaming is requested
        if (options?.stream) {
            // Handle streaming response (SSE)
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            
            try {
                const mentorResponse = await getMentorResponse(mentor, actualUserText, preset, options);
                
                // Send the response as streaming
                res.write(`data: ${JSON.stringify({ text: mentorResponse.response })}\n\n`);
                res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
                res.end();
                
            } catch (error) {
                console.error('Streaming mentor error:', error);
                res.write(`data: ${JSON.stringify({ error: 'Failed to generate response' })}\n\n`);
                res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
                res.end();
            }
        } else {
            // Handle regular JSON response
            const mentorResponse = await getMentorResponse(mentor, actualUserText, preset, options);
            
            res.json({ 
                success: true, 
                data: mentorResponse,
                message: 'Mentor response generated successfully'
            });
        }
        
    } catch (error) {
        console.error('Mentor chat error:', error);
        res.status(500).json({ 
            error: 'Failed to generate mentor response',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    unifiedAnalyze: exports.unifiedAnalyze,
    analyzeScan: exports.analyzeScan,
    analyzePattern: exports.analyzePattern,
    mentorChat: exports.mentorChat
};
