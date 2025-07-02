const mongoose = require('mongoose');

const referralRewardSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ['coin', 'gem'],
    required: true
  },
  value: {
    type: mongoose.Types.Decimal128,
    required: true
  },
  requiredActive: {
    type: Number,
    required: true
  }
});

module.exports = mongoose.model('ReferralReward', referralRewardSchema);
