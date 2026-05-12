const crypto = require('crypto')
const AuditLog = require('./audit.model')
const logger = require('../../config/logger')

const AuditService = {
  async log({ userId, userRole, action, targetModel, targetId, description, metadata = {}, req = null }) {
    try {
      const prevLog = await AuditLog.findOne().sort({ createdAt: -1 }).select('chainHash').lean()

      const performedBy = userId
      const timestamp = new Date()
      const content = JSON.stringify({
        action,
        description,
        metadata,
        performedBy,
        timestamp: timestamp.toISOString()
      })
      const chainHash = crypto
        .createHash('sha256')
        .update((prevLog && prevLog.chainHash) || 'genesis')
        .update(content)
        .digest('hex')

      await AuditLog.create({
        performedBy: userId,
        performedByRole: userRole,
        action,
        targetModel,
        targetId,
        description,
        metadata,
        chainHash,
        ipAddress: req ? (req.ip || req.headers['x-forwarded-for']) : null,
        userAgent: req ? req.headers['user-agent'] : null
      })
    } catch (err) {
      logger.error(`Audit log failed: ${err.message}`)
    }
  }
}

module.exports = AuditService
