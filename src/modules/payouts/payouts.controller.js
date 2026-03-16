const Payout = require('./payouts.model');
const Booking = require('../bookings/bookings.model');
const User = require('../users/users.model');
const NotificationService = require('../notifications/notifications.service');
const AuditService = require('../audit/audit.service');
const { sendSuccess, getPaginationMeta } = require('../../utils/apiResponse');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/AppError');

/**
 * @desc   Get provider's earning summary
 * @route  GET /api/payouts/provider/earnings
 * @access Provider
 */
const getProviderEarnings = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).select('providerProfile name email');

  // Get completed unpaid bookings
  const pendingBookings = await Booking.find({
    provider: req.user._id,
    status: 'completed',
    isProviderPaid: false
  }).select('bookingNumber serviceName totalAmount providerEarning scheduledDate createdAt');

  return sendSuccess(res, 200, 'Earnings retrieved.', {
    summary: {
      totalEarned: user.providerProfile.totalEarned,
      pendingEarnings: user.providerProfile.pendingEarnings,
      totalPaidOut: user.providerProfile.totalPaidOut
    },
    pendingBookings
  });
});

/**
 * @desc   Get provider's payout history
 * @route  GET /api/payouts/provider/history
 * @access Provider
 */
const getProviderPayoutHistory = catchAsync(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [payouts, total] = await Promise.all([
    Payout.find({ provider: req.user._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('bookings', 'bookingNumber serviceName'),
    Payout.countDocuments({ provider: req.user._id })
  ]);

  return sendSuccess(res, 200, 'Payout history retrieved.', { payouts }, getPaginationMeta(total, page, limit));
});

/**
 * @desc   Get all provider balances (admin)
 * @route  GET /api/payouts/admin/balances
 * @access Admin
 */
const getProviderBalances = catchAsync(async (req, res) => {
  const providers = await User.find({ role: 'provider', isActive: true })
    .select('name email phone providerProfile.pendingEarnings providerProfile.totalEarned providerProfile.totalPaidOut');

  return sendSuccess(res, 200, 'Provider balances retrieved.', { providers });
});

/**
 * @desc   Process payout (admin marks as paid)
 * @route  POST /api/payouts
 * @access Admin
 */
const processPayout = catchAsync(async (req, res, next) => {
  const { providerId, bookingIds, paymentDetails, method, transactionReference, notes } = req.body;

  const provider = await User.findOne({ _id: providerId, role: 'provider' });
  if (!provider) return next(new AppError('Provider not found.', 404));

  // Verify all bookings belong to provider, are completed and unpaid
  const bookings = await Booking.find({
    _id: { $in: bookingIds },
    provider: providerId,
    status: 'completed',
    isProviderPaid: false
  });

  if (bookings.length === 0) {
    return next(new AppError('No eligible bookings found for payout.', 400));
  }

  const totalAmount = bookings.reduce((sum, b) => sum + b.providerEarning, 0);

  // Create payout record
  const payout = await Payout.create({
    provider: providerId,
    processedBy: req.user._id,
    bookings: bookings.map(b => b._id),
    amount: Math.round(totalAmount * 100) / 100,
    method: method || 'bank_transfer',
    paymentDetails,
    transactionReference,
    notes,
    status: 'completed',
    paidAt: new Date()
  });

  // Mark bookings as paid
  await Booking.updateMany(
    { _id: { $in: bookings.map(b => b._id) } },
    { isProviderPaid: true, providerPaidAt: new Date(), payoutId: payout._id }
  );

  // Update provider earnings
  await User.findByIdAndUpdate(providerId, {
    $inc: {
      'providerProfile.totalEarned': totalAmount,
      'providerProfile.totalPaidOut': totalAmount,
      'providerProfile.pendingEarnings': -totalAmount
    }
  });

  await NotificationService.payoutProcessed(payout, providerId);

  await AuditService.log({
    userId: req.user._id,
    userRole: 'admin',
    action: 'payout.processed',
    targetModel: 'Payout',
    targetId: payout._id,
    description: `Payout of SAR ${totalAmount.toFixed(2)} processed to provider ${provider.name}`,
    metadata: { bookingIds, totalAmount },
    req
  });

  return sendSuccess(res, 201, 'Payout processed successfully.', { payout });
});

/**
 * @desc   Get all payouts (admin)
 * @route  GET /api/payouts
 * @access Admin
 */
const getAllPayouts = catchAsync(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [payouts, total] = await Promise.all([
    Payout.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('provider', 'name email')
      .populate('processedBy', 'name'),
    Payout.countDocuments()
  ]);

  return sendSuccess(res, 200, 'Payouts retrieved.', { payouts }, getPaginationMeta(total, page, limit));
});

module.exports = {
  getProviderEarnings,
  getProviderPayoutHistory,
  getProviderBalances,
  processPayout,
  getAllPayouts
};
