const logger = require('../config/logger')

/**
 * Retry wrapper for notification persistence (no Redis).
 */
async function queueNotification(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      await fn()
      return
    } catch (err) {
      if (i === maxRetries - 1) {
        logger.error(`Notification permanently failed: ${err.message}`)
      } else {
        await new Promise((r) => setTimeout(r, 1000 * (i + 1)))
      }
    }
  }
}

module.exports = { queueNotification }
