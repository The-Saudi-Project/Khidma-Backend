const logger = require('../config/logger');
const AppError = require('../utils/AppError');

/**
 * Handle Mongoose CastError (invalid ObjectId)
 */
const handleCastErrorDB = (err) => {
  const message = `Invalid ${err.path}: ${err.value}`;
  return new AppError(message, 400);
};

/**
 * Handle Mongoose duplicate key error
 */
const handleDuplicateFieldsDB = (err) => {
  const field = Object.keys(err.keyValue)[0];
  const message = `${field.charAt(0).toUpperCase() + field.slice(1)} already exists. Please use a different value.`;
  return new AppError(message, 409);
};

/**
 * Handle Mongoose validation error
 */
const handleValidationErrorDB = (err) => {
  const errors = Object.values(err.errors).map((el) => el.message);
  const message = `Validation failed: ${errors.join('. ')}`;
  return new AppError(message, 400);
};

/**
 * Handle JWT errors
 */
const handleJWTError = () => new AppError('Invalid token. Please log in again.', 401);
const handleJWTExpiredError = () => new AppError('Token has expired. Please log in again.', 401);

/**
 * Development error response - detailed
 */
const sendErrorDev = (err, res) => {
  res.status(err.statusCode).json({
    success: false,
    status: err.status,
    message: err.message,
    stack: err.stack,
    error: err
  });
};

/**
 * Production error response - sanitized
 */
const sendErrorProd = (err, res) => {
  // Operational errors: safe to send details to client
  if (err.isOperational) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message
    });
  }

  // Programming/unknown errors: don't leak details
  logger.error('CRITICAL ERROR:', err);
  return res.status(500).json({
    success: false,
    message: 'Something went wrong. Please try again later.'
  });
};

/**
 * Global error handling middleware
 */
const errorHandler = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || 'error';

  // Log all errors
  logger.error({
    message: err.message,
    statusCode: err.statusCode,
    path: req.path,
    method: req.method,
    ip: req.ip,
    stack: err.stack
  });

  if (process.env.NODE_ENV === 'development') {
    return sendErrorDev(err, res);
  }

  // Transform known Mongoose/JWT errors to operational AppErrors
  let error = Object.assign(Object.create(Object.getPrototypeOf(err)), err);
  error.message = err.message;

  if (err.name === 'CastError') error = handleCastErrorDB(err);
  if (err.code === 11000) error = handleDuplicateFieldsDB(err);
  if (err.name === 'ValidationError') error = handleValidationErrorDB(err);
  if (err.name === 'JsonWebTokenError') error = handleJWTError();
  if (err.name === 'TokenExpiredError') error = handleJWTExpiredError();

  sendErrorProd(error, res);
};

module.exports = errorHandler;
