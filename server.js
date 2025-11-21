require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const apiRoutes = require('./routes/apiRoutes');
const { initMemory } = require('./services/memoryService');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json({ limit: '2mb' }));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.use('/api/v1', apiRoutes);

// Initialize memory systems (Redis, Postgres, ChromaDB)
initMemory().then(() => {
  console.log('✅ Memory systems initialized');
}).catch(err => {
  console.warn('⚠️ Memory initialization failed:', err.message);
  console.warn('Continuing without memory features...');
});

const server = app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Memory: Redis=${!!process.env.REDIS_URL} Postgres=${!!process.env.DATABASE_URL} Chroma=${!!process.env.CHROMA_URL}`);
});

/* 🔧 Timeouts tuned for SSE + Together:
   - keepAliveTimeout MUST be < headersTimeout
*/
server.keepAliveTimeout = 150_000; // keep sockets alive
server.headersTimeout   = 160_000; // allow long headers window
server.requestTimeout   = 180_000; // overall per-request (Node 18+)
server.setTimeout?.(180_000);
