// controllers/mentorController.js

// Mentor chat route with SSE (Server-Sent Events) streaming
exports.mentorsChat = (req, res) => {
    try {
        console.log('Mentor chat request received:', req.body);
        
        const { mentor, user_text, userText, preset, options } = req.body;
        
        // Handle both user_text and userText (Flutter sends user_text)
        const actualUserText = user_text || userText;
        
        if (!mentor || !actualUserText || !preset) {
            return res.status(400).json({ 
                error: 'Missing required fields: mentor, user_text, and preset are required',
                received: { mentor, user_text: actualUserText, preset }
            });
        }

        console.log(`Processing mentor chat: ${mentor} - ${preset} - "${actualUserText}"`);
        
        // Set up SSE headers
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');
        
        // Generate mentor response
        const mentorResponse = generateMentorResponse(mentor, actualUserText, preset, options);
        
        // Stream the response
        res.write(`data: ${JSON.stringify({ text: mentorResponse })}\n\n`);
        res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
        res.end();
        
    } catch (error) {
        console.error('Mentor chat error:', error);
        
        // If headers not sent yet, send error as JSON
        if (!res.headersSent) {
            res.status(500).json({ 
                error: 'Failed to generate mentor response',
                details: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        } else {
            // If streaming already started, send error in stream
            res.write(`data: ${JSON.stringify({ error: 'Failed to generate response' })}\n\n`);
            res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
            res.end();
        }
    }
};

// Generate mentor response based on mentor type and preset
function generateMentorResponse(mentor, userText, preset, options = {}) {
    console.log(`Generating response for ${mentor} with preset ${preset}`);
    
    // Mentor personas
    const mentorPersonas = {
        casanova: {
            name: 'Casanova',
            style: 'charming and sophisticated',
            greeting: 'Ah, my friend...'
        },
        cleopatra: {
            name: 'Cleopatra',
            style: 'powerful and strategic',
            greeting: 'Listen well...'
        },
        machiavelli: {
            name: 'Machiavelli',
            style: 'cunning and practical',
            greeting: 'In matters of strategy...'
        },
        sun_tzu: {
            name: 'Sun Tzu',
            style: 'wise and strategic',
            greeting: 'Ancient wisdom teaches...'
        },
        marcus_aurelius: {
            name: 'Marcus Aurelius',
            style: 'stoic and philosophical',
            greeting: 'Reflect upon this...'
        },
        churchill: {
            name: 'Churchill',
            style: 'resolute and inspiring',
            greeting: 'In times like these...'
        }
    };
    
    const selectedMentor = mentorPersonas[mentor] || mentorPersonas.casanova;
    
    // Generate response based on preset
    let response;
    switch (preset) {
        case 'drill':
            response = `${selectedMentor.greeting} Let me challenge your thinking about this situation. What specific outcome are you truly seeking here? Consider the deeper motivations at play.`;
            break;
        case 'advise':
            response = `${selectedMentor.greeting} Based on what you've shared, I see this situation requires careful consideration. The path forward involves understanding both yourself and the other person's perspective. Authentic connection cannot be forced, only cultivated through genuine interaction and mutual respect.`;
            break;
        case 'roleplay':
            response = `${selectedMentor.greeting} Let us practice this scenario. I shall play different roles to help you understand various perspectives. What would you say if the other person responded with hesitation or uncertainty?`;
            break;
        case 'chat':
        default:
            response = `${selectedMentor.greeting} I understand your situation. True connection comes from authenticity and mutual respect. Rather than trying to "get" someone, focus on being your genuine self and building a foundation of trust and friendship. What matters most is that both people feel comfortable and respected.`;
            break;
    }
    
    return response;
}
