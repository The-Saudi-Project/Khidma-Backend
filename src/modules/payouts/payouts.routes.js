const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const ctrl = require('./payouts.controller');
const { protect, restrictTo } = require('../../middleware/auth');
const validate = require('../../middleware/validate');

router.use(protect);

router.get('/provider/earnings', restrictTo('provider'), ctrl.getProviderEarnings);
router.get('/provider/history', restrictTo('provider'), ctrl.getProviderPayoutHistory);
router.get('/admin/balances', restrictTo('admin'), ctrl.getProviderBalances);
router.get('/', restrictTo('admin'), ctrl.getAllPayouts);
router.post('/', restrictTo('admin'), [
  body('providerId').isMongoId().withMessage('Valid provider ID required'),
  body('bookingIds').isArray({ min: 1 }).withMessage('At least one booking required'),
  body('bookingIds.*').isMongoId(),
  validate
], ctrl.processPayout);

module.exports = router;
