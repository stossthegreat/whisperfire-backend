// services/memoryService.js — Unified memory system for mentors
// Short-term (Redis), Episodic (Postgres), Semantic (ChromaDB)

const Redis = require('ioredis'); // Using ioredis instead of redis (better Railway compatibility)
const { Pool } = require('pg');
const { ChromaClient } = require('chromadb');

// ===== REDIS CLIENT (Short-term conversation memory) =====
let redisClient = null;

async function initRedis() {
  if (redisClient) return redisClient;
  
  // Skip Redis if no URL provided
  if (!process.env.REDIS_URL) {
    console.log('ℹ️ Redis not configured (no REDIS_URL), skipping...');
    return null;
  }
  
  try {
    console.log(`🔍 Attempting Redis connection with ioredis...`);
    
    // ioredis handles Railway URLs MUCH better than node-redis
    redisClient = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
      connectTimeout: 10000
    });
    
    redisClient.on('error', (err) => {
      console.log(`❌ Redis error: ${err.message}`);
    });
    
    redisClient.on('ready', () => {
      console.log('✅ Redis connected successfully!');
    });
    
    // Test connection
    await redisClient.ping();
    console.log('✅ Redis ping successful!');
    
    return redisClient;
  } catch (err) {
    console.log(`❌ Redis failed: ${err.message}`);
    console.log('⚠️ Continuing without Redis...');
    if (redisClient) {
      redisClient.disconnect();
    }
    redisClient = null;
    return null;
  }
}

// ===== POSTGRES CLIENT (Episodic memory) =====
let pgPool = null;

async function initPostgres() {
  if (pgPool) return pgPool;
  
  // Skip Postgres if no URL provided
  if (!process.env.DATABASE_URL) {
    console.log('ℹ️ Postgres not configured (no DATABASE_URL), skipping...');
    return null;
  }
  
  try {
    console.log('🔍 Attempting Postgres connection...');
    
    // Railway Postgres requires SSL in production
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false // Railway uses self-signed certs
      },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    
    console.log('📝 Postgres SSL enabled for Railway');
    
    // Create tables if they don't exist
    await pgPool.query(`
      CREATE TABLE IF NOT EXISTS mentor_conversations (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        mentor_id TEXT NOT NULL,
        message_text TEXT NOT NULL,
        sender TEXT NOT NULL,
        preset TEXT,
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        session_id TEXT,
        INDEX idx_user_mentor (user_id, mentor_id),
        INDEX idx_timestamp (timestamp)
      );
      
      CREATE TABLE IF NOT EXISTS user_mentor_progress (
        user_id TEXT NOT NULL,
        mentor_id TEXT NOT NULL,
        total_messages INT DEFAULT 0,
        first_conversation TIMESTAMPTZ,
        last_conversation TIMESTAMPTZ,
        insights_gained JSONB DEFAULT '[]'::jsonb,
        PRIMARY KEY (user_id, mentor_id)
      );
    `);
    
    // Test the connection
    console.log('🔍 Testing Postgres connection...');
    await pgPool.query('SELECT NOW()');
    console.log('✅ Postgres connected successfully');
    return pgPool;
  } catch (err) {
    console.log(`❌ Postgres connection failed: ${err.code || err.message}`);
    console.log(`📝 DATABASE_URL format check: ${process.env.DATABASE_URL ? 'SET' : 'NOT SET'}`);
    console.log('⚠️ Continuing without Postgres memory...');
    pgPool = null;
    return null;
  }
}

// ===== CHROMA CLIENT (Semantic/historical memory) =====
let chromaClient = null;
let mentorCollection = null;

async function initChroma() {
  if (chromaClient) return chromaClient;
  
  // Skip ChromaDB if no URL provided
  if (!process.env.CHROMA_URL) {
    console.log('ℹ️ ChromaDB not configured (no CHROMA_URL), skipping...');
    return null;
  }
  
  try {
    chromaClient = new ChromaClient({
      path: process.env.CHROMA_URL
    });
    
    // Create or get mentor knowledge collection
    try {
      mentorCollection = await chromaClient.getOrCreateCollection({
        name: 'mentor_knowledge',
        metadata: { description: 'Historical knowledge and teachings of all mentors' }
      });
      console.log('✅ ChromaDB connected');
    } catch (err) {
      console.log('ℹ️ ChromaDB collection unavailable');
      chromaClient = null;
    }
    
    return chromaClient;
  } catch (err) {
    console.log('ℹ️ ChromaDB unavailable, memory features disabled');
    chromaClient = null;
    return null;
  }
}

// ===== INITIALIZE ALL SERVICES =====
async function initMemory() {
  await Promise.all([
    initRedis(),
    initPostgres(),
    initChroma()
  ]);
}

// ===== SHORT-TERM MEMORY (Redis) =====
async function getRecentConversation(userId, mentorId, limit = 10) {
  try {
    if (!redisClient) return [];
    
    const key = `conversation:${userId}:${mentorId}`;
    const messages = await redisClient.lrange(key, 0, limit - 1); // ioredis uses lowercase
    return messages.map(m => JSON.parse(m)).reverse();
  } catch (err) {
    // Silent fail - memory optional
    return [];
  }
}

async function storeRecentMessage(userId, mentorId, message) {
  try {
    if (!redisClient) return;
    
    const key = `conversation:${userId}:${mentorId}`;
    await redisClient.lpush(key, JSON.stringify(message)); // ioredis uses lowercase
    await redisClient.ltrim(key, 0, 49); // Keep last 50 messages
    await redisClient.expire(key, 86400 * 7); // 7 days TTL
  } catch (err) {
    // Silent fail - memory optional
  }
}

// ===== EPISODIC MEMORY (Postgres) =====
async function getUserMentorHistory(userId, mentorId) {
  try {
    if (!pgPool) return null;
    
    const result = await pgPool.query(
      `SELECT * FROM user_mentor_progress WHERE user_id = $1 AND mentor_id = $2`,
      [userId, mentorId]
    );
    
    return result.rows[0] || null;
  } catch (err) {
    // Silent fail - memory optional
    return null;
  }
}

async function storeMentorConversation(userId, mentorId, messageText, sender, preset, sessionId) {
  try {
    if (!pgPool) return;
    
    // Store message
    await pgPool.query(
      `INSERT INTO mentor_conversations (user_id, mentor_id, message_text, sender, preset, session_id)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [userId, mentorId, messageText, sender, preset, sessionId]
    );
    
    // Update progress
    await pgPool.query(
      `INSERT INTO user_mentor_progress (user_id, mentor_id, total_messages, first_conversation, last_conversation)
       VALUES ($1, $2, 1, NOW(), NOW())
       ON CONFLICT (user_id, mentor_id)
       DO UPDATE SET
         total_messages = user_mentor_progress.total_messages + 1,
         last_conversation = NOW()`,
      [userId, mentorId]
    );
  } catch (err) {
    // Silent fail - memory optional
  }
}

async function getPastInsights(userId, mentorId, limit = 5) {
  try {
    if (!pgPool) return [];
    
    const result = await pgPool.query(
      `SELECT message_text, timestamp FROM mentor_conversations
       WHERE user_id = $1 AND mentor_id = $2 AND sender = 'mentor'
       ORDER BY timestamp DESC
       LIMIT $3`,
      [userId, mentorId, limit]
    );
    
    return result.rows;
  } catch (err) {
    // Silent fail - memory optional
    return [];
  }
}

// ===== SEMANTIC MEMORY (ChromaDB) =====
async function queryMentorKnowledge(mentorId, query, limit = 3) {
  try {
    if (!mentorCollection) return [];
    
    const results = await mentorCollection.query({
      queryTexts: [query],
      nResults: limit,
      where: { mentor_id: mentorId }
    });
    
    return results.documents[0] || [];
  } catch (err) {
    // Silent fail - memory optional
    return [];
  }
}

async function storeMentorKnowledge(mentorId, mentorName, knowledge) {
  try {
    if (!mentorCollection) return;
    
    // Store historical facts, quotes, teachings for this mentor
    const documents = Array.isArray(knowledge) ? knowledge : [knowledge];
    const ids = documents.map((_, i) => `${mentorId}_knowledge_${Date.now()}_${i}`);
    const metadatas = documents.map(() => ({ mentor_id: mentorId, mentor_name: mentorName }));
    
    await mentorCollection.add({
      ids,
      documents,
      metadatas
    });
  } catch (err) {
    // Silent fail - memory optional
  }
}

// ===== BUILD MEMORY CONTEXT FOR AI =====
async function buildMemoryContext(userId, mentorId, userMessage) {
  const context = {
    shortTerm: [],
    episodic: null,
    semantic: [],
    summary: ''
  };
  
  try {
    // 1. Short-term: Recent conversation (last 10 messages)
    context.shortTerm = await getRecentConversation(userId, mentorId, 10);
    
    // 2. Episodic: User's history with this mentor
    context.episodic = await getUserMentorHistory(userId, mentorId);
    
    // 3. Semantic: Relevant historical knowledge for current query
    context.semantic = await queryMentorKnowledge(mentorId, userMessage, 3);
    
    // 4. Build summary for prompt injection
    const parts = [];
    
    if (context.shortTerm.length > 0) {
      const recent = context.shortTerm.slice(-3).map(m => 
        `${m.sender === 'user' ? 'User' : 'You'}: ${m.text.substring(0, 100)}`
      ).join('\n');
      parts.push(`Recent conversation:\n${recent}`);
    }
    
    if (context.episodic) {
      const { total_messages, first_conversation, last_conversation } = context.episodic;
      const firstDate = new Date(first_conversation).toLocaleDateString();
      const lastDate = new Date(last_conversation).toLocaleDateString();
      parts.push(`User history: ${total_messages} messages since ${firstDate}, last conversation ${lastDate}`);
    }
    
    if (context.semantic.length > 0) {
      parts.push(`Relevant teachings: ${context.semantic.join(' | ')}`);
    }
    
    context.summary = parts.join('\n\n');
    
  } catch (err) {
    // Silent fail - memory optional
  }
  
  return context;
}

// ===== SEED HISTORICAL KNOWLEDGE =====
async function seedMentorKnowledge() {
  // This would be called once to populate ChromaDB with historical facts
  // Example teachings for each mentor
  const knowledge = {
    sun_tzu: [
      "The supreme art of war is to subdue the enemy without fighting.",
      "If you know the enemy and know yourself, you need not fear the result of a hundred battles.",
      "Appear weak when you are strong, and strong when you are weak.",
      "All warfare is based on deception.",
      "The greatest victory is that which requires no battle."
    ],
    marcus_aurelius: [
      "You have power over your mind - not outside events. Realize this, and you will find strength.",
      "The happiness of your life depends upon the quality of your thoughts.",
      "Waste no more time arguing about what a good man should be. Be one.",
      "Very little is needed to make a happy life; it is all within yourself.",
      "The impediment to action advances action. What stands in the way becomes the way."
    ],
    // Add more for other mentors...
  };
  
  for (const [mentorId, teachings] of Object.entries(knowledge)) {
    await storeMentorKnowledge(mentorId, mentorId, teachings);
  }
  
  console.log('✅ Mentor knowledge seeded');
}

module.exports = {
  initMemory,
  getRecentConversation,
  storeRecentMessage,
  getUserMentorHistory,
  storeMentorConversation,
  getPastInsights,
  queryMentorKnowledge,
  storeMentorKnowledge,
  buildMemoryContext,
  seedMentorKnowledge
};

