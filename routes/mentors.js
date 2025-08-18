const { generateMentorResponse } = require('../utils/mentorResponse');

// Mentor chat route (SSE streaming)
exports.mentorsChat = (req, res) => {
  const { mentor, userText, preset, options } = req.body;

  // Log incoming data for debugging
  console.log('Mentor chat request received:', req.body);

  // Check if required parameters are provided
  if (!mentor || !userText || !preset) {
    return res.status(400).json({ error: 'Missing required parameters: mentor, userText, or preset' });
  }

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Start stream
  let streamData = generateMentorResponse(mentor, userText, preset, options);

  // Log streamData for debugging
  console.log('Starting stream for mentor:', mentor);

  streamData.on('data', (chunk) => {
    console.log('Stream chunk:', chunk);  // Log the data being sent to frontend
    res.write(`data: ${JSON.stringify(chunk)}\n\n`);
  });

  streamData.on('end', () => {
    res.write('data: {"done": true}\n\n');
    res.end();
  });

  streamData.on('error', (err) => {
    console.error('Stream error:', err);  // Log stream errors
    res.status(500).json({ error: 'Stream error occurred' });
  });
};
