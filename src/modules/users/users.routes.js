const express = require('express');
const { body, param } = require('express-validator');
const router = express.Router();
const ctrl = require('./users.controller');
const { protect, restrictTo } = require('../../middleware/auth');
const validate = require('../../middleware/validate');

// All routes require authentication
router.use(protect);

// Current user
router.get('/profile', ctrl.getProfile);
router.put('/profile', [
  body('name').optional().trim().notEmpty().isLength({ max: 100 }),
  body('phone').optional().isMobilePhone(),
  body('bio').optional().isLength({ max: 500 }),
  validate
], ctrl.updateProfile);
router.delete('/account', restrictTo('customer'), ctrl.deleteAccount);

// Addresses (customer only)
router.post('/addresses', restrictTo('customer'), [
  body('fullAddress').notEmpty().withMessage('Full address is required'),
  body('city').notEmpty().withMessage('City is required'),
  body('label').optional().isLength({ max: 50 }),
  validate
], ctrl.addAddress);
router.put('/addresses/:addressId', restrictTo('customer'), [
  body('fullAddress').optional().notEmpty().withMessage('Full address cannot be empty'),
  body('city').optional().notEmpty().withMessage('City cannot be empty'),
  body('label').optional().isLength({ max: 50 }),
  validate
], ctrl.updateAddress);
router.delete('/addresses/:addressId', restrictTo('customer'), ctrl.deleteAddress);

// Provider availability
router.patch('/providers/availability', restrictTo('provider'), [
  body('isAvailable').isBoolean(),
  validate
], ctrl.updateAvailability);

// Admin routes
router.get('/', restrictTo('admin'), ctrl.getAllUsers);
router.get('/providers/:id/stats', restrictTo('admin'), ctrl.getProviderStats);
router.get('/providers', restrictTo('admin'), ctrl.getProviders);
router.post('/providers', restrictTo('admin'), [
  body('name').trim().notEmpty(),
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/),
  body('phone').optional().isMobilePhone(),
  validate
], ctrl.createProvider);
router.get('/:id', restrictTo('admin'), ctrl.getUserById);
router.patch('/:id/toggle-status', restrictTo('admin'), ctrl.toggleUserStatus);

module.exports = router;
