const { verifyToken } = require('../utils/jwtHelper');
const User            = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  // Check Authorization header
  if (req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Not authorized — no token'
    });
  }

  try {
    const decoded = verifyToken(token);
    // Attach user to every protected request
    req.user = await User.findById(decoded.id).select('-password');

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    next();
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: 'Token invalid or expired'
    });
  }
};

module.exports = { protect };