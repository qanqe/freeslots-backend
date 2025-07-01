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
  windowMs: 60 * 1000, // 1 minute
  max: parseInt(process.env.GLOBAL_RATE_LIMIT_MAX_REQUESTS || '100'),
  message: (req, res) => res.status(429).json({
    success: false,
    error: 'Too many global requests, please try again in a minute.'
  }),
  keyGenerator: (req) =>
    req.telegramData?.user?.id?.toString() || req.ip
});

// Paid spin limiter (Spin Page - uses coins)
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

// Free spin limiter (Home Page - 777 slot, unlimited but soft limit to prevent spam abuse)
const freeSpinLimiter = rateLimit({
  ...commonLimiterOptions,
  windowMs: 1000, // 1 second
  max: parseInt(process.env.FREE_SPIN_RATE_LIMIT_MAX_REQUESTS || '10'), // up to 10 spins per second
  message: (req, res) => res.status(429).json({
    success: false,
    error: 'Too many free spins too quickly. Please slow down.'
  }),
  keyGenerator: (req) => req.telegramData?.user?.id?.toString() || req.ip
});

// Daily check-in limiter
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
  freeSpinLimiter,
  checkinLimiter,
  referralLimiter,
  authLimiter,
  adminLimiter
};
