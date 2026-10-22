const express = require('express');
const { uploadAndProcessFile } = require('../controllers/upload.controller');
const { authenticate, authorize } = require('../middlewares/auth');

const router = express.Router();

router.use(authenticate);

/**
 * @route   POST /api/v1/outbound/upload
 * @desc    Upload CSV or PDF file to extract renewable energy projects
 * @access  Private (Admin, Management, Research Analyst)
 */
router.post('/upload', authorize('admin', 'management', 'research_analyst'), uploadAndProcessFile);

module.exports = router;
