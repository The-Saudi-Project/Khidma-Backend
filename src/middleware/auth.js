const User = require('../modules/users/users.model');
const { verifyAccessToken } = require('../utils/jwt');
const AppError = require('../utils/AppError');
const catchAsync = require('../utils/catchAsync');

/**
 * Protect routes - verifies JWT and attaches user to request
 */
const protect = catchAsync(async (req, res, next) => {
  // 1. Get token from Authorization header
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError('Authentication required. Please log in.', 401));
  }

  // 2. Verify token
  const decoded = verifyAccessToken(token);

  // 3. Check if user still exists
  const currentUser = await User.findById(decoded.id).select('+passwordChangedAt');
  if (!currentUser) {
    return next(new AppError('User no longer exists.', 401));
  }

  // 4. Check if user is active
  if (!currentUser.isActive) {
    return next(new AppError('Your account has been deactivated. Please contact support.', 403));
  }

  // 5. Check if password changed after token was issued
  if (currentUser.changedPasswordAfter && currentUser.changedPasswordAfter(decoded.iat)) {
    return next(new AppError('Password was recently changed. Please log in again.', 401));
  }

  // Attach user to request
  req.user = currentUser;
  next();
});

/**
 * Restrict access to specific roles
 * Usage: restrictTo('admin', 'provider')
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403));
    }
    next();
  };
};

/**
 * Optional authentication - attaches user if token present but doesn't block if absent
 */
const optionalAuth = catchAsync(async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (token) {
    try {
      const decoded = verifyAccessToken(token);
      const user = await User.findById(decoded.id);
      if (user && user.isActive) {
        req.user = user;
      }
    } catch {
      // Token invalid, continue as unauthenticated
    }
  }
  next();
});

module.exports = { protect, restrictTo, optionalAuth };
