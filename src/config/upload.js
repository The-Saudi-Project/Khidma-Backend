const multer = require('multer')
const path = require('path')
const fs = require('fs')
const { v4: uuidv4 } = require('uuid')
const FileType = require('file-type')
const sharp = require('sharp')
const AppError = require('../utils/AppError')
const catchAsync = require('../utils/catchAsync')

const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/payments')
    ensureDir(uploadPath)
    cb(null, uploadPath)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    const uniqueName = `payment_${uuidv4()}${ext}`
    cb(null, uniqueName)
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

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 5 * 1024 * 1024
  },
  fileFilter
})

/**
 * After multer: verify magic bytes, strip non-images, re-encode images with sharp.
 */
const validateAndSanitizeUpload = catchAsync(async (req, res, next) => {
  if (!req.file) return next()

  const filePath = req.file.path
  const ft = await FileType.fromFile(filePath)

  const allowed = ['image/jpeg', 'image/png', 'application/pdf']
  if (!ft || !allowed.includes(ft.mime)) {
    try {
      fs.unlinkSync(filePath)
    } catch (_) {}
    return next(new AppError('Invalid file type.', 400))
  }

  if (ft.mime === 'application/pdf') {
    req.file.mimetype = ft.mime
    return next()
  }

  const dir = path.dirname(filePath)
  const base = path.basename(filePath, path.extname(filePath))
  const sanitizedPath = path.join(dir, `${base}.jpg`)

  await sharp(filePath).jpeg({ quality: 90 }).toFile(sanitizedPath)

  if (sanitizedPath !== filePath) {
    try {
      fs.unlinkSync(filePath)
    } catch (_) {}
  }

  req.file.path = sanitizedPath
  req.file.filename = `${base}.jpg`
  req.file.mimetype = 'image/jpeg'
  req.file.size = fs.statSync(sanitizedPath).size

  next()
})

const serviceImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/services')
    ensureDir(uploadPath)
    cb(null, uploadPath)
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase()
    const uniqueName = `service_${uuidv4()}${ext}`
    cb(null, uniqueName)
  }
})

const serviceImageFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
  const mimetype = /image\/(jpeg|jpg|png|webp)/.test(file.mimetype)

  if (extname && mimetype) {
    return cb(null, true)
  }
  cb(new AppError('Only image files (JPG, PNG, WebP) are allowed', 400), false)
}

const serviceUpload = multer({
  storage: serviceImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: serviceImageFilter
})

module.exports = { upload, serviceUpload, validateAndSanitizeUpload }
