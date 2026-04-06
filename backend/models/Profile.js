const mongoose = require('mongoose');

const ProfileSchema = new mongoose.Schema({
  userId: {
    type:     mongoose.Schema.Types.ObjectId,
    ref:      'User',
    required: true,
    unique:   true,   // one profile per user
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other', null],
    default: null,
  },
  age: {
    type:    Number,
    min:     [1, 'Age must be at least 1'],
    max:     [120, 'Age cannot exceed 120'],
    default: null,
  },
  weight: {
    type:    Number,
    min:     [1, 'Weight must be positive'],
    max:     [500, 'Weight cannot exceed 500kg'],
    default: null,
  },
  wakeTime: {
    type:    String,
    default: '07:00',
  },
  sleepTime: {
    type:    String,
    default: '23:00',
  },
  dailyGoal: {
    type:    Number,
    default: 2000,    // ml — recalculated on every profile save
  },
}, { timestamps: true });

module.exports = mongoose.model('Profile', ProfileSchema);