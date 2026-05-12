const User = require('../modules/users/users.model')
const RevokedAccessJti = require('../modules/auth/revokedAccessJti.model')
const { verifyAccessToken } = require('../utils/jwt')
const AppError = require('../utils/AppError')
const catchAsync = require('../utils/catchAsync')

/**
 * Protect routes - verifies JWT and attaches user to request.
 * SSE: pass access_token query param when Authorization header is unavailable.
 */
const protect = catchAsync(async (req, res, next) => {
  let token
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1]
  } else if (req.query && req.query.access_token) {
    token = req.query.access_token
  }

  if (!token) {
    return next(new AppError('Authentication required. Please log in.', 401))
  }

  const decoded = verifyAccessToken(token)

  const currentUser = await User.findById(decoded.id).select('+passwordChangedAt +accessTokenVersion')
  if (!currentUser) {
    return next(new AppError('User no longer exists.', 401))
  }

  if (!currentUser.isActive) {
    return next(new AppError('Your account has been deactivated. Please contact support.', 403))
  }

  const tokenTv = decoded.tv != null ? decoded.tv : 0
  const userTv = currentUser.accessTokenVersion != null ? currentUser.accessTokenVersion : 0
  if (tokenTv !== userTv) {
    return next(new AppError('Session invalidated. Please log in again.', 401))
  }

  if (decoded.jti) {
    const revoked = await RevokedAccessJti.findOne({ jti: decoded.jti }).lean()
    if (revoked) {
      return next(new AppError('Session invalidated. Please log in again.', 401))
    }
  }

  if (currentUser.changedPasswordAfter && currentUser.changedPasswordAfter(decoded.iat)) {
    return next(new AppError('Password was recently changed. Please log in again.', 401))
  }

  req.user = currentUser
  next()
})

const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action.', 403))
    }
    next()
  }
}

const optionalAuth = catchAsync(async (req, res, next) => {
  let token
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1]
  } else if (req.query && req.query.access_token) {
    token = req.query.access_token
  }

  if (token) {
    try {
      const decoded = verifyAccessToken(token)
      const user = await User.findById(decoded.id).select('+accessTokenVersion')
      if (user && user.isActive) {
        const tokenTv = decoded.tv != null ? decoded.tv : 0
        const userTv = user.accessTokenVersion != null ? user.accessTokenVersion : 0
        if (tokenTv !== userTv) return next()
        if (decoded.jti) {
          const revoked = await RevokedAccessJti.findOne({ jti: decoded.jti }).lean()
          if (revoked) return next()
        }
        req.user = user
      }
    } catch {
      // Token invalid, continue as unauthenticated
    }
  }
  next()
})

module.exports = { protect, restrictTo, optionalAuth }
