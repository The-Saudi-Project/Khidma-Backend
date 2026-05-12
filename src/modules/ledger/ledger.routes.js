const express = require('express')
const router = express.Router()
const ctrl = require('./ledger.controller')
const { protect, restrictTo } = require('../../middleware/auth')

router.use(protect)

router.get('/provider', restrictTo('provider'), ctrl.getProviderLedgerSummary)
router.get('/platform', restrictTo('admin'), ctrl.getPlatformLedgerSummary)
router.get('/entries', restrictTo('admin'), ctrl.getLedgerEntries)

module.exports = router
