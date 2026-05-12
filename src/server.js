require('dotenv').config()
const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const compression = require('compression')
const mongoSanitize = require('express-mongo-sanitize')
const rateLimit = require('express-rate-limit')
const morgan = require('morgan')
const path = require('path')
const mongoose = require('mongoose')

const connectDB = require('./config/database')
const logger = require('./config/logger')
const errorHandler = require('./middleware/errorHandler')
const { notFound } = require('./middleware/notFound')

const authRoutes = require('./modules/auth/auth.routes')
const userRoutes = require('./modules/users/users.routes')
const serviceRoutes = require('./modules/services/services.routes')
const bookingRoutes = require('./modules/bookings/bookings.routes')
const paymentRoutes = require('./modules/payments/payments.routes')
const payoutRoutes = require('./modules/payouts/payouts.routes')
const notificationRoutes = require('./modules/notifications/notifications.routes')
const reviewRoutes = require('./modules/reviews/reviews.routes')
const supportRoutes = require('./modules/support/support.routes')
const auditRoutes = require('./modules/audit/audit.routes')
const ledgerRoutes = require('./modules/ledger/ledger.routes')
const providerInterestRoutes = require('./modules/providers/providerInterest.routes')

const app = express()

const parseOrigins = () => {
  const raw = process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5173'
  return raw.split(',').map((s) => s.trim()).filter(Boolean)
}

app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}))

app.use(cors({
  origin: (origin, cb) => {
    const allowed = parseOrigins()
    if (!origin || allowed.includes(origin)) return cb(null, true)
    return cb(null, false)
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}))

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { success: false, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
})

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many auth attempts, please try again later.' }
})

app.use('/api/', globalLimiter)
app.use('/api/auth/', authLimiter)

app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use(mongoSanitize())

app.use(compression())

if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'))
} else {
  app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) }
  }))
}

app.use('/uploads', express.static(path.join(__dirname, 'uploads'), {
  setHeaders: (res) => {
    res.set('X-Content-Type-Options', 'nosniff')
  }
}))

app.get('/health', async (req, res) => {
  const checks = {
    mongodb: 'unknown',
    uptime: Math.floor(process.uptime()),
    memory: process.memoryUsage().heapUsed
  }
  try {
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      await mongoose.connection.db.admin().ping()
      checks.mongodb = 'ok'
    } else {
      checks.mongodb = 'error'
    }
  } catch {
    checks.mongodb = 'error'
  }
  const healthy = checks.mongodb === 'ok'
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'degraded',
    checks,
    timestamp: new Date().toISOString()
  })
})

app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/services', serviceRoutes)
app.use('/api/bookings', bookingRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/payouts', payoutRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/reviews', reviewRoutes)
app.use('/api/support', supportRoutes)
app.use('/api/audit', auditRoutes)
app.use('/api/ledger', ledgerRoutes)
app.use('/api/provider-interest', providerInterestRoutes)

app.use(notFound)

app.use(errorHandler)

const PORT = process.env.PORT || 5000

connectDB().then(() => {
  try {
    require('./jobs/bookingExpiry').startExpiryScheduler()
  } catch (e) {
    logger.error(`Scheduler init failed: ${e.message}`)
  }

  const server = app.listen(PORT, () => {
    logger.info(`Khidma API running on port ${PORT} in ${process.env.NODE_ENV} mode`)
  })

  process.on('unhandledRejection', (err) => {
    logger.error(`Unhandled Rejection: ${err.message}`)
    server.close(() => process.exit(1))
  })

  process.on('uncaughtException', (err) => {
    logger.error(`Uncaught Exception: ${err.message}`)
    process.exit(1)
  })
})

module.exports = app
