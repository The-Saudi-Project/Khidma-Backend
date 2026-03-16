const Notification = require('./notifications.model');
const { sendSuccess } = require('../../utils/apiResponse');
const catchAsync = require('../../utils/catchAsync');

const getMyNotifications = catchAsync(async (req, res) => {
  const { page = 1, limit = 20, unreadOnly } = req.query;
  const filter = { recipient: req.user._id };
  if (unreadOnly === 'true') filter.isRead = false;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit)),
    Notification.countDocuments(filter),
    Notification.countDocuments({ recipient: req.user._id, isRead: false })
  ]);

  return sendSuccess(res, 200, 'Notifications retrieved.', { notifications, unreadCount },
    { total, page: parseInt(page), limit: parseInt(limit) });
});

const markAsRead = catchAsync(async (req, res) => {
  await Notification.findOneAndUpdate(
    { _id: req.params.id, recipient: req.user._id },
    { isRead: true, readAt: new Date() }
  );
  return sendSuccess(res, 200, 'Notification marked as read.');
});

const markAllAsRead = catchAsync(async (req, res) => {
  await Notification.updateMany(
    { recipient: req.user._id, isRead: false },
    { isRead: true, readAt: new Date() }
  );
  return sendSuccess(res, 200, 'All notifications marked as read.');
});

// Routes
const express = require('express');
const router = express.Router();
const { protect } = require('../../middleware/auth');

router.use(protect);
router.get('/', getMyNotifications);
router.patch('/:id/read', markAsRead);
router.patch('/read-all', markAllAsRead);

module.exports = router;
