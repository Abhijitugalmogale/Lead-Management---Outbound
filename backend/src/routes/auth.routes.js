const express = require('express');
const { login, register, getMe } = require('../controllers/auth.controller');
const { authenticate, authorize } = require('../middlewares/auth');

const router = express.Router();

/**
 * @route   POST /api/v1/auth/login
 * @desc    Authenticate user and get JWT token
 * @access  Public
 */
router.post('/login', login);

/**
 * @route   POST /api/v1/auth/register
 * @desc    Create new user account (Admin only)
 * @access  Private (Admin)
 */
router.post('/register', authenticate, authorize('admin'), register);

/**
 * @route   GET /api/v1/auth/me
 * @desc    Get currently logged in user profile
 * @access  Private
 */
router.get('/me', authenticate, getMe);

module.exports = router;
