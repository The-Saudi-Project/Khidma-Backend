/**
 * Wraps async route handlers to catch errors and pass to Express error handler
 * Eliminates try-catch boilerplate in every controller
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

module.exports = catchAsync;
