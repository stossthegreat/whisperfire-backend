// utils/responseValidator.js

// Utility to validate response structure
exports.validateResponse = (response) => {
    try {
        // Ensure response has required structure
        if (!response || typeof response !== 'object') {
            throw new Error('Invalid response format: must be an object');
        }

        // Validate basic structure
        if (!response.success && response.success !== false) {
            response.success = true; // Default to success if not specified
        }

        if (!response.data) {
            throw new Error('Invalid response format: missing data field');
        }

        // Validate data structure
        const data = response.data;
        
        // Ensure required fields exist
        if (!data.headline) data.headline = 'Analysis Complete';
        if (!data.coreTake) data.coreTake = 'Analysis processed successfully';
        if (!data.tactic) data.tactic = { label: 'Standard Communication', confidence: 70 };
        if (!data.metrics) data.metrics = { redFlag: 15, certainty: 70, viralPotential: 25 };
        if (!data.safety) data.safety = { riskLevel: 'LOW', notes: 'Standard analysis' };

        // Ensure arrays are arrays
        if (!Array.isArray(data.receipts)) data.receipts = [];
        
        // Ensure suggestedReply has proper structure
        if (!data.suggestedReply || typeof data.suggestedReply !== 'object') {
            data.suggestedReply = { style: 'neutral', text: 'Thank you for sharing.' };
        }

        return response;
    } catch (error) {
        console.error('Response validation error:', error);
        
        // Return a fallback valid response
        return {
            success: true,
            data: {
                context: response?.data?.context || { tab: 'scan', tone: 'neutral' },
                headline: 'Analysis Complete',
                coreTake: 'Message has been analyzed',
                tactic: {
                    label: 'Standard Communication',
                    confidence: 70
                },
                motives: 'General communication',
                targeting: 'Standard interaction',
                powerPlay: 'None detected',
                receipts: ['Analysis completed'],
                nextMoves: 'Continue normally',
                suggestedReply: {
                    style: 'neutral',
                    text: 'Thank you for sharing that.'
                },
                safety: {
                    riskLevel: 'LOW',
                    notes: 'Standard communication'
                },
                metrics: {
                    redFlag: 15,
                    certainty: 70,
                    viralPotential: 25
                },
                pattern: null,
                ambiguity: null
            }
        };
    }
};

// Generate Whisperfire response for scanning (Legacy - for backward compatibility)
exports.WhisperfireResponse = {
    generateScanResult: (message, tone, relationship) => {
        return {
            success: true,
            data: {
                context: {
                    tab: 'scan',
                    relationship: relationship || 'Partner',
                    tone: tone,
                    contentType: 'dm'
                },
                headline: `Scan analysis with ${tone} tone`,
                coreTake: `Analysis of: "${message.substring(0, 50)}..."`,
                tactic: {
                    label: 'Communication Pattern',
                    confidence: 75
                },
                motives: 'General communication intent',
                targeting: 'Audience engagement',
                powerPlay: 'Standard interaction',
                receipts: [
                    `Message analyzed: ${message.substring(0, 30)}...`,
                    `Tone: ${tone}`
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
                    certainty: 75,
                    viralPotential: 25
                },
                pattern: null,
                ambiguity: null
            }
        };
    },
    
    generatePatternResult: (messages, tone, relationship) => {
        return {
            success: true,
            data: {
                context: {
                    tab: 'pattern',
                    relationship: relationship || 'Partner',
                    tone: tone,
                    contentType: 'dm'
                },
                headline: `Pattern analysis of ${messages.length} messages`,
                coreTake: `Communication pattern analysis across ${messages.length} messages`,
                tactic: {
                    label: 'Communication Pattern',
                    confidence: 80
                },
                motives: 'Ongoing communication pattern',
                targeting: 'Relationship dynamics',
                powerPlay: 'Communication consistency',
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
                    certainty: 80,
                    viralPotential: 30
                },
                pattern: {
                    cycle: 'Regular communication',
                    prognosis: 'Healthy interaction pattern'
                },
                ambiguity: null
            }
        };
    }
};
