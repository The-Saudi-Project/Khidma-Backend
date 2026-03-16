const express = require('express');
const router = express.Router();
const AuditLog = require('./audit.model');
const { sendSuccess, getPaginationMeta } = require('../../utils/apiResponse');
const catchAsync = require('../../utils/catchAsync');
const { protect, restrictTo } = require('../../middleware/auth');

router.use(protect, restrictTo('admin'));

router.get('/', catchAsync(async (req, res) => {
  const { action, userId, page = 1, limit = 50 } = req.query;
  const filter = {};
  if (action) filter.action = { $regex: action, $options: 'i' };
  if (userId) filter.performedBy = userId;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('performedBy', 'name email role'),
    AuditLog.countDocuments(filter)
  ]);

  return sendSuccess(res, 200, 'Audit logs retrieved.', { logs }, getPaginationMeta(total, page, limit));
}));

module.exports = router;
