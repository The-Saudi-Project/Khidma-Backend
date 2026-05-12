const express = require('express')
const { body } = require('express-validator')
const router = express.Router()
const ctrl = require('./reviews.controller')
const { protect, restrictTo } = require('../../middleware/auth')
const validate = require('../../middleware/validate')

router.get('/provider/:providerId', ctrl.getProviderReviews)

router.use(protect)

router.post('/', restrictTo('customer'), [
  body('bookingId').isMongoId().withMessage('Valid booking ID required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be between 1 and 5'),
  body('comment').optional().isLength({ max: 1000 }),
  validate
], ctrl.createReview)

router.get('/', restrictTo('admin'), ctrl.getAllReviews)
router.patch('/:id/toggle-visibility', restrictTo('admin'), ctrl.toggleReviewVisibility)

module.exports = router
