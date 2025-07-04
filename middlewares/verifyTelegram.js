// middlewares/verifyTelegram.js
const { checkTelegramAuth } = require('./telegramAuth');

const verifyTelegram = async (req, res, next) => {
  const initData =
    req.body.initData ||
    req.headers['x-telegram-auth'] ||
    req.headers['x-telegram-init-data'];

  if (!initData) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Telegram initData is missing.'
    });
  }

  try {
    const { isValid, user: telegramUser, auth_date } = checkTelegramAuth(initData);

    if (!isValid) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid Telegram initData signature.'
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const maxAge = parseInt(process.env.TELEGRAM_AUTH_MAX_AGE_SECONDS || '3600', 10);
    if (now - auth_date > maxAge) {
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Telegram initData has expired.'
      });
    }

    req.telegramData = {
      user: {
        id: telegramUser.id.toString(),
        first_name: telegramUser.first_name,
        last_name: telegramUser.last_name,
        username: telegramUser.username,
        language_code: telegramUser.language_code
      },
      auth_date
    };

    next();

  } catch (err) {
    console.error('verifyTelegram error:', err);
    const isAuthError = err.message.includes('Invalid') || err.message.includes('HMAC');
    res.status(isAuthError ? 401 : 500).json({
      success: false,
      error: isAuthError
        ? 'Unauthorized: Invalid Telegram authentication.'
        : 'Server error during Telegram authentication.'
    });
  }
};

module.exports = verifyTelegram;
