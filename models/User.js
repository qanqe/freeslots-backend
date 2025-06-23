const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  telegramId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  username: {
    type: String,
    required: true,
    trim: true
  },
  coinBalance: {
    type: mongoose.Schema.Types.Decimal128,
    default: '0.00',
    get: (v) => parseFloat(v?.toString() || '0')
  },
  gems: {
    type: mongoose.Schema.Types.Decimal128,
    default: '0.00',
    get: (v) => parseFloat(v?.toString() || '0')
  },
  bonusSlots: {
    type: Number,
    default: 0
  },
  lastCheckIn: {
    type: Date,
    default: null
  },
  streakCount: {
    type: Number,
    default: 0
  },
  referrerId: {
    type: String,
    default: null,
    index: true
  },
  referralCount: {
    type: Number,
    default: 0
  },
  isAdmin: {
    type: Boolean,
    default: false,
    select: false // Hidden by default for safety
  }
}, {
  timestamps: true,
  toJSON: { getters: true },
  toObject: { getters: true }
});

module.exports = mongoose.model('User', userSchema);
