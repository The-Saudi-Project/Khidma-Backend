const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const ctrl = require('./services.controller');
const { protect, restrictTo } = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const { serviceUpload } = require('../../config/upload');

// Public
router.get('/', ctrl.getServices);
router.get('/admin/all', protect, restrictTo('admin'), ctrl.getServicesAdmin);
router.get('/:idOrSlug', ctrl.getService);

// Admin only
router.post('/', protect, restrictTo('admin'), serviceUpload.single('image'), [
  body('name').trim().notEmpty().withMessage('Service name is required'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  body('price').isFloat({ min: 0 }).withMessage('Valid price is required'),
  body('priceType').optional().isIn(['fixed', 'hourly', 'starting_from']),
  validate
], ctrl.createService);

router.put('/:id', protect, restrictTo('admin'), serviceUpload.single('image'), ctrl.updateService);
router.delete('/:id', protect, restrictTo('admin'), ctrl.deleteService);

module.exports = router;
