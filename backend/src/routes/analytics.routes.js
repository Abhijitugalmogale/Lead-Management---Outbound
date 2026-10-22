const express = require('express');
const { getOverview } = require('../controllers/analytics.controller');
const { authenticate, authorize } = require('../middlewares/auth');

const router = express.Router();

router.use(authenticate);

/**
 * @route   GET /api/v1/analytics/overview
 * @desc    Get dashboard metrics, funnel stage stats, and marketing attribution
 * @access  Private (Admin, Management, Sales Manager, Marketing)
 */
router.get('/overview', authorize('admin', 'management', 'sales_manager', 'marketing'), getOverview);

module.exports = router;
