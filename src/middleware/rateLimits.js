const rateLimit = require('express-rate-limit')

const uploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: parseInt(process.env.UPLOAD_PER_MINUTE_LIMIT, 10) || 10,
  message: { success: false, message: 'Too many uploads.' },
  standardHeaders: true,
  legacyHeaders: false
})

const bookingCreateLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: parseInt(process.env.BOOKING_DAILY_LIMIT, 10) || 15,
  keyGenerator: (req) => (req.user && req.user._id ? req.user._id.toString() : req.ip),
  message: { success: false, message: 'Booking limit reached for today.' },
  standardHeaders: true,
  legacyHeaders: false
})

const applicationLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000,
  max: 3,
  message: { success: false, message: 'Too many applications from this IP.' },
  standardHeaders: true,
  legacyHeaders: false
})

module.exports = { uploadLimiter, bookingCreateLimiter, applicationLimiter }
