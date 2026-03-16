const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  type: {
    type: String,
    enum: [
      'booking_created',
      'payment_uploaded',
      'payment_confirmed',
      'payment_rejected',
      'provider_assigned',
      'job_started',
      'job_completed',
      'booking_cancelled',
      'booking_rescheduled',
      'payout_processed',
      'support_reply',
      'review_received',
      'account_activated',
      'account_deactivated',
      'general'
    ],
    required: true
  },
  title: {
    type: String,
    required: true,
    maxlength: 200
  },
  message: {
    type: String,
    required: true,
    maxlength: 1000
  },
  // Reference to related entity
  refModel: {
    type: String,
    enum: ['Booking', 'Payment', 'Payout', 'SupportTicket', 'Review', null],
    default: null
  },
  refId: {
    type: mongoose.Schema.Types.ObjectId,
    default: null
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  // Optional action URL for frontend routing
  actionUrl: String
}, { timestamps: true });

notificationSchema.index({ recipient: 1, isRead: 1 });
notificationSchema.index({ recipient: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;
