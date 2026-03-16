const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  senderRole: { type: String, enum: ['customer', 'provider', 'admin'] },
  content: { type: String, required: true, maxlength: 5000 },
  attachments: [String]
}, { timestamps: true });

const supportTicketSchema = new mongoose.Schema({
  ticketNumber: {
    type: String,
    unique: true,
    required: true
  },
  submittedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  submittedByRole: {
    type: String,
    enum: ['customer', 'provider']
  },
  subject: {
    type: String,
    required: true,
    maxlength: 200,
    trim: true
  },
  category: {
    type: String,
    enum: ['booking_issue', 'payment_issue', 'provider_issue', 'account_issue', 'other'],
    default: 'other'
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium'
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'],
    default: 'open'
  },
  relatedBooking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    default: null
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  messages: [messageSchema],
  resolvedAt: Date,
  closedAt: Date
}, { timestamps: true });

supportTicketSchema.pre('validate', function (next) {
  if (!this.ticketNumber) {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).substring(2, 5).toUpperCase();
    this.ticketNumber = `TKT-${ts}-${rand}`;
  }
  next();
});

supportTicketSchema.index({ submittedBy: 1, status: 1 });
supportTicketSchema.index({ status: 1 });

const SupportTicket = mongoose.model('SupportTicket', supportTicketSchema);
module.exports = SupportTicket;
