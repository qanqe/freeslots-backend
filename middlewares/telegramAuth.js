// middlewares/telegramAuth.js
const crypto = require('crypto');

/**
 * Verifies Telegram WebApp initData using HMAC SHA256.
 * Returns an object with { isValid, user, auth_date }
 */
const checkTelegramAuth = (initData) => {
  const telegramBotToken = process.env.BOT_TOKEN;
  if (!telegramBotToken) {
    throw new Error('BOT_TOKEN is not set in environment variables.');
  }

  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  params.delete('hash');

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => `${key}=${val}`)
    .join('\n');

  const secret = crypto.createHmac('sha256', 'WebAppData')
    .update(telegramBotToken)
    .digest();

  const calculatedHash = crypto.createHmac('sha256', secret)
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
    console.error('Telegram initData parse error:', err);
    return { isValid: false, user: null, auth_date: 0 };
  }

  let isValid = false;
  try {
    isValid = crypto.timingSafeEqual(
      Buffer.from(calculatedHash, 'hex'),
      Buffer.from(hash, 'hex')
    );
  } catch (err) {
    isValid = false;
  }

  return { isValid, user, auth_date };
};

module.exports = { checkTelegramAuth };
