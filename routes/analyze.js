 const { WhisperfireResponse, validateResponse } = require('../utils/responseValidator');

// Analyze Scan route
exports.analyzeScan = async (req, res) => {
  try {
    const { message, tone, relationship, content_type, subject_name } = req.body;

    // Log incoming request data
    console.log('Analyze Scan request received:', req.body);

    // Check if required parameters are provided
    if (!message || !tone || !relationship || !content_type) {
      return res.status(400).json({ error: 'Missing required parameters: message, tone, relationship, or content_type' });
    }

    // Process the request
    const response = await analyzeRequest({
      message, tone, relationship, content_type, subject_name
    });

    // Send the response
    res.status(200).json(response);
  } catch (error) {
    console.error('Error in analyzeScan:', error);  // Log the error
    res.status(500).json({ error: 'Error processing scan request.' });
  }
};

// Helper function to process scan
async function analyzeRequest(data) {
  const { message, tone, relationship, content_type, subject_name } = data;

  // Ensure WhisperfireResponse is correctly generating results
  console.log('Processing analyzeRequest:', data);  // Log the data

  // Process the request (Mocking response generation here for simplicity)
  const result = WhisperfireResponse.generateScanResult(message, tone, relationship);

  // Validate response
  return validateResponse(result);
}
