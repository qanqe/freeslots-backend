const mongoose = require('mongoose');

const rewardLogSchema = new mongoose.Schema({
  telegramId: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    required: true,
    enum: [
      'spin_cost',
      'spin_reward',
      'checkin',
      'referral',
      'admin_adjustment',
      'free_slot'
    ]
  },
  rewardType: {
    type: String,
    required: true,
    enum: [
      'coin',
      'gem',
      'bonus_slot',
      'coin_and_slot',
      'none',
      'user_reset',
      'admin_promote',
      'user_delete'
    ]
  },
  amount: {
    type: mongoose.Schema.Types.Decimal128,
    required: true,
    get: (v) => parseFloat(v?.toString() || '0')
  },
  details: {
    type: String,
    trim: true,
    default: null
  },
  targetTelegramId: {
    type: String,
    default: null
  }
}, {
  timestamps: true,
  toJSON: { getters: true },
  toObject: { getters: true }
});

module.exports = mongoose.model('RewardLog', rewardLogSchema);
