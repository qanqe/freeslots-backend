const User = require('../models/User');

exports.adminCheck = async (req, res, next) => {
  if (!req.telegramData?.user?.id) {
    return res.status(401).json({
      success: false,
      error: 'Unauthorized: Telegram authentication missing or invalid.'
    });
  }

  const telegramId = req.telegramData.user.id;

  try {
    const user = await User.findOne({ telegramId }).select('+isAdmin').lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found.'
      });
    }

    if (!user.isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden: Admin access required.'
      });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('adminCheck error:', err);
    res.status(500).json({
      success: false,
      error: 'Server error during authorization check.'
    });
  }
};
