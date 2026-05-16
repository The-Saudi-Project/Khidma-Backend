const multer = require('multer')
const { v2: cloudinary } = require('cloudinary')
const { CloudinaryStorage } = require('multer-storage-cloudinary')
const path = require('path')
const AppError = require('../utils/AppError')
const catchAsync = require('../utils/catchAsync')

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
})

// Storage for Payment Proofs
const paymentStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'khidma/payments',
    allowed_formats: ['jpg', 'png', 'jpeg', 'pdf'],
    public_id: (req, file) => `payment_${Date.now()}`
  }
})

// Storage for Services Images
const serviceStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'khidma/services',
    allowed_formats: ['jpg', 'png', 'jpeg', 'webp'],
    public_id: (req, file) => `service_${Date.now()}`
  }
})

const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf/
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
  const mimetype = allowedTypes.test(file.mimetype)

  if (extname && mimetype) {
    return cb(null, true)
  }
  cb(new AppError('Only images (JPG, PNG) and PDF files are allowed', 400), false)
}

const serviceImageFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
  const mimetype = /image\/(jpeg|jpg|png|webp)/.test(file.mimetype)

  if (extname && mimetype) {
    return cb(null, true)
  }
  cb(new AppError('Only image files (JPG, PNG, WebP) are allowed', 400), false)
}

const upload = multer({
  storage: paymentStorage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024
  },
  fileFilter
})

const serviceUpload = multer({
  storage: serviceStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: serviceImageFilter
})

// Validate and sanitize - just passthrough now since Cloudinary handles it
const validateAndSanitizeUpload = catchAsync(async (req, res, next) => {
  if (!req.file) return next()
  // Cloudinary URL is in req.file.path
  next()
})

module.exports = { upload, serviceUpload, validateAndSanitizeUpload }
