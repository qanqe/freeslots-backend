const mongoose = require('mongoose');
const User = require('../models/User');
const RewardLog = require('../models/RewardLog');
const AuditLog = require('../models/AuditLog');
const ReferralReward = require('../models/ReferralReward');
const redis = require('../config/redis');

// Decimal Helpers
const Decimal = {
  add: (a, b) =>
    mongoose.Types.Decimal128.fromString(
      (parseFloat(a.toString()) + parseFloat(b.toString())).toString()
    ),
  sub: (a, b) =>
    mongoose.Types.Decimal128.fromString(
      (parseFloat(a.toString()) - parseFloat(b.toString())).toString()
    ),
  fromNumber: (n) => mongoose.Types.Decimal128.fromString(n.toString()),
  toNumber: (d) => parseFloat(d?.toString() || '0'),
  gte: (a, b) => parseFloat(a.toString()) >= parseFloat(b.toString()),
};

// Configs
const CONFIG = {
  FREE_SLOT: {
    SMALL_REWARDS: [1, 2, 3],
    BIG_REWARD_CHANCE: 0.05,
    BIG_REWARDS: [10, 15, 20],
  },
  PAID_SPIN: {
    COST: 10,
    GEM_CHANCE: 0.2,
    COIN_REWARDS: [50, 102, 203],
  },
  CHECKIN: {
    BASE_REWARD: 1,
    STREAK_MULTIPLIERS: { 3: 2, 5: 3, 7: 5 },
  },
  REFERRAL: {
    NEW_USER_COINS: 10,
    REFERRER_COINS: 5,
  },
};

// Redis Cache
const Cache = {
  getUser: async (id) => {
    try {
      const val = await redis.get(`user:${id}`);
      return val ? JSON.parse(val) : null;
    } catch {
      return null;
    }
  },
  setUser: async (id, user) => {
    try {
      await redis.setEx(`user:${id}`, 300, JSON.stringify(user));
    } catch {}
  },
  invalidate: async (id) => {
    try {
      await redis.del(`user:${id}`);
    } catch {}
  },
};

// Transactions
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
      timestamp: new Date(),
    });
  } catch {}
};

// Date Helpers
const DateUtils = {
  isSameDay: (a, b) => a.toDateString() === b.toDateString(),
  isYesterday: (a, now = new Date()) => {
    const y = new Date(now);
    y.setDate(now.getDate() - 1);
    return a.toDateString() === y.toDateString();
  },
};

// -------- AUTH USER --------
exports.authUser = async (req, res) => {
  try {
    const { username, referrerId } = req.body;
    const telegramId = req.telegramData?.user?.id;

    if (!telegramId) {
      return res.status(400).json({ success: false, error: 'Missing Telegram ID' });
    }

    const result = await withTransaction(async (session) => {
      let user = await User.findOne({ telegramId }).session(session);
      const isNew = !user;

      if (isNew) {
        user = new User({
          telegramId,
          username,
          coinBalance: Decimal.fromNumber(CONFIG.REFERRAL.NEW_USER_COINS),
          gems: Decimal.fromNumber(0),
        });

        if (referrerId && referrerId !== telegramId) {
          const referrer = await User.findOne({ telegramId: referrerId }).session(session);
          if (referrer) {
            referrer.coinBalance = Decimal.add(
              referrer.coinBalance,
              Decimal.fromNumber(CONFIG.REFERRAL.REFERRER_COINS)
            );
            referrer.referralCount += 1;
            await referrer.save({ session });

            user.referrerId = referrer.telegramId;

            await RewardLog.insertMany(
              [
                {
                  telegramId,
                  type: 'referral',
                  rewardType: 'coin',
                  amount: Decimal.fromNumber(CONFIG.REFERRAL.NEW_USER_COINS),
                },
                {
                  telegramId: referrer.telegramId,
                  type: 'referral',
                  rewardType: 'coin',
                  amount: Decimal.fromNumber(CONFIG.REFERRAL.REFERRER_COINS),
                },
              ],
              { session }
            );
          }
        }
      } else {
        if (user.username !== username) {
          user.username = username;
        }
      }

      await user.save({ session });
      await Cache.setUser(telegramId, user);
      await logAction(req, isNew ? 'register' : 'login', {});

      return {
        user: {
          telegramId: user.telegramId,
          username: user.username,
          coinBalance: Decimal.toNumber(user.coinBalance),
          gems: Decimal.toNumber(user.gems),
          referrerId: user.referrerId,
          referralCount: user.referralCount,
        },
      };
    });

    res.json({ success: true, ...result });
  } catch (e) {
    console.error('[authUser] Error:', e);
    res.status(500).json({ success: false, error: 'Auth failed' });
  }
};

// -------- FREE SLOT --------
exports.freeSlot = async (req, res) => {
  try {
    const telegramId = req.telegramData.user.id;

    const result = await withTransaction(async (session) => {
      const user = await User.findOne({ telegramId }).session(session);
      if (!user) throw new Error('User not found');

      const roll = Math.random();
      const reward =
        roll < CONFIG.FREE_SLOT.BIG_REWARD_CHANCE
          ? CONFIG.FREE_SLOT.BIG_REWARDS[Math.floor(Math.random() * CONFIG.FREE_SLOT.BIG_REWARDS.length)]
          : CONFIG.FREE_SLOT.SMALL_REWARDS[Math.floor(Math.random() * CONFIG.FREE_SLOT.SMALL_REWARDS.length)];

      user.coinBalance = Decimal.add(user.coinBalance, Decimal.fromNumber(reward));
      await user.save({ session });

      await RewardLog.create(
        [
          {
            telegramId,
            type: 'free_slot',
            rewardType: 'coin',
            amount: Decimal.fromNumber(reward),
          },
        ],
        { session }
      );

      await Cache.setUser(telegramId, user);
      await logAction(req, 'free_slot', { reward });

      return {
        reward,
        balance: {
          coins: Decimal.toNumber(user.coinBalance),
          gems: Decimal.toNumber(user.gems),
        },
      };
    });

    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
};

// -------- PAID SPIN --------
exports.spin = async (req, res) => {
  try {
    const telegramId = req.telegramData.user.id;

    const result = await withTransaction(async (session) => {
      const user = await User.findOne({ telegramId }).session(session);
      if (!user) throw new Error('User not found');

      if (!Decimal.gte(user.coinBalance, CONFIG.PAID_SPIN.COST)) {
        throw new Error('Not enough coins');
      }

      // Deduct cost first
      user.coinBalance = Decimal.sub(user.coinBalance, Decimal.fromNumber(CONFIG.PAID_SPIN.COST));

      const roll = Math.random();

      let rewardType = 'none';
      let rewardAmount = 0;

      if (roll < 0.4) {
        // 40% Try again: no reward
        rewardType = 'none';
        rewardAmount = 0;
      } else if (roll < 0.7) {
        // 30% fixed 50 coins reward
        rewardType = 'coin';
        rewardAmount = 50;
        user.coinBalance = Decimal.add(user.coinBalance, Decimal.fromNumber(rewardAmount));
      } else {
        // Last 30% split equally into gem or other coin rewards
        const subRoll = (roll - 0.7) / 0.3; // map 0.7-1 to 0-1
        if (subRoll < 0.5) {
          // 15% gem reward
          rewardType = 'gem';
          rewardAmount = 1;
          user.gems = Decimal.add(user.gems, Decimal.fromNumber(1));
        } else {
          // 15% other coin rewards
          rewardType = 'coin';
          rewardAmount =
            CONFIG.PAID_SPIN.COIN_REWARDS[
              Math.floor(Math.random() * CONFIG.PAID_SPIN.COIN_REWARDS.length)
            ];
          user.coinBalance = Decimal.add(user.coinBalance, Decimal.fromNumber(rewardAmount));
        }
      }

      await user.save({ session });

      // Log spin cost and reward only if any
      await RewardLog.insertMany(
        [
          {
            telegramId,
            type: 'spin_cost',
            rewardType: 'coin',
            amount: Decimal.fromNumber(-CONFIG.PAID_SPIN.COST),
          },
          ...(rewardType !== 'none'
            ? [
                {
                  telegramId,
                  type: 'spin_reward',
                  rewardType,
                  amount: Decimal.fromNumber(rewardAmount),
                },
              ]
            : []),
        ],
        { session }
      );

      await Cache.setUser(telegramId, user);
      await logAction(req, 'paid_spin', { rewardType, rewardAmount });

      return {
        reward: rewardType === 'none' ? null : { type: rewardType, amount: rewardAmount },
        balance: {
          coins: Decimal.toNumber(user.coinBalance),
          gems: Decimal.toNumber(user.gems),
        },
      };
    });

    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
};


// -------- CHECK-IN --------
exports.checkIn = async (req, res) => {
  try {
    const telegramId = req.telegramData.user.id;

    const result = await withTransaction(async (session) => {
      const user = await User.findOne({ telegramId }).session(session);
      if (!user) throw new Error('User not found');

      const now = new Date();
      const last = user.lastCheckIn ? new Date(user.lastCheckIn) : null;
      if (last && DateUtils.isSameDay(now, last)) throw new Error('Already checked in');

      let streak = 1;
      if (last && DateUtils.isYesterday(last, now)) {
        streak = user.streakCount + 1;
      }

      user.lastCheckIn = now;
      user.streakCount = streak;

      const multiplier = CONFIG.CHECKIN.STREAK_MULTIPLIERS[streak] || 1;
      const reward = CONFIG.CHECKIN.BASE_REWARD * multiplier;

      user.coinBalance = Decimal.add(user.coinBalance, Decimal.fromNumber(reward));
      await user.save({ session });

      await RewardLog.create(
        [
          {
            telegramId,
            type: 'checkin',
            rewardType: 'coin',
            amount: Decimal.fromNumber(reward),
          },
        ],
        { session }
      );

      await Cache.setUser(telegramId, user);
      await logAction(req, 'checkin', { streak, reward });

      return {
        reward,
        streak,
        balance: {
          coins: Decimal.toNumber(user.coinBalance),
          gems: Decimal.toNumber(user.gems),
        },
      };
    });

    res.json({ success: true, ...result });
  } catch (e) {
    res.status(400).json({ success: false, error: e.message });
  }
};

// -------- REWARD LOGS --------
exports.getRewardLogs = async (req, res) => {
  try {
    const telegramId = req.telegramData.user.id;
    const logs = await RewardLog.find({ telegramId }).sort({ timestamp: -1 }).limit(50).lean();

    res.json({
      success: true,
      logs: logs.map((log) => ({
        ...log,
        amount: Decimal.toNumber(log.amount),
      })),
    });
  } catch (e) {
    res.status(500).json({ success: false, error: 'Failed to fetch logs' });
  }
};

// -------- REFERRAL INFO --------
exports.referralInfo = async (req, res) => {
  try {
    const telegramId = req.telegramData.user.id;
    const user = await User.findOne({ telegramId });
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    const rewards = await ReferralReward.find().sort({ requiredActive: 1 }).lean();
    const claimed = new Set((user.claimedReferralRewards || []).map((r) => r.toString()));

    const rewardsWithClaimed = rewards.map((r) => ({
      id: r._id,
      type: r.type,
      value: parseFloat(r.value.toString()),
      requiredActive: r.requiredActive,
      claimed: claimed.has(r._id.toString()),
    }));

    res.json({
      success: true,
      invitedCount: user.referralCount || 0,
      rewards: rewardsWithClaimed,
    });
  } catch (e) {
    console.error('[referralInfo] Error:', e);
    res.status(500).json({ success: false, error: 'Server error' });
  }
};
