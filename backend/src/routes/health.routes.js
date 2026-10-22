const express = require('express');
const { checkHealth } = require('../controllers/health.controller');

const router = express.Router();

/**
 * @route   GET /api/v1/health
 * @desc    Get API health status, uptime, and system diagnostics
 * @access  Public
 */
router.get('/health', checkHealth);

module.exports = router;
