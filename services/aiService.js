// services/aiService.js

const axios = require('axios');

// Function to analyze with Together AI (or any AI service)
async function analyzeWithAI(message, tone) {
  const response = await axios.post('https://your-ai-endpoint', {
    message,
    tone,
    apiKey: process.env.TOGETHER_AI_KEY
  });

  return response.data; // Return the result from AI
}

module.exports = {
  analyzeWithAI
}; 