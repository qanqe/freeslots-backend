const mongoose = require('mongoose');
const User = require('../models/User');
const RewardLog = require('../models/RewardLog');
const AuditLog = require('../models/AuditLog');
const redis = require('../config/redis');

// Decimal utilities
const Decimal = {
  add: (a, b) => new mongoose.Types.Decimal128((parseFloat(a.toString()) + parseFloat(b.toString())).toString()),
  sub: (a, b) => new mongoose.Types.Decimal128((parseFloat(a.toString()) - parseFloat(b.toString())).toString()),
  toNumber: (d) => parseFloat(d?.toString() || '0'),
  fromNumber: (n) => new mongoose.Types.Decimal128(n.toString()),
  isGreaterOrEqual: (a, b) => parseFloat(a.toString()) >= parseFloat(b.toString())
};

const CONFIG = {
  SPIN: {
    COST: parseFloat(process.env.SPIN_COST_COINS || 10),
    COIN_CHANCE: parseFloat(process.env.COIN_REWARD_CHANCE || 0.6),
    GEM_CHANCE_END: parseFloat(process.env.GEM_REWARD_CHANCE_RANGE_END || 0.8),
    COIN_REWARDS: [1, 2, 5]
  },
  CHECKIN: {
    BASE_REWARD: parseFloat(process.env.CHECKIN_BASE_COIN_REWARD || 1),
    STREAK_BONUSES: {
      3: parseInt(process.env.STREAK_3_BONUS_SLOTS || 1),
      5: parseInt(process.env.STREAK_5_BONUS_SLOTS || 2),
      7: parseInt(process.env.STREAK_7_BONUS_SLOTS || 3),
      OVER_7: parseInt(process.env.STREAK_OVER_7_BONUS_SLOTS || 1)
    }
  },
  REFERRAL: {
    NEW_USER: parseFloat(process.env.REFERRAL_BONUS_NEW_USER_COINS || 10),
    REFERRER: {
      COINS: parseFloat(process.env.REFERRAL_BONUS_REFERRER_COINS || 5),
      SLOTS: parseInt(process.env.REFERRAL_BONUS_REFERRER_SLOTS || 1)
    }
  },
  PAGINATION: {
    REWARD_LOGS: parseInt(process.env.REWARD_LOGS_PER_PAGE || 20)
  }
};

const Cache = {
  getUser: async (id) => {
    const val = await redis.get(`user:${id}`);
    return val ? JSON.parse(val) : null;
  },
  setUser: async (id, user) => {
    await redis.setEx(`user:${id}`, 300, JSON.stringify(user));
  },
  invalidate: async (id) => await redis.del(`user:${id}`)
};

const withTransaction = async (fn) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const result = await fn(session);
    await session.commitTransaction();
    return result;
  } catch (e) {
    await session.abortTransaction();
    throw e;
  } finally {
    session.endSession();
  }
};

const logAction = async (req, action, details) => {
  try {
    await AuditLog.create({
      userId: req.telegramData.user.id,
      action,
      details,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      timestamp: new Date()
    });
  } catch (e) {
    console.error('Audit log failed:', e);
  }
};

const DateUtils = {
  isSameDay: (a, b) => a.toDateString() === b.toDateString(),
  isYesterday: (a, now = new Date()) => {
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    return a.toDateString() === y.toDateString();
  }
};

// ---------------------- AUTH USER ----------------------
exports.authUser = async (req, res) => {
  try {
    const { username, referrerId } = req.body;
    const telegramId = req.telegramData.user.id;

    const result = await withTransaction(async (session) => {
      let user = await User.findOne({ telegramId }).session(session);
      const isNewUser = !user;

      if (isNewUser) {
        user = new User({
          telegramId,
          username,
          coinBalance: Decimal.fromNumber(0),
          gems: Decimal.fromNumber(0)
        });

        if (referrerId && telegramId !== referrerId) {
          const referrer = await User.findOne({ telegramId: referrerId }).session(session);
          if (referrer) {
            referrer.coinBalance = Decimal.add(referrer.coinBalance, Decimal.fromNumber(CONFIG.REFERRAL.REFERRER.COINS));
            referrer.bonusSlots += CONFIG.REFERRAL.REFERRER.SLOTS;
            referrer.referralCount += 1;

            await referrer.save({ session });

            user.referrerId = referrerId;
            user.coinBalance = Decimal.fromNumber(CONFIG.REFERRAL.NEW_USER);

            await RewardLog.create([
              {
                telegramId,
                type: 'referral',
                rewardType: 'coin',
                amount: user.coinBalance,
                timestamp: new Date()
              },
              {
                telegramId: referrerId,
                type: 'referral',
                rewardType: 'coin',
                amount: Decimal.fromNumber(CONFIG.REFERRAL.REFERRER.COINS),
                timestamp: new Date()
              },
              {
                telegramId: referrerId,
                type: 'referral',
                rewardType: 'bonus_slot',
                amount: CONFIG.REFERRAL.REFERRER.SLOTS,
                timestamp: new Date()
              }
            ], { session });
          }
        }
      } else if (user.username !== username) {
        user.username = username;
      }

      await user.save({ session });
      await Cache.setUser(telegramId, user);
      await logAction(req, isNewUser ? 'register' : 'login', {});

      return {
        user: {
          telegramId: user.telegramId,
          username: user.username,
          coinBalance: Decimal.toNumber(user.coinBalance),
          gems: Decimal.toNumber(user.gems),
          bonusSlots: user.bonusSlots,
          streakCount: user.streakCount,
          lastCheckIn: user.lastCheckIn,
          referrerId: user.referrerId,
          referralCount: user.referralCount
        }
      };
    });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('authUser error:', err);
    res.status(500).json({ success: false, error: 'Authentication failed' });
  }
};

// ---------------------- SPIN ----------------------
exports.spin = async (req, res) => {
  try {
    const telegramId = req.telegramData.user.id;

    const result = await withTransaction(async (session) => {
      const user = await User.findOne({ telegramId }).session(session);
      if (!user) throw new Error('User not found');

      const coinSlots = Math.floor(Decimal.toNumber(user.coinBalance) / CONFIG.SPIN.COST);
      const availableSlots = coinSlots + user.bonusSlots;

      if (availableSlots <= 0) throw new Error(`Requires ${CONFIG.SPIN.COST} coins or 1 bonus slot`);

      let cost = 0;
      if (user.bonusSlots > 0) {
        user.bonusSlots -= 1;
      } else {
        cost = CONFIG.SPIN.COST;
        user.coinBalance = Decimal.sub(user.coinBalance, Decimal.fromNumber(cost));
      }

      let reward = { type: 'none', amount: 0 };
      const roll = Math.random();

      if (roll < CONFIG.SPIN.COIN_CHANCE) {
        const amount = CONFIG.SPIN.COIN_REWARDS[Math.floor(Math.random() * CONFIG.SPIN.COIN_REWARDS.length)];
        reward = { type: 'coin', amount };
        user.coinBalance = Decimal.add(user.coinBalance, Decimal.fromNumber(amount));
      } else if (roll < CONFIG.SPIN.GEM_CHANCE_END) {
        reward = { type: 'gem', amount: 1 };
        user.gems = Decimal.add(user.gems, Decimal.fromNumber(1));
      }

      const logs = [{
        telegramId,
        type: 'spin_cost',
        rewardType: 'coin',
        amount: Decimal.fromNumber(-cost),
        timestamp: new Date()
      }];

      if (reward.type !== 'none') {
        logs.push({
          telegramId,
          type: 'spin_reward',
          rewardType: reward.type,
          amount: Decimal.fromNumber(reward.amount),
          timestamp: new Date()
        });
      }

      await RewardLog.create(logs, { session });
      await user.save({ session });
      await Cache.setUser(telegramId, user);
      await logAction(req, 'spin', { cost, reward });

      return {
        cost,
        reward,
        balance: {
          coins: Decimal.toNumber(user.coinBalance),
          gems: Decimal.toNumber(user.gems),
          bonusSlots: user.bonusSlots
        }
      };
    });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('spin error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
};

// ---------------------- CHECK-IN ----------------------
exports.checkIn = async (req, res) => {
  try {
    const telegramId = req.telegramData.user.id;

    const result = await withTransaction(async (session) => {
      const user = await User.findOne({ telegramId }).session(session);
      if (!user) throw new Error('User not found');

      const now = new Date();
      const last = user.lastCheckIn ? new Date(user.lastCheckIn) : null;

      if (last && DateUtils.isSameDay(now, last)) throw new Error('Already checked in today');

      let newStreak = 1;
      if (last && DateUtils.isYesterday(last, now)) {
        newStreak = user.streakCount + 1;
      }

      let bonusSlots = 0;
      if (newStreak === 3) bonusSlots = CONFIG.CHECKIN.STREAK_BONUSES[3];
      else if (newStreak === 5) bonusSlots = CONFIG.CHECKIN.STREAK_BONUSES[5];
      else if (newStreak === 7) bonusSlots = CONFIG.CHECKIN.STREAK_BONUSES[7];
      else if (newStreak > 7) bonusSlots = CONFIG.CHECKIN.STREAK_BONUSES.OVER_7;

      user.lastCheckIn = now;
      user.streakCount = newStreak;
      user.coinBalance = Decimal.add(user.coinBalance, Decimal.fromNumber(CONFIG.CHECKIN.BASE_REWARD));
      user.bonusSlots += bonusSlots;

      await RewardLog.create({
        telegramId,
        type: 'checkin',
        rewardType: bonusSlots > 0 ? 'coin_and_slot' : 'coin',
        amount: Decimal.fromNumber(CONFIG.CHECKIN.BASE_REWARD + bonusSlots * 10),
        timestamp: now
      }, { session });

      await user.save({ session });
      await Cache.setUser(telegramId, user);
      await logAction(req, 'checkin', { streak: newStreak, bonusSlots });

      return {
        streak: newStreak,
        coinReward: CONFIG.CHECKIN.BASE_REWARD,
        bonusSlots,
        balance: {
          coins: Decimal.toNumber(user.coinBalance),
          bonusSlots: user.bonusSlots
        }
      };
    });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('checkIn error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
};

// ---------------------- REFERRAL ----------------------
exports.referral = async (req, res) => {
  try {
    const newUserId = req.telegramData.user.id;
    const { referrerId } = req.body;

    const result = await withTransaction(async (session) => {
      const newUser = await User.findOne({ telegramId: newUserId }).session(session);
      if (!newUser) throw new Error('User not found');
      if (newUser.referrerId) throw new Error('Referral already used');
      if (newUserId === referrerId) throw new Error('Cannot refer yourself');

      const referrer = await User.findOne({ telegramId: referrerId }).session(session);
      if (!referrer) throw new Error('Referrer not found');

      newUser.referrerId = referrerId;
      newUser.coinBalance = Decimal.add(newUser.coinBalance, Decimal.fromNumber(CONFIG.REFERRAL.NEW_USER));

      referrer.coinBalance = Decimal.add(referrer.coinBalance, Decimal.fromNumber(CONFIG.REFERRAL.REFERRER.COINS));
      referrer.bonusSlots += CONFIG.REFERRAL.REFERRER.SLOTS;
      referrer.referralCount += 1;

      await RewardLog.create([
        {
          telegramId: newUserId,
          type: 'referral',
          rewardType: 'coin',
          amount: Decimal.fromNumber(CONFIG.REFERRAL.NEW_USER),
          timestamp: new Date()
        },
        {
          telegramId: referrerId,
          type: 'referral',
          rewardType: 'coin',
          amount: Decimal.fromNumber(CONFIG.REFERRAL.REFERRER.COINS),
          timestamp: new Date()
        },
        {
          telegramId: referrerId,
          type: 'referral',
          rewardType: 'bonus_slot',
          amount: CONFIG.REFERRAL.REFERRER.SLOTS,
          timestamp: new Date()
        }
      ], { session });

      await newUser.save({ session });
      await referrer.save({ session });
      await Cache.invalidate(newUserId);
      await Cache.invalidate(referrerId);
      await logAction(req, 'referral', { referrerId });

      return {
        newUser: {
          telegramId: newUserId,
          coinBalance: Decimal.toNumber(newUser.coinBalance)
        },
        referrer: {
          telegramId: referrerId,
          coinBalance: Decimal.toNumber(referrer.coinBalance),
          bonusSlots: referrer.bonusSlots
        }
      };
    });

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('referral error:', err);
    res.status(400).json({ success: false, error: err.message });
  }
};

// ---------------------- REWARD LOGS ----------------------
exports.getRewardLogs = async (req, res) => {
  try {
    const telegramId = req.telegramData.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = CONFIG.PAGINATION.REWARD_LOGS;
    const skip = (page - 1) * limit;

    const [logs, total] = await Promise.all([
      RewardLog.find({ telegramId }).sort({ timestamp: -1 }).skip(skip).limit(limit).lean(),
      RewardLog.countDocuments({ telegramId })
    ]);

    res.json({
      success: true,
      logs: logs.map(log => ({
        ...log,
        amount: Decimal.toNumber(log.amount)
      })),
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (err) {
    console.error('getRewardLogs error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch reward logs' });
  }
};
