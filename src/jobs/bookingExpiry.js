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

      if (expired.length > 0) {
        const ids = expired.map(b => b._id)
        
        await Booking.updateMany(
          { _id: { $in: ids } },
          { 
            $set: { status: 'expired' },
            $push: {
              timeline: {
                status: 'expired',
                description: 'Booking expired — payment not received before deadline.',
                timestamp: now,
                actorModel: 'system'
              }
            }
          }
        )
        logger.info(`Booking expiry run: marked ${expired.length} booking(s) expired`)
      }
    } catch (err) {
      logger.error(`Booking expiry scheduler error: ${err.message}`)
    }
  }, intervalMs)

  logger.info('Booking expiry scheduler started (5m interval)')
}

module.exports = { startExpiryScheduler }
