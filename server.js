require('dotenv').config(); // Load environment variables from .env file
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const apiRoutes = require('./routes/apiRoutes'); // Ensure this is pointing to the right path
const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json()); // Parse JSON bodies

// Use the API routes
app.use('/api/v1', apiRoutes); // All your routes will start with /api/v1

// Start the server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
