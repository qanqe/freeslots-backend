// Replace the entire content of your Redis file with this:

const redis = require('redis');

// This one line of logic defines the correct URL for any environment.
const redisUrl = process.env.REDIS_URL || 'redis://red-d1di7h95pdvs73ajf170:6379';

const client = redis.createClient({
  url: redisUrl
});

client.on('error', (err) => {
  console.error('❌ Redis error:', err);
});

// I've added a log here so you can see WHICH Redis instance you connected to.
client.on('connect', () => {
  console.log('✅ Redis client connected to:', redisUrl);
});

(async () => {
  try {
    await client.connect();
  } catch (err) {
    console.error('❌ Failed to connect to Redis:', err);
  }
})();

module.exports = client;