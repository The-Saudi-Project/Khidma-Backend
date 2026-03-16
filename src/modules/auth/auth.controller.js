const User = require('../users/users.model');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken, buildTokenPayload } = require('../../utils/jwt');
const { sendSuccess, sendError } = require('../../utils/apiResponse');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/AppError');
const AuditService = require('../audit/audit.service');

/**
 * @desc   Register new customer
 * @route  POST /api/auth/signup
 * @access Public
 */
const signup = catchAsync(async (req, res, next) => {
  const { name, email, password, phone } = req.body;

  // Check existing user
  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) {
    return next(new AppError('An account with this email already exists.', 409));
  }

  const user = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password,
    phone,
    role: 'customer'
  });

  await AuditService.log({
    userId: user._id,
    userRole: 'customer',
    action: 'auth.signup',
    targetModel: 'User',
    targetId: user._id,
    description: `New customer registered: ${user.email}`,
    req
  });

  const payload = buildTokenPayload(user);
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return sendSuccess(res, 201, 'Account created successfully.', {
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone
    }
  });
});

/**
 * @desc   Login
 * @route  POST /api/auth/login
 * @access Public
 */
const login = catchAsync(async (req, res, next) => {
  const { email, password } = req.body;

  // Include password field explicitly (select: false by default)
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

  if (!user || !(await user.comparePassword(password))) {
    return next(new AppError('Invalid email or password.', 401));
  }

  if (!user.isActive) {
    return next(new AppError('Your account has been deactivated. Please contact support.', 403));
  }

  // Update last login
  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  await AuditService.log({
    userId: user._id,
    userRole: user.role,
    action: 'auth.login',
    targetModel: 'User',
    targetId: user._id,
    description: `User logged in: ${user.email}`,
    req
  });

  const payload = buildTokenPayload(user);
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return sendSuccess(res, 200, 'Login successful.', {
    accessToken,
    refreshToken,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      phone: user.phone,
      avatar: user.avatar,
      providerProfile: user.role === 'provider' ? user.providerProfile : undefined
    }
  });
});

/**
 * @desc   Refresh access token
 * @route  POST /api/auth/refresh
 * @access Public
 */
const refresh = catchAsync(async (req, res, next) => {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return next(new AppError('Refresh token is required.', 400));
  }

  const decoded = verifyRefreshToken(refreshToken);
  const user = await User.findById(decoded.id);

  if (!user || !user.isActive) {
    return next(new AppError('User not found or inactive.', 401));
  }

  const payload = buildTokenPayload(user);
  const newAccessToken = generateAccessToken(payload);
  const newRefreshToken = generateRefreshToken(payload);

  return sendSuccess(res, 200, 'Token refreshed.', {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken
  });
});

/**
 * @desc   Get current user
 * @route  GET /api/auth/me
 * @access Private
 */
const getMe = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id);
  return sendSuccess(res, 200, 'Current user retrieved.', { user });
});

/**
 * @desc   Request password reset
 * @route  POST /api/auth/forgot-password
 * @access Public
 */
const forgotPassword = catchAsync(async (req, res, next) => {
  const { email } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() });

  // Always return success to prevent email enumeration
  if (!user) {
    return sendSuccess(res, 200, 'If an account with that email exists, a reset link has been sent.');
  }

  const resetToken = user.createPasswordResetToken();
  await user.save({ validateBeforeSave: false });

  // In production: send email with reset link
  // For now: return token in response (development only)
  const isDev = process.env.NODE_ENV === 'development';

  return sendSuccess(res, 200, 'If an account with that email exists, a reset link has been sent.', {
    ...(isDev && { resetToken }) // Only expose in dev
  });
});

/**
 * @desc   Reset password with token
 * @route  POST /api/auth/reset-password
 * @access Public
 */
const resetPassword = catchAsync(async (req, res, next) => {
  const { token, password } = req.body;

  const user = await User.findOne({
    passwordResetToken: token,
    passwordResetExpires: { $gt: Date.now() }
  });

  if (!user) {
    return next(new AppError('Invalid or expired reset token.', 400));
  }

  user.password = password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  await AuditService.log({
    userId: user._id,
    userRole: user.role,
    action: 'auth.password_reset',
    targetModel: 'User',
    targetId: user._id,
    description: `Password reset for: ${user.email}`,
    req
  });

  return sendSuccess(res, 200, 'Password reset successful. Please log in.');
});

/**
 * @desc   Change password (authenticated)
 * @route  PUT /api/auth/change-password
 * @access Private
 */
const changePassword = catchAsync(async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user._id).select('+password');

  if (!(await user.comparePassword(currentPassword))) {
    return next(new AppError('Current password is incorrect.', 401));
  }

  user.password = newPassword;
  await user.save();

  await AuditService.log({
    userId: user._id,
    userRole: user.role,
    action: 'auth.password_changed',
    targetModel: 'User',
    targetId: user._id,
    description: `Password changed for: ${user.email}`,
    req
  });

  const payload = buildTokenPayload(user);
  const accessToken = generateAccessToken(payload);
  const refreshToken = generateRefreshToken(payload);

  return sendSuccess(res, 200, 'Password changed successfully.', { accessToken, refreshToken });
});

module.exports = { signup, login, refresh, getMe, forgotPassword, resetPassword, changePassword };
