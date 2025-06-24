const express = require('express');
const router = express.Router();

const adminController = require('../controllers/adminController');
const verifyTelegram = require('../middlewares/verifyTelegram');
const { adminCheck } = require('../middlewares/auth');
const asyncHandler = require('../middlewares/asyncHandler');
const { adminLimiter } = require('../middlewares/Limiter');
const {
  validatePromoteUser,
  validateTelegramIdBody
} = require('../middlewares/validation');

// GET all users (paginated)
router.get(
  '/users',
  verifyTelegram,
  adminCheck,
  adminLimiter,
  asyncHandler(adminController.getAllUsers)
);

// Promote a user to admin
router.post(
  '/promote',
  verifyTelegram,
  adminCheck,
  adminLimiter,
  validatePromoteUser,
  asyncHandler(adminController.promoteUser)
);

// Reset user data
router.post(
  '/reset-user',
  verifyTelegram,
  adminCheck,
  adminLimiter,
  validateTelegramIdBody,
  asyncHandler(adminController.resetUser)
);

// Delete a user
router.delete(
  '/delete-user',
  verifyTelegram,
  adminCheck,
  adminLimiter,
  validateTelegramIdBody,
  asyncHandler(adminController.deleteUser)
);

module.exports = router;
