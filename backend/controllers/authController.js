const crypto             = require('crypto');
const { sendPasswordResetEmail } = require('../utils/sendEmail');
const User               = require('../models/User');
const Profile            = require('../models/Profile');
const VesselSettings     = require('../models/VesselSettings');
const NotificationSettings = require('../models/NotificationSettings');
const { generateToken }  = require('../utils/jwtHelper');

// ─────────────────────────────────────
// @route   POST /api/auth/register
// @access  Public
// ─────────────────────────────────────
const register = async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Validate fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email and password'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Create user
    const user = await User.create({ name, email, password, authProvider: 'local' });

    // Auto-create empty profile for new user
    await Profile.create({ userId: user._id });

    // Auto-create default vessel settings
    await VesselSettings.create({ userId: user._id });

    // Auto-create default notification settings
    await NotificationSettings.create({ userId: user._id });

    // Generate JWT
    const token = generateToken(user._id);

    res.status(201).json({
      success: true,
      token,
      user: {
        _id:   user._id,
        name:  user.name,
        email: user.email,
        avatar: user.avatar,
      }
    });

  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────
// @route   POST /api/auth/login
// @access  Public
// ─────────────────────────────────────
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find user — include password for comparison
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if Google-only account
    if (user.authProvider === 'google') {
      return res.status(401).json({
        success: false,
        message: 'This account uses Google login. Please sign in with Google.'
      });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate JWT
    const token = generateToken(user._id);

    res.status(200).json({
      success: true,
      token,
      user: {
        _id:    user._id,
        name:   user.name,
        email:  user.email,
        avatar: user.avatar,
      }
    });

  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────
// @route   GET /api/auth/me
// @access  Private
// ─────────────────────────────────────
const getMe = async (req, res) => {
  const u = req.user;
  res.status(200).json({
    success: true,
    user: {
      _id:    u._id,
      name:   u.name,
      email:  u.email,
      avatar: u.avatar,
    },
  });
};

// ─────────────────────────────────────
// @route   POST /api/auth/logout
// @access  Private
// ─────────────────────────────────────
const logout = async (req, res) => {
  // JWT is stateless — client just deletes token
  // We just confirm it here
  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
};

// ─────────────────────────────────────
// @route   POST /api/auth/forgot-password
// @access  Public
// ─────────────────────────────────────
const forgotPassword = async (req, res, next) => {
  try {
    const raw = (req.body.email || '').trim().toLowerCase();
    if (!raw) {
      return res.status(400).json({
        success: false,
        message: 'Please provide your email'
      });
    }

    const user = await User.findOne({ email: raw });

    // Always return success — don't reveal if email exists
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If that email exists, a reset link has been sent'
      });
    }

    // Google-only accounts sign in with Google; no local password to reset
    if (user.authProvider === 'google' && !user.password) {
      return res.status(200).json({
        success: true,
        message: 'If that email exists, a reset link has been sent'
      });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    const resetPasswordExpire = new Date(Date.now() + 60 * 60 * 1000);

    user.resetPasswordToken = resetPasswordToken;
    user.resetPasswordExpire = resetPasswordExpire;
    await user.save();

    const clientUrl = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
    // Routing works on both localhost & static hosts using standard paths via vercel.json rewrites or Vite 
    const resetUrl = `${clientUrl}/reset-password/${resetToken}`;

    try {
      const { sent } = await sendPasswordResetEmail({
        to: raw,
        resetUrl,
        name: user.name,
      });
      if (!sent) {
        console.log(`[SipSip] SMTP not configured — password reset link for ${raw}: ${resetUrl}`);
      }
    } catch (err) {
      user.resetPasswordToken = null;
      user.resetPasswordExpire = null;
      await user.save();
      err.statusCode = 503;
      err.message = 'Unable to send reset email. Please try again later.';
      return next(err);
    }

    res.status(200).json({
      success: true,
      message: 'If that email exists, a reset link has been sent'
    });

  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────
// @route   POST /api/auth/reset-password
// @access  Public
// ─────────────────────────────────────
const resetPassword = async (req, res, next) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'Token and password are required'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters'
      });
    }

    const hashedToken = crypto.createHash('sha256').update(String(token)).digest('hex');
    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset link. Please request a new one.'
      });
    }

    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpire = null;
    if (user.authProvider === 'google') {
      user.authProvider = 'both';
    }
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Password updated. You can sign in now.',
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────
// @route   GET /api/auth/google/callback
// @access  Public (called by Google)
// ─────────────────────────────────────
const googleCallback = async (req, res) => {
  try {
    const user  = req.user;
    const token = generateToken(user._id);

    // Check if profile + settings exist, create if not
    const existingProfile = await Profile.findOne({ userId: user._id });
    if (!existingProfile) {
      await Profile.create({ userId: user._id });
    }

    const existingVessels = await VesselSettings.findOne({ userId: user._id });
    if (!existingVessels) {
      await VesselSettings.create({ userId: user._id });
    }

    const existingNotifs = await NotificationSettings.findOne({ userId: user._id });
    if (!existingNotifs) {
      await NotificationSettings.create({ userId: user._id });
    }

    const base = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
    res.redirect(`${base}/auth/callback?token=${encodeURIComponent(token)}`);

  } catch (err) {
    const base = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
    res.redirect(`${base}/auth?error=google_failed`);
  }
};

module.exports = {
  register,
  login,
  logout,
  forgotPassword,
  resetPassword,
  googleCallback,
  getMe,
};