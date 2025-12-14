// Redis client for storing preview data
// Supports Upstash Redis (REST API) or Redis Labs (connection string) or falls back to in-memory cache

let redisClient: any = null;
let redisClientType: 'upstash' | 'standard' | null = null;

// Try to initialize Redis if available
const redisUrl = process.env.REDIS_URL;
const upstashUrl = process.env.UPSTASH_REDIS_REST_URL;
const upstashToken = process.env.UPSTASH_REDIS_REST_TOKEN;

// Priority: 1) Redis Labs connection string, 2) Upstash REST API
if (redisUrl && redisUrl.startsWith('redis://')) {
  try {
    // Redis Labs connection string format: redis://default:password@host:port
    const { createClient } = require('redis');
    redisClient = createClient({
      url: redisUrl,
    });
    redisClient.on('error', (err: any) => console.error('❌ Redis Client Error:', err));
    redisClient.connect().then(() => {
      console.log('✅ Redis: Connected using connection string');
      redisClientType = 'standard';
    }).catch((err: any) => {
      console.warn('⚠️ Redis: Failed to connect with connection string:', err.message);
      redisClient = null;
    });
  } catch (error) {
    console.warn('⚠️ Redis: redis package not available, trying Upstash...');
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
  } catch (error) {
    console.warn('⚠️ Redis: Failed to initialize Upstash Redis, using in-memory cache');
  }
}

// In-memory cache fallback for development
const memoryCache = new Map<string, { data: any; expires: number }>();

// TTL: 1 hour (3600 seconds)
const PREVIEW_TTL = 3600;

export async function setPreview(planId: string, previewData: any): Promise<void> {
  const key = `preview:${planId}`;
  const expiresAt = Date.now() + PREVIEW_TTL * 1000;

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
    } catch (error) {
      console.error('❌ Redis: Failed to store preview:', error);
      // Fallback to memory cache
      memoryCache.set(key, { data: previewData, expires: expiresAt });
    }
  } else {
    // Use in-memory cache
    memoryCache.set(key, { data: previewData, expires: expiresAt });
    console.log(`✅ Memory: Stored preview for plan ${planId}`);
  }
}

export async function getPreview(planId: string): Promise<any | null> {
  const key = `preview:${planId}`;

  if (redisClient && redisClientType) {
    try {
      const data = await redisClient.get(key);
      if (data) {
        return typeof data === 'string' ? JSON.parse(data) : data;
      }
      return null;
    } catch (error) {
      console.error('❌ Redis: Failed to get preview:', error);
      // Fallback to memory cache
      const cached = memoryCache.get(key);
      if (cached && cached.expires > Date.now()) {
        return cached.data;
      }
      return null;
    }
  } else {
    // Use in-memory cache
    const cached = memoryCache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
    // Clean up expired entries
    if (cached) {
      memoryCache.delete(key);
    }
    return null;
  }
}

export async function deletePreview(planId: string): Promise<void> {
  const key = `preview:${planId}`;

  if (redisClient && redisClientType) {
    try {
      await redisClient.del(key);
      console.log(`✅ Redis: Deleted preview for plan ${planId}`);
    } catch (error) {
      console.error('❌ Redis: Failed to delete preview:', error);
    }
  }
  
  memoryCache.delete(key);
}
