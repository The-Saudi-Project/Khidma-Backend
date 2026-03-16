const Service = require('./services.model');
const { sendSuccess, getPaginationMeta } = require('../../utils/apiResponse');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/AppError');
const AuditService = require('../audit/audit.service');
const path = require('path');
const fs = require('fs');

/**
 * @desc   Get all active services (public)
 * @route  GET /api/services
 * @access Public
 */
const getServices = catchAsync(async (req, res) => {
  const { category, search, sortBy = 'sortOrder', page = 1, limit = 20 } = req.query;

  const filter = { isActive: true };
  if (category) filter.category = { $regex: category, $options: 'i' };
  if (search) filter.$text = { $search: search };

  const sortMap = {
    price_asc: { price: 1 },
    price_desc: { price: -1 },
    rating: { averageRating: -1 },
    bookings: { totalBookings: -1 },
    sortOrder: { sortOrder: 1, createdAt: -1 }
  };
  const sort = sortMap[sortBy] || { sortOrder: 1 };

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [services, total] = await Promise.all([
    Service.find(filter).sort(sort).skip(skip).limit(parseInt(limit)),
    Service.countDocuments(filter)
  ]);

  // Get distinct categories
  const categories = await Service.distinct('category', { isActive: true });

  return sendSuccess(res, 200, 'Services retrieved.', { services, categories },
    getPaginationMeta(total, page, limit));
});

/**
 * @desc   Get single service
 * @route  GET /api/services/:idOrSlug
 * @access Public
 */
const getService = catchAsync(async (req, res, next) => {
  const { idOrSlug } = req.params;
  const isObjectId = /^[a-f\d]{24}$/i.test(idOrSlug);
  const filter = isObjectId ? { _id: idOrSlug } : { slug: idOrSlug };

  const service = await Service.findOne({ ...filter, isActive: true });
  if (!service) return next(new AppError('Service not found.', 404));

  return sendSuccess(res, 200, 'Service retrieved.', { service });
});

/**
 * @desc   Create service (admin)
 * @route  POST /api/services
 * @access Admin
 */
const createService = catchAsync(async (req, res) => {
  const serviceData = { ...req.body };

  if (req.file) {
    serviceData.image = `/uploads/services/${req.file.filename}`;
  }

  const service = await Service.create(serviceData);

  await AuditService.log({
    userId: req.user._id,
    userRole: 'admin',
    action: 'service.created',
    targetModel: 'Service',
    targetId: service._id,
    description: `Service created: ${service.name}`,
    req
  });

  return sendSuccess(res, 201, 'Service created.', { service });
});

/**
 * @desc   Update service (admin)
 * @route  PUT /api/services/:id
 * @access Admin
 */
const updateService = catchAsync(async (req, res, next) => {
  const service = await Service.findById(req.params.id);
  if (!service) return next(new AppError('Service not found.', 404));

  const updates = { ...req.body };

  if (req.file) {
    // Delete old image if exists
    if (service.image) {
      const oldPath = path.join(__dirname, '../../', service.image);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    updates.image = `/uploads/services/${req.file.filename}`;
  }

  const updated = await Service.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true
  });

  await AuditService.log({
    userId: req.user._id,
    userRole: 'admin',
    action: 'service.updated',
    targetModel: 'Service',
    targetId: service._id,
    description: `Service updated: ${service.name}`,
    req
  });

  return sendSuccess(res, 200, 'Service updated.', { service: updated });
});

/**
 * @desc   Delete service (admin) — soft delete
 * @route  DELETE /api/services/:id
 * @access Admin
 */
const deleteService = catchAsync(async (req, res, next) => {
  const service = await Service.findById(req.params.id);
  if (!service) return next(new AppError('Service not found.', 404));

  service.isActive = false;
  await service.save();

  await AuditService.log({
    userId: req.user._id,
    userRole: 'admin',
    action: 'service.deleted',
    targetModel: 'Service',
    targetId: service._id,
    description: `Service deactivated: ${service.name}`,
    req
  });

  return sendSuccess(res, 200, 'Service deleted.');
});

/**
 * @desc   Get all services including inactive (admin)
 * @route  GET /api/services/admin/all
 * @access Admin
 */
const getServicesAdmin = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, search } = req.query;
  const filter = {};
  if (search) filter.$text = { $search: search };

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [services, total] = await Promise.all([
    Service.find(filter).sort({ sortOrder: 1, createdAt: -1 }).skip(skip).limit(parseInt(limit)),
    Service.countDocuments(filter)
  ]);

  return sendSuccess(res, 200, 'Services retrieved.', { services }, getPaginationMeta(total, page, limit));
});

module.exports = { getServices, getService, createService, updateService, deleteService, getServicesAdmin };
