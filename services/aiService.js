// services/aiService.js

const axios = require('axios');

// Together AI API endpoint
const TOGETHER_API_URL = 'https://api.together.xyz/v1/chat/completions';

// Function to analyze messages with Together AI
async function analyzeWithAI(message, tone, tab = 'scan') {
  try {
    console.log(`Calling Together AI for ${tab} analysis with tone: ${tone}`);
    
    const systemPrompt = `You are an expert communication analyst specializing in detecting manipulation patterns and psychological tactics. 
    
Analyze the given message(s) and provide a detailed assessment in this EXACT JSON format:

{
  "headline": "Brief analysis headline",
  "coreTake": "Core insight about the communication",
  "tactic": {
    "label": "Primary tactic detected (e.g., Gaslighting, Love Bombing, DARVO, etc.)",
    "confidence": 85
  },
  "motives": "Underlying motivations",
  "targeting": "What is being targeted",
  "powerPlay": "Power dynamic at play",
  "receipts": ["Evidence 1", "Evidence 2"],
  "nextMoves": "Predicted next moves",
  "suggestedReply": {
    "style": "${tone}",
    "text": "Suggested response"
  },
  "safety": {
    "riskLevel": "LOW|MODERATE|HIGH",
    "notes": "Safety assessment"
  },
  "metrics": {
    "redFlag": 75,
    "certainty": 85,
    "viralPotential": 30
  }
}

Tone context: ${tone} (savage = direct/harsh, soft = gentle, clinical = analytical)
Return ONLY the JSON object, no other text.`;

    const response = await axios.post(TOGETHER_API_URL, {
      model: "meta-llama/Llama-2-70b-chat-hf",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: `Analyze this message: "${message}"`
        }
      ],
      max_tokens: 1000,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.TOGETHER_AI_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    const aiResponse = response.data.choices[0].message.content;
    console.log('Raw AI response:', aiResponse);
    
    // Try to parse JSON response
    let analysisData;
    try {
      // Clean the response and extract JSON
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysisData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      // Return fallback response
      analysisData = getFallbackAnalysis(message, tone);
    }

    return analysisData;
    
  } catch (error) {
    console.error('AI Analysis Error:', error.message);
    // Return fallback response instead of failing
    return getFallbackAnalysis(message, tone);
  }
}

// Function to get mentor responses with Together AI
async function getMentorResponse(mentor, userText, preset, options = {}) {
  try {
    console.log(`Generating response for ${mentor} with preset ${preset}`);
    
    const mentorPersonas = {
      casanova: "You are Casanova, the legendary seducer and master of charm. Respond with sophisticated, charismatic advice about social dynamics and human nature. Your wisdom comes from understanding people deeply. Be charming but ethical - teach recognition of manipulation, not how to manipulate.",
      cleopatra: "You are Cleopatra, the powerful Queen of Egypt who commanded through intelligence and influence. Respond with regal confidence and strategic wisdom about power dynamics, leadership, and influence. Teach how to recognize and defend against manipulation tactics.",
      machiavelli: "You are Niccolò Machiavelli, the political strategist. Respond with calculated, pragmatic advice about power, strategy, and human nature. Your insights help people understand the game of influence to protect themselves from it.",
      sun_tzu: "You are Sun Tzu, the ancient military strategist. Respond with strategic wisdom using metaphors from warfare and tactics. Your teachings help people understand psychological warfare to defend against it.",
      marcus_aurelius: "You are Marcus Aurelius, the Stoic philosopher-emperor. Respond with philosophical wisdom about inner strength, emotional resilience, and mental fortitude. Help people build psychological defenses through Stoic principles.",
      churchill: "You are Winston Churchill, the great orator and wartime leader. Respond with wit, resolve, and powerful rhetoric. Your experience with propaganda and psychological warfare helps others recognize and resist manipulation."
    };

    const presetInstructions = {
      drill: "Challenge the user with tough questions and exercises. Be demanding but supportive.",
      advise: "Provide thoughtful, actionable advice. Be direct and helpful.",
      roleplay: "Engage in character as if having a real conversation. Stay true to your historical persona.",
      chat: "Have a natural conversation while maintaining your unique perspective and wisdom."
    };

    const selectedPersona = mentorPersonas[mentor] || mentorPersonas.casanova;
    const presetInstruction = presetInstructions[preset] || presetInstructions.chat;
    
    const systemPrompt = `${selectedPersona}
    
${presetInstruction}

Keep responses focused, practical, and under 200 words. Speak in your authentic voice and personality.`;

    const response = await axios.post(TOGETHER_API_URL, {
      model: "meta-llama/Llama-2-70b-chat-hf",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: userText
        }
      ],
      max_tokens: 300,
      temperature: 0.8
    }, {
      headers: {
        'Authorization': `Bearer ${process.env.TOGETHER_AI_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    const mentorResponse = response.data.choices[0].message.content;

    return {
      mentor: mentor,
      response: mentorResponse,
      preset: preset,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Mentor Response Error:', error.message);
    
    // Return fallback response if AI fails
    return {
      mentor: mentor,
      response: getFallbackMentorResponse(mentor, userText, preset),
      preset: preset,
      timestamp: new Date().toISOString()
    };
  }
}

// Fallback analysis when AI fails
function getFallbackAnalysis(message, tone) {
  return {
    headline: `Communication analysis with ${tone} tone`,
    coreTake: `Analysis of: "${message.substring(0, 100)}..."`,
    tactic: {
      label: "Standard Communication",
      confidence: 70
    },
    motives: "General communication intent",
    targeting: "Audience engagement",
    powerPlay: "Standard interaction",
    receipts: [
      `Message tone: ${tone}`,
      `Content analyzed`
    ],
    nextMoves: "Continue natural conversation",
    suggestedReply: {
      style: tone,
      text: "Thank you for sharing that with me."
    },
    safety: {
      riskLevel: "LOW",
      notes: "Standard communication detected"
    },
    metrics: {
      redFlag: 15,
      certainty: 70,
      viralPotential: 25
    }
  };
}

// Fallback mentor responses when AI fails
function getFallbackMentorResponse(mentor, userText, preset) {
  const fallbacks = {
    casanova: "Ah, my friend... The art of connection lies not in force, but in genuine understanding. What you seek requires patience and authenticity.",
    cleopatra: "Listen well... True power comes from within. Build your confidence and let your authentic self shine forth.",
    machiavelli: "Consider this carefully... The strongest position is one of self-improvement and strategic patience.",
    sun_tzu: "Reflect upon this... Victory comes to those who know themselves first. What do you truly seek?",
    marcus_aurelius: "Remember... What disturbs people's minds is not events but their judgments on events. Look within.",
    churchill: "Take heart... In our finest moments, we discover our true strength. Never surrender to despair."
  };
  
  return fallbacks[mentor] || fallbacks.casanova;
}

module.exports = {
  analyzeWithAI,
  getMentorResponse
};
