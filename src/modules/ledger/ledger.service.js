const mongoose = require('mongoose')
const LedgerEntry = require('./ledger.model')
const User = require('../users/users.model')

const round2 = (x) => Math.round(x * 100) / 100

/**
 * Record provider earning + platform commission after job completion (idempotent per booking).
 */
async function recordJobCompletion(booking) {
  const bookingId = booking._id
  const existing = await LedgerEntry.findOne({
    bookingId,
    party: 'provider',
    type: 'credit',
    description: { $regex: /^Job completion earning/ }
  })
  if (existing) return

  const providerId = booking.provider
  if (!providerId) return

  const platformUser = await User.findOne({ role: 'admin' }).sort({ createdAt: 1 }).select('_id').lean()
  if (!platformUser) return

  const pe = round2(booking.providerEarning || 0)
  const pc = round2(booking.platformCommission || 0)

  await LedgerEntry.create([
    {
      type: 'credit',
      party: 'provider',
      partyId: providerId,
      bookingId,
      amount: pe,
      description: `Job completion earning for booking ${booking.bookingNumber}`
    },
    {
      type: 'credit',
      party: 'platform',
      partyId: platformUser._id,
      bookingId,
      amount: pc,
      description: `Platform commission for booking ${booking.bookingNumber}`
    }
  ])
}

/**
 * Record payout as provider debit.
 */
async function recordPayout(payout) {
  const existing = await LedgerEntry.findOne({ payoutId: payout._id, type: 'debit' })
  if (existing) return

  await LedgerEntry.create({
    type: 'debit',
    party: 'provider',
    partyId: payout.provider,
    payoutId: payout._id,
    amount: round2(payout.amount),
    description: `Payout processed`
  })
}

async function getProviderBalance(providerId) {
  const pid = new mongoose.Types.ObjectId(providerId)
  const agg = await LedgerEntry.aggregate([
    { $match: { party: 'provider', partyId: pid } },
    {
      $group: {
        _id: null,
        credits: { $sum: { $cond: [{ $eq: ['$type', 'credit'] }, '$amount', 0] } },
        debits: { $sum: { $cond: [{ $eq: ['$type', 'debit'] }, '$amount', 0] } }
      }
    }
  ])
  const row = agg[0] || { credits: 0, debits: 0 }
  return round2((row.credits || 0) - (row.debits || 0))
}

async function getPlatformBalance() {
  const agg = await LedgerEntry.aggregate([
    { $match: { party: 'platform' } },
    {
      $group: {
        _id: null,
        credits: { $sum: { $cond: [{ $eq: ['$type', 'credit'] }, '$amount', 0] } },
        debits: { $sum: { $cond: [{ $eq: ['$type', 'debit'] }, '$amount', 0] } }
      }
    }
  ])
  const row = agg[0] || { credits: 0, debits: 0 }
  return round2((row.credits || 0) - (row.debits || 0))
}

module.exports = {
  recordJobCompletion,
  recordPayout,
  getProviderBalance,
  getPlatformBalance
}
