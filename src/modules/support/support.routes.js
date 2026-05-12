const express = require('express');
const { body } = require('express-validator');
const router = express.Router();
const SupportTicket = require('./support.model');
const NotificationService = require('../notifications/notifications.service');
const { sendSuccess, getPaginationMeta } = require('../../utils/apiResponse');
const catchAsync = require('../../utils/catchAsync');
const AppError = require('../../utils/AppError');
const { protect, restrictTo } = require('../../middleware/auth');
const validate = require('../../middleware/validate');
const { assertOwnership } = require('../../utils/assertOwnership');

/**
 * @desc   Create support ticket
 * @route  POST /api/support
 * @access Customer, Provider
 */
const createTicket = catchAsync(async (req, res) => {
  const { subject, category, message, relatedBooking } = req.body;

  const ticket = await SupportTicket.create({
    submittedBy: req.user._id,
    submittedByRole: req.user.role,
    subject,
    category: category || 'other',
    relatedBooking: relatedBooking || null,
    messages: [{
      sender: req.user._id,
      senderRole: req.user.role,
      content: message
    }]
  });

  return sendSuccess(res, 201, 'Support ticket created.', { ticket });
});

/**
 * @desc   Get my tickets
 * @route  GET /api/support/my
 * @access Customer, Provider
 */
const getMyTickets = catchAsync(async (req, res) => {
  const { status, page = 1, limit = 10 } = req.query;
  const filter = { submittedBy: req.user._id };
  if (status) filter.status = status;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [tickets, total] = await Promise.all([
    SupportTicket.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-messages'),
    SupportTicket.countDocuments(filter)
  ]);

  return sendSuccess(res, 200, 'Tickets retrieved.', { tickets }, getPaginationMeta(total, page, limit));
});

/**
 * @desc   Get single ticket with messages
 * @route  GET /api/support/:id
 * @access Owner or Admin
 */
const getTicket = catchAsync(async (req, res, next) => {
  const ticket = await SupportTicket.findById(req.params.id)
    .populate('submittedBy', 'name email role')
    .populate('assignedTo', 'name email')
    .populate('messages.sender', 'name role');

  if (!ticket) return next(new AppError('Ticket not found.', 404));

  if (req.user.role !== 'admin') {
    try {
      assertOwnership(ticket, req.user._id, 'submittedBy');
    } catch (e) {
      return next(e);
    }
  }

  return sendSuccess(res, 200, 'Ticket retrieved.', { ticket });
});

/**
 * @desc   Reply to ticket
 * @route  POST /api/support/:id/reply
 * @access Owner or Admin
 */
const replyToTicket = catchAsync(async (req, res, next) => {
  const { message } = req.body;
  const ticket = await SupportTicket.findById(req.params.id);
  if (!ticket) return next(new AppError('Ticket not found.', 404));

  if (req.user.role !== 'admin') {
    try {
      assertOwnership(ticket, req.user._id, 'submittedBy');
    } catch (e) {
      return next(e);
    }
  }

  if (['resolved', 'closed'].includes(ticket.status)) {
    return next(new AppError('Cannot reply to a closed ticket.', 400));
  }

  ticket.messages.push({
    sender: req.user._id,
    senderRole: req.user.role,
    content: message
  });

  // Update status
  if (req.user.role === 'admin') {
    ticket.status = 'waiting_customer';
    const ownerId = ticket.submittedBy?._id || ticket.submittedBy;
    setImmediate(() => {
      NotificationService.supportReply(ticket, ownerId);
    });
  } else {
    ticket.status = 'in_progress';
  }

  await ticket.save();

  return sendSuccess(res, 200, 'Reply sent.', { ticket });
});

/**
 * @desc   Update ticket status (admin)
 * @route  PATCH /api/support/:id/status
 * @access Admin
 */
const updateTicketStatus = catchAsync(async (req, res, next) => {
  const { status } = req.body;
  const ticket = await SupportTicket.findById(req.params.id);
  if (!ticket) return next(new AppError('Ticket not found.', 404));

  ticket.status = status;
  if (status === 'resolved') ticket.resolvedAt = new Date();
  if (status === 'closed') ticket.closedAt = new Date();
  await ticket.save();

  return sendSuccess(res, 200, 'Ticket status updated.', { ticket });
});

/**
 * @desc   Get all tickets (admin)
 * @route  GET /api/support
 * @access Admin
 */
const getAllTickets = catchAsync(async (req, res) => {
  const { status, priority, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (priority) filter.priority = priority;

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [tickets, total] = await Promise.all([
    SupportTicket.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('submittedBy', 'name email role')
      .select('-messages'),
    SupportTicket.countDocuments(filter)
  ]);

  return sendSuccess(res, 200, 'Tickets retrieved.', { tickets }, getPaginationMeta(total, page, limit));
});

router.use(protect);

router.post('/', restrictTo('customer', 'provider'), [
  body('subject').trim().notEmpty().isLength({ max: 200 }),
  body('message').trim().notEmpty().isLength({ max: 5000 }),
  body('category').optional().isIn(['booking_issue', 'payment_issue', 'provider_issue', 'account_issue', 'other']),
  body('relatedBooking').optional().isMongoId(),
  validate
], createTicket);

router.get('/my', restrictTo('customer', 'provider'), getMyTickets);
router.get('/', restrictTo('admin'), getAllTickets);
router.get('/:id', getTicket);

router.post('/:id/reply', [
  body('message').trim().notEmpty().isLength({ max: 5000 }),
  validate
], replyToTicket);

router.patch('/:id/status', restrictTo('admin'), [
  body('status').isIn(['open', 'in_progress', 'waiting_customer', 'resolved', 'closed']),
  validate
], updateTicketStatus);

module.exports = router;
