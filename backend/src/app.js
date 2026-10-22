const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config');
const routes = require('./routes');
const notFoundHandler = require('./middlewares/notFoundHandler');
const errorHandler = require('./middlewares/errorHandler');

const app = express();

// 1. Security & request processing middlewares
app.use(helmet());
app.use(cors({ origin: config.corsOrigin }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 2. HTTP request logger
if (config.env !== 'test') {
  app.use(morgan('dev'));
}

// 3. Root welcome endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'Vedanjay Power - Outbound Lead Discovery API',
    version: '1.0.0',
    documentation: `${config.apiPrefix}/health`,
  });
});

// 4. Mount API Routes under configured prefix (e.g., /api/v1)
app.use(config.apiPrefix, routes);

// 5. Unhandled routes handler (404)
app.use(notFoundHandler);

// 6. Central error handling middleware
app.use(errorHandler);

module.exports = app;
