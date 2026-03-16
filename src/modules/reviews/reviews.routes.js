const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const Review = require('./reviews.model');
const Booking = require('../bookings/bookings.model');
const { sendSuccess, getPaginationMeta } = require('../../utils/apiResponse');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/AppError');
const { protect, restrictTo } = require('../../middleware/auth');
const validate = require('../../middleware/validate');

/**
 * @desc   Create review (customer, after job completed)
 * @route  POST /api/reviews
 * @access Customer
 */
const createReview = catchAsync(async (req, res, next) => {
  const { bookingId, rating, comment } = req.body;

  const booking = await Booking.findById(bookingId);
  if (!booking) return next(new AppError('Booking not found.', 404));

  if (booking.customer.toString() !== req.user._id.toString()) {
    return next(new AppError('Access denied.', 403));
  }

  if (booking.status !== 'completed') {
    return next(new AppError('You can only review completed bookings.', 400));
  }

  if (booking.reviewId) {
    return next(new AppError('You have already reviewed this booking.', 409));
  }

  const review = await Review.create({
    booking: bookingId,
    customer: req.user._id,
    provider: booking.provider,
    service: booking.service,
    rating,
    comment
  });

  booking.reviewId = review._id;
  await booking.save();

  return sendSuccess(res, 201, 'Review submitted. Thank you!', { review });
});

/**
 * @desc   Get reviews for a provider
 * @route  GET /api/reviews/provider/:providerId
 * @access Public
 */
const getProviderReviews = catchAsync(async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [reviews, total] = await Promise.all([
    Review.find({ provider: req.params.providerId, isVisible: true })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('customer', 'name avatar')
      .populate('service', 'name'),
    Review.countDocuments({ provider: req.params.providerId, isVisible: true })
  ]);

  return sendSuccess(res, 200, 'Reviews retrieved.', { reviews }, getPaginationMeta(total, page, limit));
});

/**
 * @desc   Get all reviews (admin)
 * @route  GET /api/reviews
 * @access Admin
 */
const getAllReviews = catchAsync(async (req, res) => {
  const { page = 1, limit = 20 } = req.query;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [reviews, total] = await Promise.all([
    Review.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('customer', 'name email')
      .populate('provider', 'name email')
      .populate('service', 'name'),
    Review.countDocuments()
  ]);

  return sendSuccess(res, 200, 'Reviews retrieved.', { reviews }, getPaginationMeta(total, page, limit));
});

/**
 * @desc   Toggle review visibility (admin)
 * @route  PATCH /api/reviews/:id/toggle-visibility
 * @access Admin
 */
const toggleReviewVisibility = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.id);
  if (!review) return next(new AppError('Review not found.', 404));

  review.isVisible = !review.isVisible;
  await review.save();

  return sendSuccess(res, 200, `Review ${review.isVisible ? 'shown' : 'hidden'}.`, { review });
});

router.use(protect);

router.post('/', restrictTo('customer'), [
  body('bookingId').isMongoId().withMessage('Valid booking ID required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().isLength({ max: 1000 }),
  validate
], createReview);

router.get('/provider/:providerId', reviewsCtrl_getProviderReviews);
router.get('/', restrictTo('admin'), getAllReviews);
router.patch('/:id/toggle-visibility', restrictTo('admin'), toggleReviewVisibility);

// Fix: export route inline
function reviewsCtrl_getProviderReviews(req, res, next) {
  return getProviderReviews(req, res, next);
}

module.exports = router;
