const app = require('./app');
const config = require('./config');

const db = require('./db');

const server = app.listen(config.port, async () => {
  console.log(`====================================================`);
  console.log(` Vedanjay Power Lead Management Backend`);
  console.log(` Environment : ${config.env}`);
  console.log(` Server Port : ${config.port}`);
  console.log(` Health URL  : http://localhost:${config.port}${config.apiPrefix}/health`);
  console.log(`====================================================`);

  // Attempt database connection and schema verification
  await db.initDb();

  // Initialize Outbound collection scheduler (node-cron)
  const { initScheduler } = require('./services/scheduler.service');
  initScheduler();
});

// Handle graceful shutdown
const handleShutdown = (signal) => {
  console.log(`\nReceived ${signal}. Shutting down gracefully...`);
  server.close(() => {
    console.log('HTTP server closed. Exiting process.');
    process.exit(0);
  });

  // Force close after 10 seconds if hanging connections persist
  setTimeout(() => {
    console.error('Forcefully terminating process after timeout.');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => handleShutdown('SIGTERM'));
process.on('SIGINT', () => handleShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception thrown:', err);
  process.exit(1);
});
