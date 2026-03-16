const mongoose = require('mongoose');

const payoutSchema = new mongoose.Schema({
  provider: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Bookings included in this payout
  bookings: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking'
  }],
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'SAR'
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending'
  },
  method: {
    type: String,
    enum: ['bank_transfer', 'stc_pay', 'mada', 'other'],
    default: 'bank_transfer'
  },
  // Bank / payment details provided by provider
  paymentDetails: {
    bankName: String,
    accountNumber: String,
    iban: String,
    accountName: String
  },
  transactionReference: String,
  notes: String,
  paidAt: Date
}, { timestamps: true });

payoutSchema.index({ provider: 1 });
payoutSchema.index({ status: 1 });

const Payout = mongoose.model('Payout', payoutSchema);
module.exports = Payout;
