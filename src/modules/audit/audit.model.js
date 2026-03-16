const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  performedByRole: {
    type: String,
    enum: ['customer', 'provider', 'admin', 'system']
  },
  action: {
    type: String,
    required: true,
    // e.g. 'booking.created', 'payment.confirmed', 'provider.assigned', etc.
  },
  targetModel: String,
  targetId: mongoose.Schema.Types.ObjectId,
  description: { type: String, required: true },
  metadata: mongoose.Schema.Types.Mixed,
  ipAddress: String,
  userAgent: String
}, {
  timestamps: true
});

auditLogSchema.index({ performedBy: 1 });
auditLogSchema.index({ action: 1 });
auditLogSchema.index({ targetModel: 1, targetId: 1 });
auditLogSchema.index({ createdAt: -1 });

const AuditLog = mongoose.model('AuditLog', auditLogSchema);
module.exports = AuditLog;
