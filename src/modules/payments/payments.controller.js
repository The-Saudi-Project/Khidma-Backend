const Payment = require('./payments.model');
const Booking = require('../bookings/bookings.model');
const User = require('../users/users.model');
const NotificationService = require('../notifications/notifications.service');
const AuditService = require('../audit/audit.service');
const { sendSuccess, getPaginationMeta } = require('../../utils/apiResponse');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/AppError');
const path = require('path');
const fs = require('fs');

/**
 * @desc   Upload payment proof
 * @route  POST /api/payments/bookings/:bookingId/upload
 * @access Customer
 */
const uploadPaymentProof = catchAsync(async (req, res, next) => {
  if (!req.file) {
    return next(new AppError('Payment proof file is required.', 400));
  }

  const booking = await Booking.findById(req.params.bookingId);
  if (!booking) return next(new AppError('Booking not found.', 404));

  if (booking.customer.toString() !== req.user._id.toString()) {
    return next(new AppError('Access denied.', 403));
  }

  if (!['pending_payment', 'payment_uploaded'].includes(booking.status)) {
    return next(new AppError('Payment proof cannot be uploaded at this stage.', 400));
  }

  // Check payment deadline
  if (new Date() > booking.paymentDeadline) {
    booking.status = 'expired';
    await booking.save();
    return next(new AppError('Booking has expired. Please create a new booking.', 410));
  }

  // If existing payment pending, delete old file
  if (booking.paymentId) {
    const existing = await Payment.findById(booking.paymentId);
    if (existing && existing.proofFile?.path) {
      const fullPath = path.join(__dirname, '../../', existing.proofFile.path);
      if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    }
    await Payment.findByIdAndDelete(booking.paymentId);
  }

  // Create payment record
  const payment = await Payment.create({
    booking: booking._id,
    customer: req.user._id,
    amount: booking.totalAmount,
    method: req.body.method || 'bank_transfer',
    transactionReference: req.body.transactionReference,
    status: 'pending',
    proofFile: {
      filename: req.file.filename,
      originalName: req.file.originalname,
      path: `/uploads/payments/${req.file.filename}`,
      size: req.file.size,
      mimetype: req.file.mimetype
    }
  });

  // Update booking
  booking.paymentId = payment._id;
  booking.status = 'payment_uploaded';
  booking.addTimelineEvent('payment_uploaded', 'Payment proof uploaded by customer.', req.user._id, 'customer');
  await booking.save();

  // Notify admins
  const admins = await User.find({ role: 'admin', isActive: true }).select('_id');
  await Promise.all(admins.map(admin => NotificationService.paymentUploaded(booking, admin._id)));

  await AuditService.log({
    userId: req.user._id,
    userRole: 'customer',
    action: 'payment.uploaded',
    targetModel: 'Payment',
    targetId: payment._id,
    description: `Payment proof uploaded for booking ${booking.bookingNumber}`,
    req
  });

  return sendSuccess(res, 201, 'Payment proof uploaded successfully.', { payment });
});

/**
 * @desc   Confirm payment (admin)
 * @route  PATCH /api/payments/:paymentId/confirm
 * @access Admin
 */
const confirmPayment = catchAsync(async (req, res, next) => {
  const payment = await Payment.findById(req.params.paymentId).populate('booking');
  if (!payment) return next(new AppError('Payment not found.', 404));

  if (payment.status !== 'pending') {
    return next(new AppError('Payment has already been reviewed.', 400));
  }

  payment.status = 'confirmed';
  payment.reviewedBy = req.user._id;
  payment.reviewedAt = new Date();
  await payment.save();

  const booking = payment.booking;
  booking.status = 'payment_confirmed';
  booking.addTimelineEvent('payment_confirmed', 'Payment confirmed by admin.', req.user._id, 'admin');
  await booking.save();

  await NotificationService.paymentConfirmed(booking, booking.customer);

  await AuditService.log({
    userId: req.user._id,
    userRole: 'admin',
    action: 'payment.confirmed',
    targetModel: 'Payment',
    targetId: payment._id,
    description: `Payment confirmed for booking ${booking.bookingNumber}`,
    req
  });

  return sendSuccess(res, 200, 'Payment confirmed.', { payment });
});

/**
 * @desc   Reject payment (admin)
 * @route  PATCH /api/payments/:paymentId/reject
 * @access Admin
 */
const rejectPayment = catchAsync(async (req, res, next) => {
  const { reason } = req.body;
  const payment = await Payment.findById(req.params.paymentId).populate('booking');
  if (!payment) return next(new AppError('Payment not found.', 404));

  payment.status = 'rejected';
  payment.reviewedBy = req.user._id;
  payment.reviewedAt = new Date();
  payment.rejectionReason = reason;
  await payment.save();

  const booking = payment.booking;
  booking.status = 'pending_payment';
  booking.paymentId = null;
  booking.addTimelineEvent('payment_rejected', `Payment rejected: ${reason}`, req.user._id, 'admin');
  await booking.save();

  await AuditService.log({
    userId: req.user._id,
    userRole: 'admin',
    action: 'payment.rejected',
    targetModel: 'Payment',
    targetId: payment._id,
    description: `Payment rejected for booking ${booking.bookingNumber}. Reason: ${reason}`,
    req
  });

  return sendSuccess(res, 200, 'Payment rejected.', { payment });
});

/**
 * @desc   Get payment details
 * @route  GET /api/payments/:paymentId
 * @access Private
 */
const getPayment = catchAsync(async (req, res, next) => {
  const payment = await Payment.findById(req.params.paymentId)
    .populate('booking')
    .populate('customer', 'name email');

  if (!payment) return next(new AppError('Payment not found.', 404));

  // Access control
  if (req.user.role === 'customer' && payment.customer._id.toString() !== req.user._id.toString()) {
    return next(new AppError('Access denied.', 403));
  }

  return sendSuccess(res, 200, 'Payment retrieved.', { payment });
});

/**
 * @desc   Get all payments (admin)
 * @route  GET /api/payments
 * @access Admin
 */
const getAllPayments = catchAsync(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (status) filter.status = status;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [payments, total] = await Promise.all([
    Payment.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('booking', 'bookingNumber serviceName')
      .populate('customer', 'name email'),
    Payment.countDocuments(filter)
  ]);

  return sendSuccess(res, 200, 'Payments retrieved.', { payments }, getPaginationMeta(total, page, limit));
});

module.exports = { uploadPaymentProof, confirmPayment, rejectPayment, getPayment, getAllPayments };
