const { checkTelegramAuth } = require('../utils/telegramAuth');
const User = require('../models/User');

const verifyTelegram = async (req, res, next) => {
  const initData = req.body.initData || req.headers['x-telegram-init-data'];

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

    // Ensure user exists in DB so subsequent logic can depend on it
    let user = await User.findOne({ telegramId: req.telegramData.user.id });
    if (!user) {
      const fallbackUsername = telegramUser.username || `${telegramUser.first_name} ${telegramUser.last_name || ''}`.trim();
      user = new User({
        telegramId: req.telegramData.user.id,
        username: fallbackUsername,
        coinBalance: 0,
        gems: 0
      });
      await user.save();
    }

    req.user = user;
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
