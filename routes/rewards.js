const express = require('express');
const router = express.Router();

const userController = require('../controllers/userController');
const verifyTelegram = require('../middlewares/verifyTelegram');
const asyncHandler = require('../middlewares/asyncHandler');

// GET /api/rewards — Get current user's reward logs
router.get(
  '/',
  verifyTelegram,
  asyncHandler(userController.getRewardLogs)
);

module.exports = router;
