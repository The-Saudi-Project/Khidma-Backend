const { validationResult } = require('express-validator');
const { sendError } = require('../utils/apiResponse');

/**
 * Middleware to check express-validator results
 * Place after validation chains in route definitions
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formattedErrors = errors.array().map((err) => ({
      field: err.path,
      message: err.msg
    }));
    return sendError(res, 422, 'Validation failed', formattedErrors);
  }
  next();
};

module.exports = validate;
