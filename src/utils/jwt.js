const crypto = require('crypto')
const jwt = require('jsonwebtoken')
const AppError = require('./AppError')
const RefreshToken = require('../modules/auth/refreshToken.model')
const RevokedAccessJti = require('../modules/auth/revokedAccessJti.model')
const User = require('../modules/users/users.model')

const hashToken = (raw) => crypto.createHash('sha256').update(raw).digest('hex')

/**
 * Build token payload from user object (base fields only)
 */
const buildTokenPayload = (user) => ({
  id: user._id.toString(),
  role: user.role,
  email: user.email
})

/**
 * Generate access token (short-lived, includes jti + tv for revocation)
 */
const generateAccessToken = (user) => {
  const jti = crypto.randomBytes(16).toString('hex')
  const tv = user.accessTokenVersion != null ? user.accessTokenVersion : 0
  const payload = { ...buildTokenPayload(user), jti, tv }
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '15m',
    issuer: 'khidma-platform',
    audience: 'khidma-users'
  })
}

/**
 * Persist refresh token hash; returns raw JWT string
 */
const generateRefreshToken = async (payload, req) => {
  const raw = jwt.sign(payload, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d',
    issuer: 'khidma-platform',
    audience: 'khidma-users'
  })
  const decoded = jwt.decode(raw)
  const expiresAt = new Date(decoded.exp * 1000)
  const tokenHash = hashToken(raw)
  const userAgent = req?.headers?.['user-agent'] || ''
  const ipAddress = req?.ip || req?.headers?.['x-forwarded-for'] || ''
  await RefreshToken.create({
    tokenHash,
    userId: payload.id,
    expiresAt,
    userAgent: String(userAgent).slice(0, 500),
    ipAddress: String(ipAddress).slice(0, 100)
  })
  return raw
}

/**
 * Rotate refresh token; returns { accessToken, refreshToken }
 */
const verifyAndRotateRefreshToken = async (rawToken, req) => {
  let decoded
  try {
    decoded = jwt.verify(rawToken, process.env.JWT_REFRESH_SECRET, {
      issuer: 'khidma-platform',
      audience: 'khidma-users'
    })
  } catch {
    throw new AppError('Invalid or expired refresh token.', 401)
  }

  const tokenHash = hashToken(rawToken)
  const doc = await RefreshToken.findOne({ tokenHash, isRevoked: false })
  if (!doc || doc.expiresAt < new Date()) {
    throw new AppError('Invalid or expired refresh token.', 401)
  }

  const user = await User.findById(decoded.id).select('+passwordChangedAt +accessTokenVersion')
  if (!user || !user.isActive) {
    throw new AppError('User not found or inactive.', 401)
  }

  doc.isRevoked = true
  await doc.save()

  const payload = buildTokenPayload(user)
  const accessToken = generateAccessToken(user)
  const refreshToken = await generateRefreshToken(payload, req)
  return { accessToken, refreshToken, user }
}

/**
 * Revoke all refresh tokens for user and invalidate all access tokens (tv bump)
 */
const revokeAllUserTokens = async (userId) => {
  await RefreshToken.updateMany(
    { userId, isRevoked: false },
    { $set: { isRevoked: true } }
  )
  await User.findByIdAndUpdate(userId, { $inc: { accessTokenVersion: 1 } })
}

/**
 * Record a single access token jti as revoked (e.g. explicit logout of current session)
 */
const revokeAccessJti = async (jti, expiresAt) => {
  if (!jti) return
  try {
    await RevokedAccessJti.create({ jti, expiresAt })
  } catch {
    // duplicate jti — ignore
  }
}

/**
 * Verify access token
 */
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET, {
      issuer: 'khidma-platform',
      audience: 'khidma-users'
    })
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new AppError('Token has expired. Please log in again.', 401)
    }
    if (error.name === 'JsonWebTokenError') {
      throw new AppError('Invalid token. Please log in again.', 401)
    }
    throw new AppError('Token verification failed.', 401)
  }
}

/**
 * Legacy verify (used only if needed elsewhere)
 */
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_REFRESH_SECRET, {
      issuer: 'khidma-platform',
      audience: 'khidma-users'
    })
  } catch {
    throw new AppError('Invalid or expired refresh token.', 401)
  }
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  verifyAndRotateRefreshToken,
  revokeAllUserTokens,
  revokeAccessJti,
  buildTokenPayload,
  hashToken
}
