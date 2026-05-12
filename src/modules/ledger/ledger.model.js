const mongoose = require('mongoose')

const ledgerEntrySchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['credit', 'debit'],
      required: true
    },
    party: {
      type: String,
      enum: ['provider', 'platform'],
      required: true
    },
    partyId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
      default: null
    },
    payoutId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Payout',
      default: null
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    description: {
      type: String,
      required: true
    }
  },
  { timestamps: true }
)

ledgerEntrySchema.index({ partyId: 1, type: 1, createdAt: -1 })
ledgerEntrySchema.index({ bookingId: 1 })

const LedgerEntry = mongoose.model('LedgerEntry', ledgerEntrySchema)
module.exports = LedgerEntry
