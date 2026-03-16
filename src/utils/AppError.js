/**
 * Custom operational error class
 * Distinguishes operational errors (predictable) from programming errors
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;

    // Capture stack trace excluding this constructor
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
