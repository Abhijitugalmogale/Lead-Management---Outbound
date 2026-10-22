const express = require('express');
const { submitEnquiry, listEnquiries } = require('../controllers/enquiry.controller');
const { authenticate, authorize } = require('../middlewares/auth');

const router = express.Router();

/**
 * @route   POST /api/v1/enquiries
 * @desc    Public endpoint for website and campaign lead capture forms
 * @access  Public
 */
router.post('/', submitEnquiry);

/**
 * @route   GET /api/v1/enquiries
 * @desc    View list of marketing enquiries with UTM tracking data
 * @access  Private (Marketing, Management, Admin, Sales Manager)
 */
router.get('/', authenticate, authorize('admin', 'management', 'marketing', 'sales_manager'), listEnquiries);

module.exports = router;
