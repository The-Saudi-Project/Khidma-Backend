const express = require('express')
const { body } = require('express-validator')
const router = express.Router()
const ctrl = require('./providerInterest.controller')
const { protect, restrictTo } = require('../../middleware/auth')
const validate = require('../../middleware/validate')
const { applicationLimiter } = require('../../middleware/rateLimits')

router.post('/', applicationLimiter, [
  body('name').trim().notEmpty().isLength({ max: 100 }),
  body('email').isEmail().normalizeEmail(),
  body('phone').trim().notEmpty(),
  body('city').trim().notEmpty(),
  body('skills').optional().isArray(),
  body('experience').optional().isLength({ max: 2000 }),
  validate
], ctrl.submitInterest)

router.use(protect, restrictTo('admin'))

router.get('/', ctrl.listApplications)
router.post('/:id/approve', [
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and a number'),
  validate
], ctrl.approveApplication)
router.post('/:id/reject', [
  body('reason').optional().isLength({ max: 500 }),
  validate
], ctrl.rejectApplication)

module.exports = router
