const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'SAR'
  },
  method: {
    type: String,
    enum: ['bank_transfer', 'stc_pay', 'mada', 'other'],
    default: 'bank_transfer'
  },
  status: {
    type: String,
    enum: ['pending', 'under_review', 'confirmed', 'rejected'],
    default: 'pending'
  },

  // Proof upload
  proofFile: {
    filename: String,
    originalName: String,
    path: String,
    size: Number,
    mimetype: String,
    uploadedAt: { type: Date, default: Date.now }
  },

  // Review details
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  reviewedAt: Date,
  rejectionReason: String,

  // Reference number customer provides
  transactionReference: String,

  notes: String
}, { timestamps: true });

paymentSchema.index({ booking: 1 });
paymentSchema.index({ customer: 1 });
paymentSchema.index({ status: 1 });
paymentSchema.index({ status: 1, createdAt: -1 });
paymentSchema.index({ booking: 1, status: 1 });

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;
