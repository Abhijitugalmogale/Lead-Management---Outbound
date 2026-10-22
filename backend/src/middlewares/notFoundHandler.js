/**
 * 404 Not Found Middleware
 * Handles all requests targeting unregistered endpoints
 */
const notFoundHandler = (req, res, next) => {
  res.status(404).json({
    status: 'error',
    error: {
      code: 'RESOURCE_NOT_FOUND',
      message: `The requested endpoint '${req.method} ${req.originalUrl}' does not exist on this server.`,
    },
  });
};

module.exports = notFoundHandler;
