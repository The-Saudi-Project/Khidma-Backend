const Notification = require('./notifications.model')
const { queueNotification } = require('../../jobs/notificationQueue')

const NotificationService = {
  async create({ recipientId, type, title, message, refModel = null, refId = null, actionUrl = null }) {
    return queueNotification(async () => {
      await Notification.create({
        recipient: recipientId,
        type,
        title,
        message,
        refModel,
        refId,
        actionUrl
      })
    })
  },

  async bookingCreated(booking, customerId) {
    return this.create({
      recipientId: customerId,
      type: 'booking_created',
      title: 'Booking Confirmed',
      message: `Your booking for ${booking.serviceName} (#${booking.bookingNumber}) has been created. Please upload payment proof to proceed.`,
      refModel: 'Booking',
      refId: booking._id,
      actionUrl: `/bookings/${booking._id}`
    })
  },

  async paymentUploaded(booking, adminId) {
    return this.create({
      recipientId: adminId,
      type: 'payment_uploaded',
      title: 'Payment Proof Received',
      message: `Payment proof uploaded for booking #${booking.bookingNumber} (${booking.serviceName}). Review required.`,
      refModel: 'Booking',
      refId: booking._id,
      actionUrl: `/admin/bookings/${booking._id}`
    })
  },

  async paymentConfirmed(booking, customerId) {
    return this.create({
      recipientId: customerId,
      type: 'payment_confirmed',
      title: 'Payment Confirmed ✓',
      message: `Your payment for booking #${booking.bookingNumber} has been confirmed. A provider will be assigned shortly.`,
      refModel: 'Booking',
      refId: booking._id,
      actionUrl: `/bookings/${booking._id}`
    })
  },

  async providerAssigned(booking, providerId, customerId) {
    const providerNotif = this.create({
      recipientId: providerId,
      type: 'provider_assigned',
      title: 'New Job Assigned',
      message: `You have been assigned to booking #${booking.bookingNumber} for ${booking.serviceName} on ${new Date(booking.scheduledDate).toLocaleDateString()}.`,
      refModel: 'Booking',
      refId: booking._id,
      actionUrl: `/provider/jobs/${booking._id}`
    })

    const customerNotif = this.create({
      recipientId: customerId,
      type: 'provider_assigned',
      title: 'Provider Assigned',
      message: `A provider has been assigned to your booking #${booking.bookingNumber}. They will arrive on your scheduled date.`,
      refModel: 'Booking',
      refId: booking._id,
      actionUrl: `/bookings/${booking._id}`
    })

    return Promise.all([providerNotif, customerNotif])
  },

  async providerAccepted(booking, customerId) {
    return this.create({
      recipientId: customerId,
      type: 'provider_accepted',
      title: 'Provider Accepted',
      message: `Your provider has accepted booking #${booking.bookingNumber} and will arrive as scheduled.`,
      refModel: 'Booking',
      refId: booking._id,
      actionUrl: `/bookings/${booking._id}`
    })
  },

  async jobStarted(booking, customerId) {
    return this.create({
      recipientId: customerId,
      type: 'job_started',
      title: 'Service Has Started',
      message: `Your service for booking #${booking.bookingNumber} has started.`,
      refModel: 'Booking',
      refId: booking._id,
      actionUrl: `/bookings/${booking._id}`
    })
  },

  async jobCompleted(booking, customerId) {
    return this.create({
      recipientId: customerId,
      type: 'job_completed',
      title: 'Service Completed ✓',
      message: `Your booking #${booking.bookingNumber} for ${booking.serviceName} has been completed. We hope you're satisfied!`,
      refModel: 'Booking',
      refId: booking._id,
      actionUrl: `/bookings/${booking._id}`
    })
  },

  async bookingCancelled(booking, recipientId, reason) {
    return this.create({
      recipientId,
      type: 'booking_cancelled',
      title: 'Booking Cancelled',
      message: `Booking #${booking.bookingNumber} has been cancelled. ${reason ? `Reason: ${reason}` : ''}`,
      refModel: 'Booking',
      refId: booking._id,
      actionUrl: `/bookings/${booking._id}`
    })
  },

  async payoutProcessed(payout, providerId) {
    return this.create({
      recipientId: providerId,
      type: 'payout_processed',
      title: 'Payout Processed',
      message: `A payout of SAR ${payout.amount.toFixed(2)} has been processed to your account.`,
      refModel: 'Payout',
      refId: payout._id,
      actionUrl: `/provider/payouts`
    })
  },

  async supportReply(ticket, recipientId) {
    return this.create({
      recipientId,
      type: 'support_reply',
      title: 'New Reply on Your Ticket',
      message: `There is a new reply on your support ticket #${ticket.ticketNumber}.`,
      refModel: 'SupportTicket',
      refId: ticket._id,
      actionUrl: `/support/${ticket._id}`
    })
  }
}

module.exports = NotificationService
