# Memory System for Mentor Universe

## Overview
Full-stack memory integration using Redis (short-term), Postgres (episodic), and ChromaDB (semantic) to give mentors persistent, contextual memory of user conversations.

## Architecture

### 1. **Redis - Short-Term Memory**
- Stores last 50 messages per user-mentor pair
- 7-day TTL
- Fast access for recent conversation context
- **Key format**: `conversation:{userId}:{mentorId}`

### 2. **Postgres - Episodic Memory**
- Permanent storage of all conversations
- User progress tracking per mentor
- Session management
- **Tables**:
  - `mentor_conversations` - All messages
  - `user_mentor_progress` - Aggregate stats (total messages, first/last conversation, insights gained)

### 3. **ChromaDB - Semantic Memory**
- Historical teachings and knowledge for each mentor
- Vector similarity search for contextually relevant information
- **Collection**: `mentor_knowledge`
- **Usage**: Query relevant teachings based on user's current question

## How It Works

### Memory Flow
```
User Message → Controller
  ↓
1. Build Memory Context:
   - Fetch last 10 messages from Redis
   - Get user's history with mentor from Postgres
   - Query relevant teachings from ChromaDB
  ↓
2. Inject into AI Prompt:
   System Prompt + Memory Context + User Message
  ↓
3. AI Response
  ↓
4. Store Response:
   - Add to Redis (short-term)
   - Save to Postgres (episodic)
```

### Memory Context Injected into AI
```
CONTEXT FROM MEMORY:
Recent conversation:
User: [last message]
You: [your last response]

User history: 47 messages since 11/15/2025, last conversation 11/21/2025

Relevant teachings: "The supreme art of war is to subdue the enemy without fighting." | "Position yourself where you cannot be defeated."
```

## Environment Variables

Add to Railway or `.env`:

```env
# Required for memory features
REDIS_URL=redis://default:password@host:port
DATABASE_URL=postgresql://user:password@host:port/database
CHROMA_URL=http://chroma-host:8000
```

## Railway Setup

### 1. Add Redis
```bash
railway add redis
```
Railway will auto-populate `REDIS_URL`

### 2. Add Postgres
```bash
railway add postgresql
```
Railway will auto-populate `DATABASE_URL`

### 3. Add ChromaDB (Docker)
Add to `railway.toml` or use external ChromaDB service:

```toml
[[services]]
name = "chromadb"
source = "chromadb/chroma:latest"
ports = ["8000:8000"]
```

Set `CHROMA_URL=http://chromadb:8000`

## Installation

```bash
cd backend
npm install
```

New dependencies:
- `redis` - Redis client
- `pg` - PostgreSQL client  
- `chromadb` - ChromaDB client

## API Changes

### Request Format (unchanged externally)
```json
{
  "mentor": "sun_tzu",
  "user_text": "How do I handle this situation?",
  "preset": "advise",
  "user_id": "user123",  // OPTIONAL but recommended for memory
  "options": {
    "stream": false
  }
}
```

### Headers (optional)
- `X-Session-ID` - Track conversation sessions

## Features

### ✅ Continuity
Mentors remember previous conversations:
- "As we discussed last week..."
- "You mentioned struggling with..."
- "Building on what you learned..."

### ✅ Progress Tracking
System knows:
- How many times user talked to each mentor
- When they started
- When they last spoke
- Key insights gained

### ✅ Contextual Wisdom
AI retrieves relevant historical teachings:
- User asks about strategy → Gets Sun Tzu's most relevant quotes
- User asks about suffering → Gets Dostoyevsky's insights

### ✅ Graceful Degradation
If memory services unavailable:
- Backend continues working without memory
- Logs warnings but doesn't crash
- No breaking changes for clients

## Seeding Historical Knowledge

To populate ChromaDB with mentor teachings:

```javascript
const { seedMentorKnowledge } = require('./services/memoryService');

// Run once
seedMentorKnowledge();
```

Or via API endpoint (TODO: add admin route).

## Monitoring

Check logs for memory status:
```
✅ Redis connected
✅ Postgres connected  
✅ ChromaDB connected
✅ Memory systems initialized
```

Or warnings:
```
⚠️ Redis unavailable, using in-memory fallback
⚠️ Postgres unavailable: [error]
⚠️ ChromaDB unavailable: [error]
Continuing without memory features...
```

## Database Schema

### mentor_conversations
```sql
CREATE TABLE mentor_conversations (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  mentor_id TEXT NOT NULL,
  message_text TEXT NOT NULL,
  sender TEXT NOT NULL,  -- 'user' | 'mentor'
  preset TEXT,           -- 'drill' | 'advise' | 'roleplay' | 'chat'
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  session_id TEXT,
  INDEX idx_user_mentor (user_id, mentor_id),
  INDEX idx_timestamp (timestamp)
);
```

### user_mentor_progress
```sql
CREATE TABLE user_mentor_progress (
  user_id TEXT NOT NULL,
  mentor_id TEXT NOT NULL,
  total_messages INT DEFAULT 0,
  first_conversation TIMESTAMPTZ,
  last_conversation TIMESTAMPTZ,
  insights_gained JSONB DEFAULT '[]'::jsonb,
  PRIMARY KEY (user_id, mentor_id)
);
```

Tables are auto-created on first run.

## Performance

- **Redis**: <5ms lookup
- **Postgres**: ~10-20ms for history query
- **ChromaDB**: ~50-100ms for semantic search
- **Total memory overhead**: ~100-150ms added to response time

Worth it for persistent, intelligent conversations!

## Future Enhancements

- [ ] Memory decay (older conversations have less weight)
- [ ] Sentiment analysis on conversations
- [ ] Learning paths (track user's journey across mentors)
- [ ] Memory consolidation (summarize old conversations)
- [ ] Cross-mentor memory (reference insights from other mentors)

## Troubleshooting

**Redis connection failed**: Check `REDIS_URL` format and network access

**Postgres schema errors**: Tables auto-create, but check permissions

**ChromaDB connection timeout**: Ensure ChromaDB service is running and accessible

**Memory context too large**: Adjust limits in `memoryService.js` (currently: 10 recent messages, 3 semantic results)

