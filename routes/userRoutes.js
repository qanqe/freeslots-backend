const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const verifyTelegram = require('../middlewares/verifyTelegram');
const asyncHandler = require('../middlewares/asyncHandler');
const telegramAuth = require('../middlewares/telegramAuth');

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

// -------- AUTH/Register --------
router.post(
  '/auth',
  authLimiter,
  verifyTelegram,
  validateAuthUser,
  asyncHandler(userController.authUser)
);

// -------- Paid Spin (costs coins to win coins or gems) --------
router.post(
  '/spin',
  spinLimiter,
  verifyTelegram,
  validateSpin,
  asyncHandler(userController.spin)
);

// -------- Free Slot Spin (777-style coin rewards) --------
router.post(
  '/free-slot',
  spinLimiter, // still rate limited to prevent abuse
  verifyTelegram,
  asyncHandler(userController.freeSlot)
);

// -------- Daily Check-in --------
router.post(
  '/checkin',
  verifyTelegram,
  validateCheckIn,
  asyncHandler(userController.checkIn)
);

// -------- Referral --------
router.post(
  '/referral',
  referralLimiter,
  verifyTelegram,
  validateReferral,
  asyncHandler(userController.referral)
);

// -------- Referral Info --------
router.get(
  '/referral-info',
  telegramAuth,
  asyncHandler(userController.referralInfo)
);

// -------- Reward Logs --------
router.get(
  '/rewards',
  verifyTelegram,
  asyncHandler(userController.getRewardLogs)
);

// ✅ CORRECT EXPORT
module.exports = router;
