const rateLimit = require('express-rate-limit');

const commonLimiterOptions = {
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: (req, res) => res.status(429).json({
    success: false,
    error: 'Too many requests, please try again later.'
  })
};

// Global limiter
const globalLimiter = rateLimit({
  ...commonLimiterOptions,
  windowMs: 60 * 1000, // 1 min
  max: parseInt(process.env.GLOBAL_RATE_LIMIT_MAX_REQUESTS || '100'),
  message: (req, res) => res.status(429).json({
    success: false,
    error: 'Too many global requests, please try again in a minute.'
  }),
  keyGenerator: (req) =>
    req.telegramData?.user?.id?.toString() || req.ip
});

// Spin limiter
const spinLimiter = rateLimit({
  ...commonLimiterOptions,
  windowMs: 60 * 1000,
  max: parseInt(process.env.SPIN_RATE_LIMIT_MAX_REQUESTS || '10'),
  message: (req, res) => res.status(429).json({
    success: false,
    error: 'Too many spins, please wait a moment.'
  }),
  keyGenerator: (req) => req.telegramData?.user?.id?.toString() || req.ip
});

// Check-in limiter
const checkinLimiter = rateLimit({
  ...commonLimiterOptions,
  windowMs: 24 * 60 * 60 * 1000, // 1 day
  max: parseInt(process.env.CHECKIN_RATE_LIMIT_MAX_REQUESTS || '1'),
  message: (req, res) => res.status(429).json({
    success: false,
    error: 'You have already checked in today. Try again tomorrow.'
  }),
  keyGenerator: (req) => req.telegramData?.user?.id?.toString() || req.ip
});

// Referral limiter
const referralLimiter = rateLimit({
  ...commonLimiterOptions,
  windowMs: 5 * 60 * 1000,
  max: parseInt(process.env.REFERRAL_RATE_LIMIT_MAX_REQUESTS || '5'),
  message: (req, res) => res.status(429).json({
    success: false,
    error: 'Too many referral attempts, please try again later.'
  }),
  keyGenerator: (req) => req.telegramData?.user?.id?.toString() || req.ip
});

// Auth limiter
const authLimiter = rateLimit({
  ...commonLimiterOptions,
  windowMs: 5 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || '30'),
  message: (req, res) => res.status(429).json({
    success: false,
    error: 'Too many authentication attempts, please try again later.'
  }),
  keyGenerator: (req) => req.telegramData?.user?.id?.toString() || req.ip
});

// Admin limiter
const adminLimiter = rateLimit({
  ...commonLimiterOptions,
  windowMs: 5 * 60 * 1000,
  max: parseInt(process.env.ADMIN_RATE_LIMIT_MAX_REQUESTS || '20'),
  message: (req, res) => res.status(429).json({
    success: false,
    error: 'Too many admin requests, please slow down.'
  }),
  keyGenerator: (req) => req.user?.telegramId?.toString() || req.ip
});

module.exports = {
  globalLimiter,
  spinLimiter,
  checkinLimiter,
  referralLimiter,
  authLimiter,
  adminLimiter
};
