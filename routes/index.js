const express = require('express');
const router = express.Router();

// Route modules
const userRoutes = require('./userRoutes');
const adminRoutes = require('./admin');
const rewardLogsRoutes = require('./rewards');

// Mount API routes
router.use('/user', userRoutes);       // /api/user/*
router.use('/admin', adminRoutes);     // /api/admin/*
router.use('/rewards', rewardLogsRoutes); // /api/rewards/*

// Health check route
router.get('/', (req, res) => {
  res.json({
    api: 'FreeSlots Backend',
    version: '1.0',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Optional: apply protectAdmin in production
if (process.env.NODE_ENV === 'production') {
  const protectAdmin = require('../middlewares/auth');
  router.use('/admin', protectAdmin.adminCheck);
}

module.exports = router;
