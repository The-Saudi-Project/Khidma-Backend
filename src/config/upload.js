const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const AppError = require('../utils/AppError');

// Ensure upload directories exist
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/payments');
    ensureDir(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `payment_${uuidv4()}${ext}`;
    cb(null, uniqueName);
  }
});

// File filter - only images
const fileFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  }
  cb(new AppError('Only images (JPG, PNG) and PDF files are allowed', 400), false);
};

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 5 * 1024 * 1024 // 5MB
  },
  fileFilter
});

// Service image storage
const serviceImageStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../uploads/services');
    ensureDir(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `service_${uuidv4()}${ext}`;
    cb(null, uniqueName);
  }
});

const serviceImageFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = /image\/(jpeg|jpg|png|webp)/.test(file.mimetype);

  if (extname && mimetype) {
    return cb(null, true);
  }
  cb(new AppError('Only image files (JPG, PNG, WebP) are allowed', 400), false);
};

const serviceUpload = multer({
  storage: serviceImageStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: serviceImageFilter
});

module.exports = { upload, serviceUpload };
