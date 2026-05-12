const User = require('./users.model');
const Booking = require('../bookings/bookings.model');
const { sendSuccess, sendError, getPaginationMeta } = require('../../utils/apiResponse');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/AppError');
const AuditService = require('../audit/audit.service');
const { revokeAllUserTokens } = require('../../utils/jwt');
const { scoreProviders } = require('../../utils/dispatchScorer');

/**
 * @desc   Get current user profile
 * @route  GET /api/users/profile
 * @access Private
 */
const getProfile = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id);
  return sendSuccess(res, 200, 'Profile retrieved.', { user });
});

/**
 * @desc   Update current user profile
 * @route  PUT /api/users/profile
 * @access Private
 */
const updateProfile = catchAsync(async (req, res, next) => {
  const { name, phone, bio } = req.body;

  // Prevent role/password changes through this route
  const allowedUpdates = { name, phone, bio };
  Object.keys(allowedUpdates).forEach(k => allowedUpdates[k] === undefined && delete allowedUpdates[k]);

  const user = await User.findByIdAndUpdate(req.user._id, allowedUpdates, {
    new: true,
    runValidators: true
  });

  return sendSuccess(res, 200, 'Profile updated.', { user });
});

/**
 * @desc   Delete own account (soft delete)
 * @route  DELETE /api/users/account
 * @access Private (customer only)
 */
const deleteAccount = catchAsync(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, {
    isActive: false,
    deletedAt: new Date(),
    email: `deleted_${Date.now()}_${req.user.email}` // free up email
  });

  await AuditService.log({
    userId: req.user._id,
    userRole: req.user.role,
    action: 'user.account_deleted',
    targetModel: 'User',
    targetId: req.user._id,
    description: `Account self-deleted by: ${req.user.email}`,
    req
  });

  return sendSuccess(res, 200, 'Account deleted successfully.');
});

// ─── Address Management ───────────────────────────────────────────────────────

/**
 * @desc   Add address
 * @route  POST /api/users/addresses
 * @access Private (customer)
 */
const addAddress = catchAsync(async (req, res, next) => {
  const { label, fullAddress, city, district, landmark, coordinates, isDefault } = req.body;

  const user = await User.findById(req.user._id);

  // Max 5 addresses
  if (user.addresses.length >= 5) {
    return next(new AppError('You can save a maximum of 5 addresses.', 400));
  }

  // If setting as default, clear others
  if (isDefault) {
    user.addresses.forEach(a => (a.isDefault = false));
  }

  user.addresses.push({ label, fullAddress, city, district, landmark, coordinates, isDefault: !!isDefault });
  await user.save();

  return sendSuccess(res, 201, 'Address added.', { addresses: user.addresses });
});

/**
 * @desc   Update address
 * @route  PUT /api/users/addresses/:addressId
 * @access Private (customer)
 */
const updateAddress = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  const address = user.addresses.id(req.params.addressId);

  if (!address) return next(new AppError('Address not found.', 404));

  const { label, fullAddress, city, district, landmark, isDefault } = req.body;

  if (isDefault) user.addresses.forEach(a => (a.isDefault = false));

  if (label !== undefined) address.label = label;
  if (fullAddress !== undefined) address.fullAddress = fullAddress;
  if (city !== undefined) address.city = city;
  if (district !== undefined) address.district = district;
  if (landmark !== undefined) address.landmark = landmark;
  if (isDefault !== undefined) address.isDefault = isDefault;

  await user.save();
  return sendSuccess(res, 200, 'Address updated.', { addresses: user.addresses });
});

/**
 * @desc   Delete address
 * @route  DELETE /api/users/addresses/:addressId
 * @access Private (customer)
 */
const deleteAddress = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id);
  const address = user.addresses.id(req.params.addressId);
  if (!address) return next(new AppError('Address not found.', 404));

  address.deleteOne();
  await user.save();
  return sendSuccess(res, 200, 'Address deleted.', { addresses: user.addresses });
});

// ─── Admin User Management ────────────────────────────────────────────────────

/**
 * @desc   Get all users (admin)
 * @route  GET /api/users
 * @access Admin
 */
const getAllUsers = catchAsync(async (req, res) => {
  const { role, isActive, page = 1, limit = 20, search } = req.query;

  const filter = {};
  if (role) filter.role = role;
  if (isActive !== undefined) filter.isActive = isActive === 'true';
  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
    User.countDocuments(filter)
  ]);

  return sendSuccess(res, 200, 'Users retrieved.', { users }, getPaginationMeta(total, page, limit));
});

/**
 * @desc   Get single user (admin)
 * @route  GET /api/users/:id
 * @access Admin
 */
const getUserById = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  if (!user) return next(new AppError('User not found.', 404));
  return sendSuccess(res, 200, 'User retrieved.', { user });
});

/**
 * @desc   Create provider account (admin)
 * @route  POST /api/users/providers
 * @access Admin
 */
const createProvider = catchAsync(async (req, res, next) => {
  const { name, email, password, phone, bio, skills } = req.body;

  const existing = await User.findOne({ email: email.toLowerCase() });
  if (existing) return next(new AppError('Email already in use.', 409));

  const provider = await User.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    password,
    phone,
    bio,
    role: 'provider',
    providerProfile: {
      skills: skills || [],
      isAvailable: true
    }
  });

  await AuditService.log({
    userId: req.user._id,
    userRole: 'admin',
    action: 'user.provider_created',
    targetModel: 'User',
    targetId: provider._id,
    description: `Provider account created: ${provider.email} by admin ${req.user.email}`,
    req
  });

  return sendSuccess(res, 201, 'Provider account created.', { provider });
});

/**
 * @desc   Activate / deactivate user (admin)
 * @route  PATCH /api/users/:id/toggle-status
 * @access Admin
 */
const toggleUserStatus = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.params.id);
  if (!user) return next(new AppError('User not found.', 404));

  if (user.role === 'admin') return next(new AppError('Cannot modify admin accounts.', 403));

  user.isActive = !user.isActive;
  await user.save({ validateBeforeSave: false });

  if (!user.isActive) {
    await revokeAllUserTokens(user._id);
  }

  await AuditService.log({
    userId: req.user._id,
    userRole: 'admin',
    action: user.isActive ? 'user.activated' : 'user.deactivated',
    targetModel: 'User',
    targetId: user._id,
    description: `User ${user.email} ${user.isActive ? 'activated' : 'deactivated'} by ${req.user.email}`,
    req
  });

  return sendSuccess(res, 200, `User ${user.isActive ? 'activated' : 'deactivated'} successfully.`, {
    user: { id: user._id, isActive: user.isActive }
  });
});

/**
 * @desc   Get all providers (for assignment, admin)
 * @route  GET /api/users/providers
 * @access Admin
 */
const getProviders = catchAsync(async (req, res) => {
  const { isAvailable, isActive = true, serviceCategory, city } = req.query;

  const filter = { role: 'provider', isActive: isActive !== 'false' };
  if (isAvailable !== undefined) {
    filter['providerProfile.isAvailable'] = isAvailable === 'true';
  }

  const providers = await User.find(filter)
    .select(
      'name email phone providerProfile.isAvailable providerProfile.averageRating providerProfile.completedJobs providerProfile.skills providerProfile.serviceCity providerProfile.lastJobAt isActive'
    )
    .sort({ 'providerProfile.averageRating': -1 });

  if (serviceCategory) {
    const scored = scoreProviders(providers, { serviceCategory, city });
    const out = scored.map(({ user, score }) => {
      const o = user.toObject ? user.toObject() : user;
      o.score = score === Number.NEGATIVE_INFINITY ? null : Math.round(score * 100) / 100;
      return o;
    });
    return sendSuccess(res, 200, 'Providers retrieved.', { providers: out });
  }

  return sendSuccess(res, 200, 'Providers retrieved.', { providers });
});

/**
 * @desc   Provider performance stats (admin)
 * @route  GET /api/users/providers/:id/stats
 * @access Admin
 */
const getProviderStats = catchAsync(async (req, res, next) => {
  const providerId = req.params.id;
  const provider = await User.findOne({ _id: providerId, role: 'provider' });
  if (!provider) return next(new AppError('Provider not found.', 404));

  const [totalAssigned, completed, cancelled, earningAgg, byCategory, recentJobs] = await Promise.all([
    Booking.countDocuments({ provider: providerId }),
    Booking.countDocuments({ provider: providerId, status: 'completed' }),
    Booking.countDocuments({ provider: providerId, status: 'cancelled' }),
    Booking.aggregate([
      { $match: { provider: provider._id, status: 'completed' } },
      { $group: { _id: null, sum: { $sum: '$providerEarning' } } }
    ]),
    Booking.aggregate([
      { $match: { provider: provider._id } },
      { $group: { _id: '$serviceCategory', count: { $sum: 1 } } }
    ]),
    Booking.find({ provider: providerId })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('bookingNumber serviceName serviceCategory status totalAmount providerEarning scheduledDate createdAt')
  ]);

  const sumEarn = earningAgg[0]?.sum || 0;
  const completionRate = completed / Math.max(totalAssigned, 1);
  const avgEarningPerJob = completed ? Math.round((sumEarn / completed) * 100) / 100 : 0;

  return sendSuccess(res, 200, 'Provider stats retrieved.', {
    provider,
    stats: {
      totalAssigned,
      completed,
      cancelled,
      completionRate: Math.round(completionRate * 10000) / 10000,
      avgEarningPerJob,
      jobsByCategory: byCategory,
      recentJobs
    }
  });
});

/**
 * @desc   Update provider availability
 * @route  PATCH /api/users/providers/availability
 * @access Provider
 */
const updateAvailability = catchAsync(async (req, res) => {
  const { isAvailable } = req.body;
  await User.findByIdAndUpdate(req.user._id, {
    'providerProfile.isAvailable': isAvailable
  });
  return sendSuccess(res, 200, `You are now ${isAvailable ? 'available' : 'unavailable'}.`);
});

module.exports = {
  getProfile,
  updateProfile,
  deleteAccount,
  addAddress,
  updateAddress,
  deleteAddress,
  getAllUsers,
  getUserById,
  createProvider,
  toggleUserStatus,
  getProviders,
  getProviderStats,
  updateAvailability
};
