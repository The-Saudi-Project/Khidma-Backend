const mongoose = require('mongoose');

/**
 * Timeline event sub-schema for booking lifecycle tracking
 */
const timelineEventSchema = new mongoose.Schema({
  status: { type: String, required: true },
  description: { type: String, required: true },
  performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  performedByRole: { type: String, enum: ['customer', 'provider', 'admin', 'system'] },
  timestamp: { type: Date, default: Date.now },
  metadata: mongoose.Schema.Types.Mixed
}, { _id: true });

/**
 * Booking schema
 * 
 * CRITICAL: serviceName, servicePrice, providerEarning, platformCommission
 * are stored as snapshots at booking time and NEVER recalculated dynamically.
 * This ensures financial integrity even if service prices change later.
 */
const bookingSchema = new mongoose.Schema({
  // Reference
  bookingNumber: {
    type: String,
    unique: true,
    required: true
  },

  // Parties
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Customer is required']
  },
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },

  // Service snapshot (immutable after creation)
  service: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    required: [true, 'Service is required']
  },
  serviceName: {
    type: String,
    required: [true, 'Service name snapshot is required']
  },
  serviceCategory: { type: String },
  servicePrice: {
    type: Number,
    required: [true, 'Service price snapshot is required'],
    min: 0
  },

  // Financial snapshot (set at booking, never changed)
  totalAmount: {
    type: Number,
    required: true,
    min: 0
  },
  providerEarning: {
    type: Number,
    required: true,
    min: 0,
    comment: '70% of total amount - set permanently at booking time'
  },
  platformCommission: {
    type: Number,
    required: true,
    min: 0,
    comment: '30% of total amount - set permanently at booking time'
  },
  commissionRate: {
    type: Number,
    required: true,
    default: 0.30
  },

  // Schedule
  scheduledDate: {
    type: Date,
    required: [true, 'Scheduled date is required']
  },
  scheduledTime: {
    type: String,
    required: [true, 'Scheduled time is required']
  },
  duration: { type: Number, default: 60 }, // minutes

  // Address
  address: {
    fullAddress: { type: String, required: true },
    city: String,
    district: String,
    landmark: String
  },

  // Status lifecycle
  status: {
    type: String,
    enum: [
      'pending_payment',   // Booking created, waiting for payment proof
      'payment_uploaded',  // Customer uploaded payment proof
      'payment_confirmed', // Admin confirmed payment
      'provider_assigned', // Admin assigned a provider
      'in_progress',       // Provider started the job
      'completed',         // Provider marked job complete
      'cancelled',         // Cancelled by any party
      'expired'            // Auto-expired due to no payment
    ],
    default: 'pending_payment'
  },

  // Cancellation
  cancelledBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  cancellationReason: String,
  cancelledAt: Date,

  // Payment
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment',
    default: null
  },
  paymentDeadline: {
    type: Date,
    required: true
  },

  // Provider payout
  isProviderPaid: { type: Boolean, default: false },
  providerPaidAt: Date,
  payoutId: { type: mongoose.Schema.Types.ObjectId, ref: 'Payout', default: null },

  providerAcceptedAt: { type: Date, default: null },
  providerAcceptDeadline: { type: Date, default: null },

  // Timeline (immutable append-only log)
  timeline: [timelineEventSchema],

  // Customer notes
  notes: {
    type: String,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  },

  // Review
  reviewId: { type: mongoose.Schema.Types.ObjectId, ref: 'Review', default: null },

  // Metadata
  rescheduledFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', default: null }
}, {
  timestamps: true
});

// Indexes for common queries
bookingSchema.index({ customer: 1, status: 1 });
bookingSchema.index({ provider: 1, status: 1 });
bookingSchema.index({ status: 1 });

bookingSchema.index({ scheduledDate: 1 });
bookingSchema.index({ paymentDeadline: 1, status: 1 }); // For expiry cron
bookingSchema.index({ service: 1 });

bookingSchema.index(
  { customer: 1, scheduledDate: 1, scheduledTime: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $nin: ['cancelled', 'expired'] } }
  }
);
bookingSchema.index({ customer: 1, createdAt: -1 });
bookingSchema.index({ provider: 1, scheduledDate: 1 });
bookingSchema.index({ status: 1, paymentDeadline: 1 });
bookingSchema.index({ status: 1, createdAt: -1 });

/**
 * Auto-generate booking number before validation
 */
bookingSchema.pre('validate', function (next) {
  if (!this.bookingNumber) {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    this.bookingNumber = `KHD-${timestamp}-${random}`;
  }
  next();
});

/**
 * Calculate financial snapshot before saving new booking
 */
bookingSchema.pre('save', function (next) {
  if (this.isNew) {
    const commissionRate = parseFloat(process.env.PLATFORM_COMMISSION_RATE) || 0.30;
    this.commissionRate = commissionRate;
    this.totalAmount = this.servicePrice;
    this.platformCommission = Math.round(this.totalAmount * commissionRate * 100) / 100;
    this.providerEarning = Math.round((this.totalAmount - this.platformCommission) * 100) / 100;

    // Set payment deadline
    const deadlineMinutes = parseInt(process.env.BOOKING_PAYMENT_DEADLINE_MINUTES) || 1440;
    this.paymentDeadline = new Date(Date.now() + deadlineMinutes * 60 * 1000);
  }
  next();
});

/**
 * Append to timeline helper method
 */
bookingSchema.methods.addTimelineEvent = function (status, description, userId, userRole, metadata = {}) {
  this.timeline.push({
    status,
    description,
    performedBy: userId || null,
    performedByRole: userRole || 'system',
    timestamp: new Date(),
    metadata
  });
};

const Booking = mongoose.model('Booking', bookingSchema);

module.exports = Booking;
