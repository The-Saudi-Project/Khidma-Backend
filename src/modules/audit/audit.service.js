const AuditLog = require('./audit.model');
const logger = require('../../config/logger');

const AuditService = {
  async log({ userId, userRole, action, targetModel, targetId, description, metadata = {}, req = null }) {
    try {
      await AuditLog.create({
        performedBy: userId,
        performedByRole: userRole,
        action,
        targetModel,
        targetId,
        description,
        metadata,
        ipAddress: req ? (req.ip || req.headers['x-forwarded-for']) : null,
        userAgent: req ? req.headers['user-agent'] : null
      });
    } catch (err) {
      logger.error(`Audit log failed: ${err.message}`);
    }
  }
};

module.exports = AuditService;
