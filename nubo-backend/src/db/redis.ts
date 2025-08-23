import { createClient } from 'redis';

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

export const redisClient = createClient({
  url: redisUrl
});

redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err);
});

redisClient.on('connect', () => {
  console.log('Connected to Redis');
});

// Connect to Redis
(async () => {
  try {
    await redisClient.connect();
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
  }
})();

// Cache email body with TTL of 4 hours
export async function cacheEmailBody(emailId: string, body: any) {
  try {
    await redisClient.setEx(
      `email:body:${emailId}`,
      4 * 60 * 60, // 4 hours TTL
      JSON.stringify(body)
    );
  } catch (error) {
    console.error('Failed to cache email body:', error);
  }
}

// Get cached email body
export async function getCachedEmailBody(emailId: string) {
  try {
    const cached = await redisClient.get(`email:body:${emailId}`);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('Failed to get cached email body:', error);
    return null;
  }
}

// Cache email list with TTL of 5 minutes
export async function cacheEmailList(key: string, emails: any[]) {
  try {
    await redisClient.setEx(
      key,
      5 * 60, // 5 minutes TTL
      JSON.stringify(emails)
    );
  } catch (error) {
    console.error('Failed to cache email list:', error);
  }
}

// Get cached email list
export async function getCachedEmailList(key: string) {
  try {
    const cached = await redisClient.get(key);
    return cached ? JSON.parse(cached) : null;
  } catch (error) {
    console.error('Failed to get cached email list:', error);
    return null;
  }
}

// Clear cache for user
export async function clearUserCache(userId: number) {
  try {
    const keys = await redisClient.keys(`user:${userId}:*`);
    if (keys.length > 0) {
      await redisClient.del(keys);
    }
  } catch (error) {
    console.error('Failed to clear user cache:', error);
  }
}