const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const UserSchema = new mongoose.Schema({
  name: {
    type:     String,
    required: [true, 'Name is required'],
    trim:     true,
    maxlength: [50, 'Name cannot exceed 50 characters'],
  },
  email: {
    type:      String,
    required:  [true, 'Email is required'],
    unique:    true,
    lowercase: true,
    trim:      true,
    match:     [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
  },
  password: {
    type:      String,
    minlength: [6, 'Password must be at least 6 characters'],
    default:   null,
  },
  googleId: {
    type:    String,
    default: null,
  },
  avatar: {
    type:    String,
    default: '',
  },
  authProvider: {
    type:    String,
    enum:    ['local', 'google', 'both'],
    default: 'local',
  },
  resetPasswordToken: {
    type:    String,
    default: null,
  },
  resetPasswordExpire: {
    type:    Date,
    default: null,
  },
}, { timestamps: true });

// Hash password before saving
UserSchema.pre('save', async function () {
  // Only hash if password was modified and is not null
  if (!this.isModified('password') || !this.password) return;
  const salt    = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Method to compare entered password with hashed
UserSchema.methods.matchPassword = async function (enteredPassword) {
  if (!this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', UserSchema);