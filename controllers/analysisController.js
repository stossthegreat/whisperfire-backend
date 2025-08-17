// controllers/analysisController.js

const { WhisperfireResponse, validateResponse } = require('../utils/responseValidator');

// UNIFIED ANALYZE ROUTE - Handles both scan and pattern based on 'tab' field
exports.unifiedAnalyze = async (req, res) => {
    try {
        console.log('Unified analyze request received:', req.body);
        
        const { tab, message, messages, tone, relationship, content_type, subject_name } = req.body;

        if (tab === 'scan' && message) {
            // Handle scan analysis
            console.log(`Processing SCAN analysis: "${message}" with tone: ${tone}`);
            
            const response = await analyzeRequest({
                message, tone, relationship, content_type, subject_name
            });
            
            return res.status(200).json(response);
            
        } else if (tab === 'pattern' && messages && Array.isArray(messages)) {
            // Handle pattern analysis
            console.log(`Processing PATTERN analysis with ${messages.length} messages`);
            
            const response = await analyzePatternRequest({
                messages, tone, relationship, content_type, subject_name
            });
            
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
        
        const response = await analyzeRequest({
            message, tone, relationship, content_type, subject_name
        });
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
        
        const response = await analyzePatternRequest({
            messages, tone, relationship, content_type, subject_name
        });
        res.status(200).json(response);
    } catch (error) {
        console.error('Pattern analysis error:', error);
        res.status(500).json({ error: 'Error processing pattern request.' });
    }
};

// HELPER FUNCTION - Process scan analysis
async function analyzeRequest(data) {
    const { message, tone, relationship, content_type, subject_name } = data;
    
    // Mock response for now - replace with actual AI analysis
    const mockResult = {
        success: true,
        data: {
            context: {
                tab: 'scan',
                relationship: relationship || 'Partner',
                tone: tone,
                contentType: content_type || 'dm',
                subjectName: subject_name
            },
            headline: `Analysis of message with ${tone} tone`,
            coreTake: `Message analysis: "${message.substring(0, 50)}..."`,
            tactic: {
                label: 'Communication Pattern',
                confidence: 85
            },
            motives: 'General communication intent',
            targeting: 'Audience engagement',
            powerPlay: 'Standard interaction approach',
            receipts: [
                `Message tone: ${tone}`,
                `Content type: ${content_type || 'dm'}`
            ],
            nextMoves: 'Continue conversation naturally',
            suggestedReply: {
                style: tone,
                text: 'Thank you for sharing that with me.'
            },
            safety: {
                riskLevel: 'LOW',
                notes: 'Standard communication detected'
            },
            metrics: {
                redFlag: 15,
                certainty: 85,
                viralPotential: 25
            },
            pattern: null,
            ambiguity: null
        }
    };
    
    return validateResponse(mockResult);
}

// HELPER FUNCTION - Process pattern analysis  
async function analyzePatternRequest(data) {
    const { messages, tone, relationship, content_type, subject_name } = data;
    
    // Mock response for now - replace with actual AI analysis
    const mockResult = {
        success: true,
        data: {
            context: {
                tab: 'pattern',
                relationship: relationship || 'Partner',
                tone: tone,
                contentType: content_type || 'dm',
                subjectName: subject_name
            },
            headline: `Pattern analysis of ${messages.length} messages`,
            coreTake: `Communication pattern analysis across ${messages.length} messages`,
            tactic: {
                label: 'Communication Pattern',
                confidence: 90
            },
            motives: 'Ongoing communication pattern',
            targeting: 'Relationship dynamics',
            powerPlay: 'Communication style consistency',
            receipts: messages.slice(0, 4).map((msg, i) => 
                `Message ${i + 1}: ${msg.substring(0, 30)}...`
            ),
            nextMoves: 'Monitor communication trends',
            suggestedReply: {
                style: tone,
                text: 'I appreciate our ongoing conversation.'
            },
            safety: {
                riskLevel: 'LOW',
                notes: 'Pattern analysis complete'
            },
            metrics: {
                redFlag: 20,
                certainty: 90,
                viralPotential: 30
            },
            pattern: {
                cycle: 'Regular communication',
                prognosis: 'Healthy interaction pattern'
            },
            ambiguity: null
        }
    };
    
    return validateResponse(mockResult);
}
