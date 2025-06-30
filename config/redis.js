// redis.js

const { Redis } = require('@upstash/redis');

// Automatically pulls UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN from environment
const redis = Redis.fromEnv();

(async () => {
  try {
    // Simple health check (can be removed in production)
    await redis.set('healthcheck', 'ok');
    const result = await redis.get('healthcheck');
    console.log('✅ Redis connected via Upstash. Test value:', result);
  } catch (err) {
    console.error('❌ Redis connection failed:', err.message);
  }
})();

// Export for use in other parts of your backend
module.exports = redis;
