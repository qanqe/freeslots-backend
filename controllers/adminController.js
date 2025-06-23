const User = require('../models/User');
const RewardLog = require('../models/RewardLog');
const mongoose = require('mongoose');

const toDecimal128 = (value) => new mongoose.Types.Decimal128(value.toString());
const fromDecimal128 = (decimal) => parseFloat(decimal?.toString() || '0');

const USERS_PER_PAGE = parseInt(process.env.ADMIN_USERS_PER_PAGE || '50', 10);

// GET /api/admin/users
exports.getAllUsers = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || USERS_PER_PAGE;
  const skip = (page - 1) * limit;

  try {
    const users = await User.find({})
      .skip(skip)
      .limit(limit)
      .lean();

    const totalUsers = await User.countDocuments({});

    res.json({
      success: true,
      users: users.map(user => ({
        telegramId: user.telegramId,
        username: user.username,
        coinBalance: fromDecimal128(user.coinBalance),
        gems: fromDecimal128(user.gems),
        bonusSlots: user.bonusSlots,
        lastCheckIn: user.lastCheckIn,
        streakCount: user.streakCount,
        referrerId: user.referrerId,
        referralCount: user.referralCount,
        isAdmin: user.isAdmin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      })),
      pagination: {
        total: totalUsers,
        page,
        limit,
        pages: Math.ceil(totalUsers / limit),
      },
    });
  } catch (err) {
    console.error('Error in getAllUsers:', err);
    res.status(500).json({ success: false, error: 'Server error fetching users.' });
  }
};

// POST /api/admin/promote
exports.promoteUser = async (req, res) => {
  const { targetTelegramId } = req.body;
  const adminTelegramId = req.user.telegramId;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userToPromote = await User.findOne({ telegramId: targetTelegramId }).session(session);

    if (!userToPromote) {
      throw new Error('Target user not found.');
    }

    if (userToPromote.isAdmin) {
      throw new Error('User is already an admin.');
    }

    userToPromote.isAdmin = true;
    await userToPromote.save({ session });

    await RewardLog.create([{
      telegramId: adminTelegramId,
      type: 'admin_adjustment',
      rewardType: 'admin_promote',
      amount: toDecimal128(0),
      details: `Promoted user ${targetTelegramId} to admin.`,
      targetTelegramId,
      timestamp: new Date()
    }], { session });

    await session.commitTransaction();
    res.json({
      success: true,
      message: `User ${targetTelegramId} has been promoted to admin.`,
      user: {
        telegramId: userToPromote.telegramId,
        isAdmin: true
      }
    });
  } catch (err) {
    await session.abortTransaction();
    console.error('Error in promoteUser:', err);
    res.status(500).json({ success: false, error: err.message || 'Server error promoting user.' });
  } finally {
    session.endSession();
  }
};

// POST /api/admin/reset-user
exports.resetUser = async (req, res) => {
  const { telegramId: targetTelegramId } = req.body;
  const adminTelegramId = req.user.telegramId;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userToReset = await User.findOne({ telegramId: targetTelegramId }).session(session);

    if (!userToReset) throw new Error('Target user not found.');

    userToReset.coinBalance = toDecimal128(0);
    userToReset.gems = toDecimal128(0);
    userToReset.bonusSlots = 0;
    userToReset.lastCheckIn = null;
    userToReset.streakCount = 0;
    userToReset.referrerId = null;
    userToReset.referralCount = 0;

    await userToReset.save({ session });

    await RewardLog.create({
      telegramId: adminTelegramId,
      type: 'admin_adjustment',
      rewardType: 'user_reset',
      amount: toDecimal128(0),
      details: `Reset game data for user ${targetTelegramId}.`,
      targetTelegramId,
      timestamp: new Date()
    }, { session });

    await RewardLog.deleteMany({ telegramId: targetTelegramId }, { session });

    await session.commitTransaction();

    res.json({
      success: true,
      message: `User ${targetTelegramId}'s data has been reset.`,
      user: {
        telegramId: userToReset.telegramId,
        coinBalance: fromDecimal128(userToReset.coinBalance),
        gems: fromDecimal128(userToReset.gems),
        bonusSlots: userToReset.bonusSlots,
        lastCheckIn: userToReset.lastCheckIn,
        streakCount: userToReset.streakCount,
        referralCount: userToReset.referralCount,
        referrerId: userToReset.referrerId
      }
    });
  } catch (err) {
    await session.abortTransaction();
    console.error('Error in resetUser:', err);
    res.status(500).json({ success: false, error: err.message || 'Server error resetting user data.' });
  } finally {
    session.endSession();
  }
};

// DELETE /api/admin/delete-user
exports.deleteUser = async (req, res) => {
  const { telegramId: targetTelegramId } = req.body;
  const adminTelegramId = req.user.telegramId;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userToDelete = await User.findOne({ telegramId: targetTelegramId }).session(session);

    if (!userToDelete) throw new Error('Target user not found.');
    if (targetTelegramId === adminTelegramId) {
      throw new Error('Forbidden: You cannot delete your own admin account.');
    }

    await User.deleteOne({ telegramId: targetTelegramId }, { session });
    await RewardLog.deleteMany({ telegramId: targetTelegramId }, { session });

    await RewardLog.create({
      telegramId: adminTelegramId,
      type: 'admin_adjustment',
      rewardType: 'user_delete',
      amount: toDecimal128(0),
      details: `Deleted user ${targetTelegramId} and all associated data.`,
      targetTelegramId,
      timestamp: new Date()
    }, { session });

    await session.commitTransaction();

    res.json({
      success: true,
      message: `User ${targetTelegramId} and all associated data have been deleted.`,
    });
  } catch (err) {
    await session.abortTransaction();
    console.error('Error in deleteUser:', err);
    res.status(500).json({ success: false, error: err.message || 'Server error deleting user.' });
  } finally {
    session.endSession();
  }
};
