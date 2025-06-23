const redis = require('redis');

const client = redis.createClient({
  url: process.env.REDIS_URL,
  socket: {
    // Enable TLS only if REDIS_URL uses "rediss://"
    tls: process.env.REDIS_URL?.startsWith('rediss://'),
    rejectUnauthorized: false
  }
});

client.on('error', (err) => {
  console.error('❌ Redis error:', err);
});

client.on('connect', () => {
  console.log('✅ Redis client connected');
});

(async () => {
  try {
    await client.connect();
  } catch (err) {
    console.error('❌ Failed to connect to Redis:', err);
  }
})();

module.exports = client;
