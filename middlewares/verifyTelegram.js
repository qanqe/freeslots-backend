const { checkTelegramAuth } = require('../util/checkTelegramAuth'); // Use correct path

const verifyTelegram = async (req, res, next) => {
  const initData =
    req.body.initData ||
    req.headers['x-telegram-auth'] ||
    req.headers['x-telegram-init-data'];

  if (!initData) {
    console.log('[verifyTelegram] ❌ Missing initData');
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Telegram initData is missing.'
    });
  }

  try {
    const result = checkTelegramAuth(initData);
    const { isValid, user: telegramUser, auth_date } = result;

    console.log('[verifyTelegram] ✅ Auth Check Result:', result);

    if (!isValid) {
      console.log('[verifyTelegram] ❌ Invalid Signature');
      return res.status(401).json({
        success: false,
        error: 'Unauthorized: Invalid Telegram initData signature.'
      });
    }

    const now = Math.floor(Date.now() / 1000);
    const maxAge = parseInt(process.env.TELEGRAM_AUTH_MAX_AGE_SECONDS || '3600', 10);

    if (now - auth_date > maxAge) {
      console.log(`[verifyTelegram] ❌ Expired: now=${now}, auth_date=${auth_date}`);
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
    console.error('[verifyTelegram] ❌ Exception:', err);
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
