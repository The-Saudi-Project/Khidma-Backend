const jwt = require('jsonwebtoken');
const AppError = require('./AppError');

/**
 * Generate access token
 */
const generateAccessToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '7d',
    issuer: 'khidma-platform',
    audience: 'khidma-users'
  });
};

/**
 * Generate refresh token
 */
const generateRefreshToken = (payload) => {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d',
    issuer: 'khidma-platform',
    audience: 'khidma-users'
  });
};

/**
 * Verify access token
 */
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'khidma-platform',
      audience: 'khidma-users'
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Token has expired. Please log in again.', 401);
    }
    if (error.name === 'JsonWebTokenError') {
      throw new AppError('Invalid token. Please log in again.', 401);
    }
    throw new AppError('Token verification failed.', 401);
  }
};

/**
 * Verify refresh token
 */
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
      issuer: 'khidma-platform',
      audience: 'khidma-users'
    });
  } catch (error) {
    throw new AppError('Invalid or expired refresh token.', 401);
  }
};

/**
 * Build token payload from user object
 */
const buildTokenPayload = (user) => ({
  id: user._id.toString(),
  role: user.role,
  email: user.email
});

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  buildTokenPayload
};
