// src/util/checkTelegramAuth.js
const crypto = require('crypto');

// Validate Telegram initData string and return { isValid, user, auth_date }
function checkTelegramAuth(initData) {
  const telegramBotToken = process.env.BOT_TOKEN;
  if (!telegramBotToken) {
    throw new Error('BOT_TOKEN is not set in environment variables.');
  }

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) {
    return { isValid: false, user: null, auth_date: 0 };
  }

  params.delete('hash');

  // Build data check string
  const dataCheckString = [...params.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => `${key}=${val}`)
    .join('\n');

  // Derive the secret key and compute the hash
  const secretKey = crypto.createHmac('sha256', 'WebAppData')
    .update(telegramBotToken)
    .digest();

  const calculatedHash = crypto.createHmac('sha256', secretKey)
    .update(dataCheckString)
    .digest('hex');

  let user = null;
  let auth_date = 0;

  try {
    const userData = params.get('user');
    if (userData) {
      user = JSON.parse(decodeURIComponent(userData));
    }
    const authDateStr = params.get('auth_date');
    if (authDateStr) {
      auth_date = parseInt(authDateStr, 10);
    }
  } catch (err) {
    console.error('[checkTelegramAuth] Failed to parse user or auth_date:', err);
    return { isValid: false, user: null, auth_date: 0 };
  }

  let isValid = false;
  try {
    isValid = crypto.timingSafeEqual(
      Buffer.from(calculatedHash, 'hex'),
      Buffer.from(hash, 'hex')
    );
  } catch (err) {
    console.error('[checkTelegramAuth] timingSafeEqual error:', err);
    isValid = false;
  }

  // Optional debug logs:
console.log('--- Telegram Auth Debug ---');
console.log('initData:', initData);
console.log('dataCheckString:', dataCheckString);
console.log('calculatedHash:', calculatedHash);
console.log('receivedHash:', hash);

  return { isValid, user, auth_date };
}

module.exports = checkTelegramAuth;
