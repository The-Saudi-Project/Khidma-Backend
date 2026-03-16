const Booking = require('./bookings.model');
const Service = require('../services/services.model');
const User = require('../users/users.model');
const NotificationService = require('../notifications/notifications.service');
const AuditService = require('../audit/audit.service');
const { sendSuccess, getPaginationMeta } = require('../../utils/apiResponse');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/AppError');

/**
 * @desc   Create booking
 * @route  POST /api/bookings
 * @access Customer
 */
const createBooking = catchAsync(async (req, res, next) => {
  const { serviceId, scheduledDate, scheduledTime, addressId, notes, customAddress } = req.body;

  // Validate service exists and is active
  const service = await Service.findById(serviceId);
  if (!service || !service.isActive) {
    return next(new AppError('Service not found or unavailable.', 404));
  }

  // Resolve address
  let address;
  if (addressId) {
    const user = await User.findById(req.user._id);
    const savedAddr = user.addresses.id(addressId);
    if (!savedAddr) return next(new AppError('Address not found.', 404));
    address = {
      fullAddress: savedAddr.fullAddress,
      city: savedAddr.city,
      district: savedAddr.district,
      landmark: savedAddr.landmark
    };
  } else if (customAddress) {
    address = customAddress;
  } else {
    return next(new AppError('Address is required.', 400));
  }

  // Prevent double booking: same customer, same date/time, active booking
  const conflictingBooking = await Booking.findOne({
    customer: req.user._id,
    scheduledDate: new Date(scheduledDate),
    scheduledTime,
    status: { $nin: ['cancelled', 'expired'] }
  });
  if (conflictingBooking) {
    return next(new AppError('You already have a booking at this date and time.', 409));
  }

  // Create booking with financial snapshot
  const booking = await Booking.create({
    customer: req.user._id,
    service: service._id,
    serviceName: service.name,
    serviceCategory: service.category,
    servicePrice: service.price,
    scheduledDate: new Date(scheduledDate),
    scheduledTime,
    address,
    notes,
    // providerEarning and platformCommission calculated in pre-save hook
  });

  // Add initial timeline event
  booking.addTimelineEvent(
    'booking_created',
    'Booking created. Waiting for payment proof.',
    req.user._id,
    'customer'
  );
  await booking.save();

  // Update service booking count
  await Service.findByIdAndUpdate(serviceId, { $inc: { totalBookings: 1 } });

  // Send notification
  await NotificationService.bookingCreated(booking, req.user._id);

  await AuditService.log({
    userId: req.user._id,
    userRole: 'customer',
    action: 'booking.created',
    targetModel: 'Booking',
    targetId: booking._id,
    description: `Booking ${booking.bookingNumber} created for ${service.name}`,
    req
  });

  return sendSuccess(res, 201, 'Booking created successfully.', { booking });
});

/**
 * @desc   Get customer's bookings
 * @route  GET /api/bookings/my
 * @access Customer
 */
const getMyBookings = catchAsync(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const filter = { customer: req.user._id };
  if (status) filter.status = status;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('service', 'name category image')
      .populate('provider', 'name phone providerProfile.averageRating'),
    Booking.countDocuments(filter)
  ]);

  return sendSuccess(res, 200, 'Bookings retrieved.', { bookings }, getPaginationMeta(total, page, limit));
});

/**
 * @desc   Get single booking (customer/provider/admin)
 * @route  GET /api/bookings/:id
 * @access Private
 */
const getBooking = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id)
    .populate('service', 'name category image description')
    .populate('customer', 'name email phone')
    .populate('provider', 'name email phone providerProfile.averageRating')
    .populate('paymentId')
    .populate('reviewId');

  if (!booking) return next(new AppError('Booking not found.', 404));

  // Access control: customer can only see their own, provider can only see assigned
  const user = req.user;
  if (user.role === 'customer' && booking.customer._id.toString() !== user._id.toString()) {
    return next(new AppError('Access denied.', 403));
  }
  if (user.role === 'provider' && booking.provider?._id.toString() !== user._id.toString()) {
    return next(new AppError('Access denied.', 403));
  }

  return sendSuccess(res, 200, 'Booking retrieved.', { booking });
});

/**
 * @desc   Cancel booking
 * @route  PATCH /api/bookings/:id/cancel
 * @access Customer (before provider_assigned), Admin (any time)
 */
const cancelBooking = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return next(new AppError('Booking not found.', 404));

  const user = req.user;

  // Authorization
  if (user.role === 'customer') {
    if (booking.customer.toString() !== user._id.toString()) {
      return next(new AppError('Access denied.', 403));
    }
    // Customers can only cancel before provider is assigned
    if (['provider_assigned', 'in_progress', 'completed'].includes(booking.status)) {
      return next(new AppError('Cannot cancel booking at this stage. Please contact support.', 400));
    }
  }

  if (['completed', 'cancelled', 'expired'].includes(booking.status)) {
    return next(new AppError('Booking cannot be cancelled.', 400));
  }

  const { reason } = req.body;

  booking.status = 'cancelled';
  booking.cancelledBy = user._id;
  booking.cancellationReason = reason;
  booking.cancelledAt = new Date();
  booking.addTimelineEvent('cancelled', `Booking cancelled${reason ? `: ${reason}` : ''}`, user._id, user.role);
  await booking.save();

  // Notify affected parties
  const customerId = booking.customer.toString();
  const providerId = booking.provider?.toString();

  if (user.role !== 'customer') {
    await NotificationService.bookingCancelled(booking, customerId, reason);
  }
  if (providerId && user.role !== 'provider') {
    await NotificationService.bookingCancelled(booking, providerId, reason);
  }

  await AuditService.log({
    userId: user._id,
    userRole: user.role,
    action: 'booking.cancelled',
    targetModel: 'Booking',
    targetId: booking._id,
    description: `Booking ${booking.bookingNumber} cancelled. Reason: ${reason || 'N/A'}`,
    req
  });

  return sendSuccess(res, 200, 'Booking cancelled.', { booking });
});

/**
 * @desc   Reschedule booking
 * @route  PATCH /api/bookings/:id/reschedule
 * @access Customer (before in_progress)
 */
const rescheduleBooking = catchAsync(async (req, res, next) => {
  const { scheduledDate, scheduledTime } = req.body;
  const booking = await Booking.findById(req.params.id);
  if (!booking) return next(new AppError('Booking not found.', 404));

  if (booking.customer.toString() !== req.user._id.toString()) {
    return next(new AppError('Access denied.', 403));
  }

  if (['in_progress', 'completed', 'cancelled', 'expired'].includes(booking.status)) {
    return next(new AppError('Cannot reschedule at this stage.', 400));
  }

  booking.addTimelineEvent(
    'rescheduled',
    `Booking rescheduled from ${booking.scheduledDate.toLocaleDateString()} to ${new Date(scheduledDate).toLocaleDateString()}`,
    req.user._id,
    'customer'
  );

  booking.scheduledDate = new Date(scheduledDate);
  booking.scheduledTime = scheduledTime;
  await booking.save();

  return sendSuccess(res, 200, 'Booking rescheduled.', { booking });
});

// ─── Provider Actions ─────────────────────────────────────────────────────────

/**
 * @desc   Get provider's jobs
 * @route  GET /api/bookings/provider/jobs
 * @access Provider
 */
const getProviderJobs = catchAsync(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const filter = { provider: req.user._id };
  if (status) filter.status = status;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .sort({ scheduledDate: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('service', 'name category')
      .populate('customer', 'name phone'),
    Booking.countDocuments(filter)
  ]);

  return sendSuccess(res, 200, 'Jobs retrieved.', { bookings }, getPaginationMeta(total, page, limit));
});

/**
 * @desc   Provider starts job
 * @route  PATCH /api/bookings/:id/start
 * @access Provider
 */
const startJob = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return next(new AppError('Booking not found.', 404));

  if (booking.provider?.toString() !== req.user._id.toString()) {
    return next(new AppError('Access denied.', 403));
  }

  if (booking.status !== 'provider_assigned') {
    return next(new AppError('Job cannot be started at current status.', 400));
  }

  booking.status = 'in_progress';
  booking.addTimelineEvent('in_progress', 'Provider has started the job.', req.user._id, 'provider');
  await booking.save();

  await NotificationService.jobStarted(booking, booking.customer);

  return sendSuccess(res, 200, 'Job started.', { booking });
});

/**
 * @desc   Provider completes job
 * @route  PATCH /api/bookings/:id/complete
 * @access Provider
 */
const completeJob = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return next(new AppError('Booking not found.', 404));

  if (booking.provider?.toString() !== req.user._id.toString()) {
    return next(new AppError('Access denied.', 403));
  }

  if (booking.status !== 'in_progress') {
    return next(new AppError('Job is not in progress.', 400));
  }

  booking.status = 'completed';
  booking.addTimelineEvent('completed', 'Job completed by provider.', req.user._id, 'provider');
  await booking.save();

  // Update provider stats
  await User.findByIdAndUpdate(req.user._id, {
    $inc: {
      'providerProfile.completedJobs': 1,
      'providerProfile.pendingEarnings': booking.providerEarning
    }
  });

  await NotificationService.jobCompleted(booking, booking.customer);

  await AuditService.log({
    userId: req.user._id,
    userRole: 'provider',
    action: 'booking.completed',
    targetModel: 'Booking',
    targetId: booking._id,
    description: `Booking ${booking.bookingNumber} completed by provider`,
    req
  });

  return sendSuccess(res, 200, 'Job completed.', { booking });
});

// ─── Admin Booking Management ─────────────────────────────────────────────────

/**
 * @desc   Get all bookings (admin)
 * @route  GET /api/bookings
 * @access Admin
 */
const getAllBookings = catchAsync(async (req, res) => {
  const { status, page = 1, limit = 20, search, startDate, endDate } = req.query;

  const filter = {};
  if (status) filter.status = status;
  if (startDate || endDate) {
    filter.scheduledDate = {};
    if (startDate) filter.scheduledDate.$gte = new Date(startDate);
    if (endDate) filter.scheduledDate.$lte = new Date(endDate);
  }
  if (search) {
    filter.$or = [
      { bookingNumber: { $regex: search, $options: 'i' } },
      { serviceName: { $regex: search, $options: 'i' } }
    ];
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [bookings, total] = await Promise.all([
    Booking.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('customer', 'name email phone')
      .populate('provider', 'name email phone')
      .populate('service', 'name'),
    Booking.countDocuments(filter)
  ]);

  return sendSuccess(res, 200, 'Bookings retrieved.', { bookings }, getPaginationMeta(total, page, limit));
});

/**
 * @desc   Assign provider to booking (admin)
 * @route  PATCH /api/bookings/:id/assign-provider
 * @access Admin
 */
const assignProvider = catchAsync(async (req, res, next) => {
  const { providerId } = req.body;

  const [booking, provider] = await Promise.all([
    Booking.findById(req.params.id),
    User.findOne({ _id: providerId, role: 'provider', isActive: true })
  ]);

  if (!booking) return next(new AppError('Booking not found.', 404));
  if (!provider) return next(new AppError('Provider not found or inactive.', 404));

  if (booking.status !== 'payment_confirmed') {
    return next(new AppError('Provider can only be assigned after payment is confirmed.', 400));
  }

  const previousProvider = booking.provider;
  booking.provider = providerId;
  booking.status = 'provider_assigned';
  booking.addTimelineEvent(
    'provider_assigned',
    `Provider ${provider.name} assigned by admin.`,
    req.user._id,
    'admin'
  );
  await booking.save();

  await NotificationService.providerAssigned(booking, providerId, booking.customer);

  await AuditService.log({
    userId: req.user._id,
    userRole: 'admin',
    action: 'booking.provider_assigned',
    targetModel: 'Booking',
    targetId: booking._id,
    description: `Provider ${provider.name} assigned to booking ${booking.bookingNumber}`,
    metadata: { providerId, previousProvider },
    req
  });

  return sendSuccess(res, 200, 'Provider assigned.', { booking });
});

/**
 * @desc   Admin dashboard metrics
 * @route  GET /api/bookings/admin/metrics
 * @access Admin
 */
const getAdminMetrics = catchAsync(async (req, res) => {
  const [
    totalBookings,
    activeBookings,
    completedBookings,
    cancelledBookings,
    revenueAgg,
    recentBookings
  ] = await Promise.all([
    Booking.countDocuments(),
    Booking.countDocuments({ status: { $in: ['payment_confirmed', 'provider_assigned', 'in_progress'] } }),
    Booking.countDocuments({ status: 'completed' }),
    Booking.countDocuments({ status: 'cancelled' }),
    Booking.aggregate([
      { $match: { status: 'completed' } },
      {
        $group: {
          _id: null,
          totalRevenue: { $sum: '$totalAmount' },
          platformRevenue: { $sum: '$platformCommission' },
          providerPayouts: { $sum: '$providerEarning' }
        }
      }
    ]),
    Booking.find({ status: { $nin: ['expired'] } })
      .sort({ createdAt: -1 })
      .limit(5)
      .populate('customer', 'name')
      .select('bookingNumber serviceName status totalAmount createdAt')
  ]);

  const revenue = revenueAgg[0] || { totalRevenue: 0, platformRevenue: 0, providerPayouts: 0 };

  return sendSuccess(res, 200, 'Metrics retrieved.', {
    metrics: {
      totalBookings,
      activeBookings,
      completedBookings,
      cancelledBookings,
      pendingBookings: await Booking.countDocuments({ status: 'pending_payment' }),
      ...revenue
    },
    recentBookings
  });
});

module.exports = {
  createBooking,
  getMyBookings,
  getBooking,
  cancelBooking,
  rescheduleBooking,
  getProviderJobs,
  startJob,
  completeJob,
  getAllBookings,
  assignProvider,
  getAdminMetrics
};
