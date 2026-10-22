/**
 * Health Controller
 * Provides system diagnostics and status checks
 */
const checkHealth = (req, res) => {
  const healthData = {
    status: 'ok',
    service: 'Vedanjay Power - Outbound Lead Discovery API',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    nodeVersion: process.version,
    memoryUsageMB: {
      rss: Math.round(process.memoryUsage().rss / 1024 / 1024),
      heapTotal: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
      heapUsed: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    },
  };

  return res.status(200).json(healthData);
};

module.exports = {
  checkHealth,
};
