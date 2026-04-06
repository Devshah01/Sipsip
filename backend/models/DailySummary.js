const mongoose = require('mongoose');

const DailySummarySchema = new mongoose.Schema({
  userId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true,
  },
  date: {
    type:     String,   // "YYYY-MM-DD"
    required: true,
  },
  totalMl: {
    type:    Number,
    default: 0,
  },
  sipCount: {
    type:    Number,
    default: 0,
  },
  goalMl: {
    type:    Number,
    default: 2000,  // snapshot of user's goal on this day
  },
  goalHit: {
    type:    Boolean,
    default: false,
  },
  bestSip: {
    type:    Number,
    default: 0,     // largest single sip that day
  },
}, { timestamps: true });

// Compound unique index: one summary per user per day
DailySummarySchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailySummary', DailySummarySchema);