const mongoose = require('mongoose')

const revokedAccessJtiSchema = new mongoose.Schema({
  jti: {
    type: String,
    required: true,
    unique: true,

  },
  expiresAt: {
    type: Date,
    required: true
  }
}, { timestamps: true })

revokedAccessJtiSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const RevokedAccessJti = mongoose.model('RevokedAccessJti', revokedAccessJtiSchema)
module.exports = RevokedAccessJti
