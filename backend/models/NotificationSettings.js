const mongoose = require('mongoose');

const NotificationSettingsSchema = new mongoose.Schema({
  userId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true,
    unique:   true,
  },
  enabled: {
    type:    Boolean,
    default: false,
  },
  frequencyMinutes: {
    type:    Number,
    default: 60,
    min:     [15,  'Minimum frequency is 15 minutes'],
    max:     [480, 'Maximum frequency is 8 hours'],
  },
  wakeTime: {
    type:    String,
    default: '07:00',
  },
  sleepTime: {
    type:    String,
    default: '23:00',
  },
  // IANA zone from the browser (e.g. Asia/Kolkata) so wake/sleep match the user's clock
  timeZone: {
    type:    String,
    default: null,
  },
  // Web Push subscription object from PushManager.subscribe()
  pushSubscription: {
    type: {
      endpoint: String,
      keys: {
        p256dh: String,
        auth:   String,
      },
    },
    default: null,
  },
  // Track when we last sent a push so the scheduler knows if it's time
  lastPushedAt: {
    type:    Date,
    default: null,
  },
  // Per-type toggles (matches Notifications page rows)
  reminderPreferences: {
    sip:     { type: Boolean, default: true },
    goal:    { type: Boolean, default: true },
    morning: { type: Boolean, default: false },
    streak:  { type: Boolean, default: false },
    weekly:  { type: Boolean, default: true },
    bed:     { type: Boolean, default: false },
  },
}, { timestamps: true });

module.exports = mongoose.model('NotificationSettings', NotificationSettingsSchema);
