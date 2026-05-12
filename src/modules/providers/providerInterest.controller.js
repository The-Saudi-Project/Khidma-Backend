const ProviderInterest = require('./providerInterest.model')
const User = require('../users/users.model')
const { sendSuccess, getPaginationMeta } = require('../../utils/apiResponse')
const catchAsync = require('../../utils/catchAsync')
const AppError = require('../../utils/AppError')
const AuditService = require('../audit/audit.service')

const submitInterest = catchAsync(async (req, res, next) => {
  const { name, email, phone, city, skills, experience } = req.body

  const existing = await ProviderInterest.findOne({
    email: email.toLowerCase().trim(),
    status: 'pending'
  })
  if (existing) {
    return next(new AppError('You already have a pending application.', 409))
  }

  const doc = await ProviderInterest.create({
    name: name.trim(),
    email: email.toLowerCase().trim(),
    phone: phone.trim(),
    city: city.trim(),
    skills: Array.isArray(skills) ? skills : [],
    experience: experience || ''
  })

  return sendSuccess(res, 201, 'Application submitted successfully.', { application: doc })
})

const listApplications = catchAsync(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query
  const filter = {}
  if (status) filter.status = status

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10)
  const [applications, total] = await Promise.all([
    ProviderInterest.find(filter).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)),
    ProviderInterest.countDocuments(filter)
  ])

  return sendSuccess(res, 200, 'Applications retrieved.', { applications }, getPaginationMeta(total, page, limit))
})

const approveApplication = catchAsync(async (req, res, next) => {
  const { password } = req.body
  if (!password || password.length < 8) {
    return next(new AppError('A temporary password (min 8 chars) is required for approval.', 400))
  }

  const appDoc = await ProviderInterest.findById(req.params.id)
  if (!appDoc) return next(new AppError('Application not found.', 404))
  if (appDoc.status !== 'pending') {
    return next(new AppError('Application is not pending.', 400))
  }

  const emailTaken = await User.findOne({ email: appDoc.email })
  if (emailTaken) {
    return next(new AppError('A user with this email already exists.', 409))
  }

  const provider = await User.create({
    name: appDoc.name,
    email: appDoc.email,
    password,
    phone: appDoc.phone,
    role: 'provider',
    mustChangePassword: true,
    providerProfile: {
      skills: appDoc.skills || [],
      serviceCity: appDoc.city,
      isAvailable: true
    }
  })

  appDoc.status = 'approved'
  appDoc.reviewedBy = req.user._id
  appDoc.reviewedAt = new Date()
  appDoc.createdUserId = provider._id
  await appDoc.save()

  await AuditService.log({
    userId: req.user._id,
    userRole: 'admin',
    action: 'provider_interest.approved',
    targetModel: 'ProviderInterest',
    targetId: appDoc._id,
    description: `Provider application approved for ${appDoc.email}`,
    req
  })

  return sendSuccess(res, 200, 'Application approved. Provider account created.', {
    application: appDoc,
    temporaryPassword: password
  })
})

const rejectApplication = catchAsync(async (req, res, next) => {
  const { reason } = req.body
  const appDoc = await ProviderInterest.findById(req.params.id)
  if (!appDoc) return next(new AppError('Application not found.', 404))
  if (appDoc.status !== 'pending') {
    return next(new AppError('Application is not pending.', 400))
  }

  appDoc.status = 'rejected'
  appDoc.reviewedBy = req.user._id
  appDoc.reviewedAt = new Date()
  appDoc.rejectionReason = reason || ''
  await appDoc.save()

  await AuditService.log({
    userId: req.user._id,
    userRole: 'admin',
    action: 'provider_interest.rejected',
    targetModel: 'ProviderInterest',
    targetId: appDoc._id,
    description: `Provider application rejected for ${appDoc.email}`,
    req
  })

  return sendSuccess(res, 200, 'Application rejected.', { application: appDoc })
})

module.exports = {
  submitInterest,
  listApplications,
  approveApplication,
  rejectApplication
}
