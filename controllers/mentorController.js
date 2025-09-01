// controllers/mentorController.js
const { generateMentorResponse } = require('../utils/mentorResponse');
const { sanitizeForSSE } = require('../utils/textSanitizer');

exports.mentorsChat = (req, res) => {
try {
const { mentor, user_text, userText, preset, options } = req.body || {};
const actualUserText = user_text || userText;

if (!mentor || !actualUserText || !preset) {  
  return res.status(400).json({  
    error: 'Missing required fields: mentor, user_text, and preset are required',  
    received: { mentor, user_text: actualUserText, preset }  
  });  
}  

// Strict SSE headers (UTF-8 + no-transform to stop proxies from mangling)  
res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');  
res.setHeader('Cache-Control', 'no-cache, no-transform');  
res.setHeader('Connection', 'keep-alive');  
res.setHeader('X-Accel-Buffering', 'no'); // Nginx: disable buffering  

// Keep-alive ping every 15s to avoid timeouts on some hosts  
const keepAlive = setInterval(() => {  
  if (!res.writableEnded) res.write(`: ping\n\n`);  
}, 15000);  

const stream = generateMentorResponse(mentor, actualUserText, preset, options);  

stream.on('data', (chunk) => {  
  try {  
    const raw = typeof chunk === 'string' ? chunk : (chunk?.text || '');  
    const clean = sanitizeForSSE(raw);  
    const payload = {  
      ...chunk,  
      text: clean  
    };  
    res.write(`data: ${JSON.stringify(payload)}\n\n`);  
  } catch (e) {  
    res.write(`data: ${JSON.stringify({ error: 'sanitize_failed' })}\n\n`);  
  }  
});  

stream.on('end', () => {  
  res.write(`data: ${JSON.stringify({ done: true })}\n\n`);  
  clearInterval(keepAlive);  
  res.end();  
});  

stream.on('error', (err) => {  
  clearInterval(keepAlive);  
  if (!res.headersSent) {  
    res.status(500).json({ error: 'Stream error occurred', details: err?.message });  
  } else {  
    res.write(`data: ${JSON.stringify({ error: 'Stream error occurred' })}\n\n`);  
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);  
    res.end();  
  }  
});

} catch (error) {
if (!res.headersSent) {
res.status(500).json({ error: 'Failed to generate mentor response', details: error?.message });
} else {
res.write(data: ${JSON.stringify({ error: 'Failed to generate response' })}\n\n);
res.write(data: ${JSON.stringify({ done: true })}\n\n);
res.end();
}
}
};

