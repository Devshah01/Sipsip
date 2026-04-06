const mongoose = require('mongoose');

/** One document per user per calendar day — prevents concurrent guest-import races (duplicate sips). */
const guestSyncLockSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: String, required: true },
  },
  { timestamps: true }
);

guestSyncLockSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('GuestSyncLock', guestSyncLockSchema);
