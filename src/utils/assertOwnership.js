const AppError = require('./AppError')

const ownerId = (resource, field) => {
  const v = resource[field]
  if (v == null) return null
  if (typeof v === 'object' && v._id) return v._id.toString()
  return v.toString()
}

/**
 * @param {object} resource - Mongoose doc or plain object
 * @param {import('mongoose').Types.ObjectId|string} userId
 * @param {string} field - field holding owner ObjectId
 */
const assertOwnership = (resource, userId, field = 'customer') => {
  const oid = ownerId(resource, field)
  if (!oid || oid !== userId.toString()) {
    throw new AppError('Access denied.', 403)
  }
}

const assertRole = (user, ...roles) => {
  if (!user || !roles.includes(user.role)) {
    throw new AppError('Access denied.', 403)
  }
}

/**
 * Booking read access: admin all; customer owns; provider only if assigned.
 */
const assertBookingAccess = (booking, user) => {
  if (user.role === 'admin') return
  if (user.role === 'customer') {
    assertOwnership(booking, user._id, 'customer')
    return
  }
  if (user.role === 'provider') {
    const pid = booking.provider?._id ?? booking.provider
    if (!pid || pid.toString() !== user._id.toString()) {
      throw new AppError('Access denied.', 403)
    }
    return
  }
  throw new AppError('Access denied.', 403)
}

module.exports = { assertOwnership, assertRole, assertBookingAccess }
