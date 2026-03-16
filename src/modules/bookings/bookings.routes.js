const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const ctrl = require('./bookings.controller');
const { protect, restrictTo } = require('../../middleware/auth');
const validate = require('../../middleware/validate');

router.use(protect);

// Admin metrics
router.get('/admin/metrics', restrictTo('admin'), ctrl.getAdminMetrics);

// Customer routes
router.post('/', restrictTo('customer'), [
  body('serviceId').isMongoId().withMessage('Valid service ID required'),
  body('scheduledDate').isISO8601().withMessage('Valid date required'),
  body('scheduledTime').notEmpty().withMessage('Time is required'),
  body('notes').optional().isLength({ max: 1000 }),
  validate
], ctrl.createBooking);

router.get('/my', restrictTo('customer'), ctrl.getMyBookings);

// Provider routes
router.get('/provider/jobs', restrictTo('provider'), ctrl.getProviderJobs);
router.patch('/:id/start', restrictTo('provider'), ctrl.startJob);
router.patch('/:id/complete', restrictTo('provider'), ctrl.completeJob);

// Admin routes
router.get('/', restrictTo('admin'), ctrl.getAllBookings);
router.patch('/:id/assign-provider', restrictTo('admin'), [
  body('providerId').isMongoId().withMessage('Valid provider ID required'),
  validate
], ctrl.assignProvider);

// Shared routes
router.get('/:id', ctrl.getBooking);
router.patch('/:id/cancel', [
  body('reason').optional().isLength({ max: 500 }),
  validate
], ctrl.cancelBooking);
router.patch('/:id/reschedule', restrictTo('customer'), [
  body('scheduledDate').isISO8601().withMessage('Valid date required'),
  body('scheduledTime').notEmpty().withMessage('Time is required'),
  validate
], ctrl.rescheduleBooking);

module.exports = router;
