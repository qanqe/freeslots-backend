const apicache = require('apicache');
const cache = apicache.middleware;

// Cache middleware: duration (e.g., '5 minutes')
module.exports = (duration) =>
  cache(duration, (req) => {
    return req.user?.telegramId || req.telegramData?.user?.id || req.ip;
  });
