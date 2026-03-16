const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const ctrl = require('./auth.controller');
const validate = require('../../middleware/validate');
const { protect } = require('../../middleware/auth');

router.post('/signup', [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and a number'),
  body('phone').optional().isMobilePhone().withMessage('Valid phone number required'),
  validate
], ctrl.signup);

router.post('/login', [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  validate
], ctrl.login);

router.post('/refresh', [
  body('refreshToken').notEmpty().withMessage('Refresh token is required'),
  validate
], ctrl.refresh);

router.get('/me', protect, ctrl.getMe);

router.post('/forgot-password', [
  body('email').isEmail().withMessage('Valid email is required').normalizeEmail(),
  validate
], ctrl.forgotPassword);

router.post('/reset-password', [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and a number'),
  validate
], ctrl.resetPassword);

router.put('/change-password', protect, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain uppercase, lowercase, and a number'),
  validate
], ctrl.changePassword);

module.exports = router;
