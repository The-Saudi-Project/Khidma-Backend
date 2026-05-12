const LedgerEntry = require('./ledger.model')
const LedgerService = require('./ledger.service')
const { sendSuccess, getPaginationMeta } = require('../../utils/apiResponse')
const catchAsync = require('../../utils/catchAsync')

const getProviderLedgerSummary = catchAsync(async (req, res) => {
  const balance = await LedgerService.getProviderBalance(req.user._id)
  return sendSuccess(res, 200, 'Balance retrieved.', { balance })
})

const getPlatformLedgerSummary = catchAsync(async (req, res) => {
  const balance = await LedgerService.getPlatformBalance()
  return sendSuccess(res, 200, 'Platform balance retrieved.', { balance })
})

const getLedgerEntries = catchAsync(async (req, res) => {
  const { page = 1, limit = 50 } = req.query
  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10)

  const [entries, total] = await Promise.all([
    LedgerEntry.find()
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit, 10))
      .populate('partyId', 'name email role')
      .populate('bookingId', 'bookingNumber')
      .populate('payoutId', 'amount status'),
    LedgerEntry.countDocuments()
  ])

  return sendSuccess(res, 200, 'Ledger entries retrieved.', { entries }, getPaginationMeta(total, page, limit))
})

module.exports = {
  getProviderLedgerSummary,
  getPlatformLedgerSummary,
  getLedgerEntries
}
