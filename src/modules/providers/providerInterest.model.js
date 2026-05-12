const mongoose = require('mongoose')

const providerInterestSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },
    skills: [{ type: String, trim: true }],
    experience: { type: String, trim: true, default: '' },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: '' },
    createdUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
  },
  { timestamps: true }
)

providerInterestSchema.index({ status: 1, createdAt: -1 })
providerInterestSchema.index({ email: 1 })

const ProviderInterest = mongoose.model('ProviderInterest', providerInterestSchema)
module.exports = ProviderInterest
