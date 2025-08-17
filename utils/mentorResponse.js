// utils/mentorResponse.js

const EventEmitter = require('events');
const { getMentorResponse } = require('../services/aiService');

// Generate mentor response using AI service
exports.generateMentorResponse = (mentor, userText, preset, options) => {
    const emitter = new EventEmitter();

    // Use the AI service to generate real responses
    getMentorResponse(mentor, userText, preset, options)
        .then(response => {
            // Emit the actual AI-generated response
            emitter.emit('data', { text: response.response });
            emitter.emit('end');
        })
        .catch(error => {
            console.error('Mentor response generation error:', error);
            
            // Emit fallback response on error
            const fallbackResponse = getFallbackResponse(mentor, userText, preset);
            emitter.emit('data', { text: fallbackResponse });
            emitter.emit('end');
        });

    return emitter;
};

// Fallback responses for each mentor when AI fails
function getFallbackResponse(mentor, userText, preset) {
    const fallbacks = {
        casanova: {
            drill: "Ah, let me challenge you... What do you truly seek in this interaction? Is it connection or conquest?",
            advise: "My friend, the art of charm lies not in manipulation, but in genuine understanding. Listen more than you speak.",
            roleplay: "Imagine you are the other person. How would you want to be approached? With respect or with schemes?",
            chat: "The greatest seduction is being authentically yourself. What holds you back from that truth?"
        },
        cleopatra: {
            drill: "Tell me, what power do you already possess that you're not recognizing? Queens are made, not born.",
            advise: "True influence comes from within. Build your confidence first, then others will naturally be drawn to your energy.",
            roleplay: "A queen does not chase - she attracts. What would make you magnetic rather than desperate?",
            chat: "Power without wisdom is destruction. What wisdom do you need to gain before you act?"
        },
        machiavelli: {
            drill: "What is your strategic objective here? Without clear goals, all tactics are merely chaos.",
            advise: "Consider the long-term consequences. Is this action building your reputation or destroying it?",
            roleplay: "In the game of influence, patience often defeats haste. What is your timeline for success?",
            chat: "The prince who is wise studies human nature. What have you learned about this person's character?"
        },
        sun_tzu: {
            drill: "Know yourself and know your enemy. What do you not yet understand about this situation?",
            advise: "Victory comes to those who are prepared. Have you prepared yourself for both success and failure?",
            roleplay: "Every battle is won before it is fought. What groundwork must you lay first?",
            chat: "The supreme excellence is to subdue the enemy without fighting. How might you achieve your goal without conflict?"
        },
        marcus_aurelius: {
            drill: "What virtues are you cultivating in this pursuit? Are your actions aligned with your values?",
            advise: "Focus on what you can control - your character, your actions, your responses. Release what you cannot.",
            roleplay: "If this interaction were your last, would you be proud of how you conducted yourself?",
            chat: "The best revenge is not to be like your enemy. The best attraction is to be worthy of love."
        },
        churchill: {
            drill: "What is your finest hour in this challenge? When will you show your true character?",
            advise: "Never give in to desperation. Build yourself up rather than tearing others down to your level.",
            roleplay: "How would a person of great character handle this situation? Be that person.",
            chat: "Success is not final, failure is not fatal. What courage do you need to summon here?"
        }
    };

    const mentorResponses = fallbacks[mentor] || fallbacks.casanova;
    return mentorResponses[preset] || mentorResponses.chat;
}

// Legacy function for backward compatibility
exports.getPersonaForMentor = (mentor) => {
    const personas = {
        casanova: 'Master of authentic charm and social grace',
        cleopatra: 'Queen of influence and strategic power',
        machiavelli: 'Strategic thinker and political mastermind',
        sun_tzu: 'Ancient strategist and tactical genius',
        marcus_aurelius: 'Stoic philosopher and wise emperor',
        churchill: 'Resolute leader and master of rhetoric'
    };
    
    return personas[mentor] || personas.casanova;
};
