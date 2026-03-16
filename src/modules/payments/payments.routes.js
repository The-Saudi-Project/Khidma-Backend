const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const ctrl = require('./payments.controller');
const { protect, restrictTo } = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const { upload } = require('../../config/upload');

router.use(protect);

router.post('/bookings/:bookingId/upload', restrictTo('customer'),
  upload.single('proofFile'), ctrl.uploadPaymentProof);

router.get('/', restrictTo('admin'), ctrl.getAllPayments);
router.get('/:paymentId', ctrl.getPayment);
router.patch('/:paymentId/confirm', restrictTo('admin'), ctrl.confirmPayment);
router.patch('/:paymentId/reject', restrictTo('admin'), [
  body('reason').notEmpty().withMessage('Rejection reason is required'),
  validate
], ctrl.rejectPayment);

module.exports = router;
