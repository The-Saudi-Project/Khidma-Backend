/**
 * Standardized API response format
 * All API responses follow this structure for consistency
 */

const sendSuccess = (res, statusCode, message, data = {}, meta = {}) => {
  const response = {
    success: true,
    message,
    data
  };

  if (Object.keys(meta).length > 0) {
    response.meta = meta;
  }

  return res.status(statusCode).json(response);
};

const sendError = (res, statusCode, message, errors = null) => {
  const response = {
    success: false,
    message
  };

  if (errors) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};

/**
 * Pagination helper
 */
const getPaginationMeta = (total, page, limit) => ({
  total,
  page: parseInt(page),
  limit: parseInt(limit),
  pages: Math.ceil(total / limit),
  hasNext: page * limit < total,
  hasPrev: page > 1
});

module.exports = { sendSuccess, sendError, getPaginationMeta };
