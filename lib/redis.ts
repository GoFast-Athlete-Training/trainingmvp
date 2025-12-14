// Redis client for storing preview data
// Uses Upstash Redis (compatible with Vercel) or falls back to in-memory cache for dev

let redisClient: any = null;

// Try to initialize Upstash Redis if available
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    // Dynamic import for Upstash Redis
    const { Redis } = require('@upstash/redis');
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    console.log('✅ Redis: Using Upstash Redis');
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

  if (redisClient) {
    try {
      await redisClient.setex(key, PREVIEW_TTL, JSON.stringify(previewData));
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

  if (redisClient) {
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

  if (redisClient) {
    try {
      await redisClient.del(key);
      console.log(`✅ Redis: Deleted preview for plan ${planId}`);
    } catch (error) {
      console.error('❌ Redis: Failed to delete preview:', error);
    }
  }
  
  memoryCache.delete(key);
}
