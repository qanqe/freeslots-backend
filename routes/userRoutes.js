const express = require('express');
const router = express.Router();

const userController = require('../controllers/userController');
const verifyTelegram = require('../middlewares/verifyTelegram');
const asyncHandler = require('../middlewares/asyncHandler');
const {
  authLimiter,
  spinLimiter,
  checkinLimiter,
  referralLimiter
} = require('../middlewares/Limiter');

const {
  validateAuthUser,
  validateSpin,
  validateCheckIn,
  validateReferral
} = require('../middlewares/validation');

// Auth/Register
router.post(
  '/auth',
  authLimiter,
  verifyTelegram,
  validateAuthUser,
  asyncHandler(userController.authUser)
);

// Spin
router.post(
  '/spin',
  spinLimiter,
  verifyTelegram,
  validateSpin,
  asyncHandler(userController.spin)
);

// Daily Check-in
router.post(
  '/checkin',
  checkinLimiter,
  verifyTelegram,
  validateCheckIn,
  asyncHandler(userController.checkIn)
);

// Referral
router.post(
  '/referral',
  referralLimiter,
  verifyTelegram,
  validateReferral,
  asyncHandler(userController.referral)
);

// Reward Logs (pagination via query params)
router.get(
  '/rewards',
  verifyTelegram,
  asyncHandler(userController.getRewardLogs)
);

module.exports = router;
