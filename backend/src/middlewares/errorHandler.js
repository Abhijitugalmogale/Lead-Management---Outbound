/**
 * Centralized Error Handling Middleware
 * Catches unhandled errors and returns standardized JSON responses
 */
const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || 500;
  const isProduction = process.env.NODE_ENV === 'production';

  console.error(`[ERROR] ${new Date().toISOString()} - ${req.method} ${req.originalUrl}:`, err);

  res.status(statusCode).json({
    status: 'error',
    error: {
      code: err.code || 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected internal server error occurred.',
      ...(isProduction ? {} : { stack: err.stack }),
    },
  });
};

module.exports = errorHandler;
