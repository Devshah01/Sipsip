const express    = require('express');
const router     = express.Router();
const passport   = require('passport');
const { protect } = require('../middleware/auth');

const {
  register,
  login,
  logout,
  forgotPassword,
  resetPassword,
  googleCallback,
  getMe,
} = require('../controllers/authController');

// ── Public routes ──
router.post('/register',         register);
router.post('/login',            login);
router.post('/forgot-password',  forgotPassword);
router.post('/reset-password',   resetPassword);

// ── Protected routes ──
router.get('/me',      protect, getMe);
router.post('/logout', protect, logout);

// ── Google OAuth routes ──
router.get('/google',
  passport.authenticate('google', { scope: ['profile', 'email'] })
);

router.get('/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${(process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '')}/auth?error=google_failed`,
    session: false,
  }),
  googleCallback
);

module.exports = router;
