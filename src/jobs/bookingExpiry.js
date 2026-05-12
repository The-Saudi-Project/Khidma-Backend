const Booking = require('../modules/bookings/bookings.model')
const logger = require('../config/logger')

function startExpiryScheduler() {
  const intervalMs = 5 * 60 * 1000

  setInterval(async () => {
    try {
      const now = new Date()
      const expired = await Booking.find({
        status: 'pending_payment',
        paymentDeadline: { $lt: now }
      })

      let n = 0
      for (const booking of expired) {
        booking.status = 'expired'
        booking.addTimelineEvent(
          'expired',
          'Booking expired — payment not received before deadline.',
          null,
          'system'
        )
        await booking.save()
        n++
      }
      if (n > 0) {
        logger.info(`Booking expiry run: marked ${n} booking(s) expired`)
      }
    } catch (err) {
      logger.error(`Booking expiry scheduler error: ${err.message}`)
    }
  }, intervalMs)

  logger.info('Booking expiry scheduler started (5m interval)')
}

module.exports = { startExpiryScheduler }
