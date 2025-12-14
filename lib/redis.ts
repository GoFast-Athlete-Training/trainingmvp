// Redis client for storing preview data
// Supports Upstash Redis (REST API) or Redis Labs (connection string) or falls back to in-memory cache

let redisClient: any = null;
let redisClientType: 'upstash' | 'standard' | null = null;
let redisConnectionPromise: Promise<void> | null = null;

// In-memory cache fallback for development
const memoryCache = new Map<string, { data: any; expires: number }>();

// TTL: 1 hour (3600 seconds)
const PREVIEW_TTL = 3600;

// Lazy initialization of Redis client
async function ensureRedisClient(): Promise<void> {
  if (redisClient && redisClientType) {
    return; // Already initialized
  }

  if (redisConnectionPromise) {
    return redisConnectionPromise; // Connection in progress
  }

  redisConnectionPromise = (async () => {
    const redisUrl = process.env.REDIS_URL;
    const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
    const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

    // Priority: 1) Redis Labs connection string, 2) Upstash REST API
    if (redisUrl && redisUrl.startsWith('redis://')) {
      try {
        const { createClient } = require('redis');
        redisClient = createClient({
          url: redisUrl,
        });
        redisClient.on('error', (err: any) => console.error('❌ Redis Client Error:', err));
        
        await redisClient.connect();
        redisClientType = 'standard';
        console.log('✅ Redis: Connected using connection string');
        return;
      } catch (error: any) {
        console.warn('⚠️ Redis: Failed to connect with connection string:', error.message);
        redisClient = null;
      }
    }

    // Fallback to Upstash if connection string didn't work
    if (!redisClient && upstashUrl && upstashToken) {
      try {
        const { Redis } = require('@upstash/redis');
        redisClient = new Redis({
          url: upstashUrl,
          token: upstashToken,
        });
        redisClientType = 'upstash';
        console.log('✅ Redis: Using Upstash Redis (REST API)');
        return;
      } catch (error: any) {
        console.warn('⚠️ Redis: Failed to initialize Upstash Redis:', error.message);
      }
    }

    console.log('⚠️ Redis: No Redis available, using in-memory cache');
  })();

  return redisConnectionPromise;
}

export async function setPreview(planId: string, previewData: any): Promise<void> {
  const key = `preview:${planId}`;
  const expiresAt = Date.now() + PREVIEW_TTL * 1000;

  try {
    await ensureRedisClient();
  } catch (error) {
    console.warn('⚠️ Redis: Connection failed, using memory cache');
  }

  if (redisClient && redisClientType) {
    try {
      if (redisClientType === 'standard') {
        // Standard Redis client (Redis Labs)
        await redisClient.setEx(key, PREVIEW_TTL, JSON.stringify(previewData));
      } else {
        // Upstash Redis (REST API)
        await redisClient.setex(key, PREVIEW_TTL, JSON.stringify(previewData));
      }
      console.log(`✅ Redis: Stored preview for plan ${planId}`);
      return;
    } catch (error: any) {
      console.error('❌ Redis: Failed to store preview:', error.message);
      // Fallback to memory cache
    }
  }
  
  // Use in-memory cache (fallback or primary)
  memoryCache.set(key, { data: previewData, expires: expiresAt });
  console.log(`✅ Memory: Stored preview for plan ${planId}`);
}

export async function getPreview(planId: string): Promise<any | null> {
  const key = `preview:${planId}`;

  try {
    await ensureRedisClient();
  } catch (error) {
    console.warn('⚠️ Redis: Connection failed, checking memory cache');
  }

  if (redisClient && redisClientType) {
    try {
      const data = await redisClient.get(key);
      if (data) {
        const parsed = typeof data === 'string' ? JSON.parse(data) : data;
        console.log(`✅ Redis: Retrieved preview for plan ${planId}`);
        return parsed;
      }
      console.log(`⚠️ Redis: No preview found for plan ${planId}`);
    } catch (error: any) {
      console.error('❌ Redis: Failed to get preview:', error.message);
      // Fallback to memory cache
    }
  }
  
  // Use in-memory cache (fallback or primary)
  const cached = memoryCache.get(key);
  if (cached && cached.expires > Date.now()) {
    console.log(`✅ Memory: Retrieved preview for plan ${planId}`);
    return cached.data;
  }
  
  // Clean up expired entries
  if (cached) {
    memoryCache.delete(key);
  }
  
  console.log(`⚠️ Memory: No preview found for plan ${planId}`);
  return null;
}

export async function deletePreview(planId: string): Promise<void> {
  const key = `preview:${planId}`;

  try {
    await ensureRedisClient();
  } catch (error) {
    // Ignore connection errors for delete
  }

  if (redisClient && redisClientType) {
    try {
      await redisClient.del(key);
      console.log(`✅ Redis: Deleted preview for plan ${planId}`);
    } catch (error: any) {
      console.error('❌ Redis: Failed to delete preview:', error.message);
    }
  }
  
  memoryCache.delete(key);
}
