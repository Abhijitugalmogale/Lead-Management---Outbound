const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../db');

/**
 * Normalizes user object for response (removes password_hash)
 */
const sanitizeUser = (user) => {
  const { password_hash, ...safeUser } = user;
  return safeUser;
};

/**
 * POST /api/v1/auth/login
 */
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Validation error', message: 'Email and password are required' });
    }

    // If DB is connected, query PostgreSQL. Otherwise, provide admin dev fallback
    let user = null;
    if (db.isConnected) {
      const result = await db.query('SELECT * FROM app_user WHERE email = $1 AND is_active = TRUE', [email.toLowerCase().trim()]);
      user = result.rows[0];
    } else {
      // Dev mode fallback when PostgreSQL is not running
      if (email.toLowerCase().trim() === 'admin@vedanjaypower.com' && password === 'Password@123') {
        user = {
          user_id: '11111111-1111-1111-1111-111111111111',
          full_name: 'Vedanjay System Admin',
          email: 'admin@vedanjaypower.com',
          role: 'admin',
          is_active: true,
        };
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Authentication failed', message: 'Invalid credentials or inactive account' });
    }

    // Verify password if DB user with hash
    if (user.password_hash) {
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        return res.status(401).json({ error: 'Authentication failed', message: 'Invalid credentials' });
      }
    }

    // Sign JWT
    const token = jwt.sign(
      {
        user_id: user.user_id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    return res.status(200).json({
      message: 'Login successful',
      token,
      user: sanitizeUser(user),
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/v1/auth/register
 */
const register = async (req, res, next) => {
  try {
    const { full_name, email, password, role } = req.body;
    if (!full_name || !email || !password || !role) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'full_name, email, password, and role are required',
      });
    }

    const validRoles = ['admin', 'management', 'sales_manager', 'salesperson', 'marketing', 'technical', 'research_analyst'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: 'Validation error', message: `Role must be one of: ${validRoles.join(', ')}` });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    if (db.isConnected) {
      const result = await db.query(
        `INSERT INTO app_user (full_name, email, password_hash, role, is_active)
         VALUES ($1, $2, $3, $4, TRUE)
         RETURNING user_id, full_name, email, role, is_active, created_at`,
        [full_name.trim(), email.toLowerCase().trim(), passwordHash, role]
      );
      return res.status(201).json({ message: 'User registered successfully', user: result.rows[0] });
    } else {
      return res.status(201).json({
        message: 'User registered (Dev fallback mode)',
        user: { user_id: 'temp-id', full_name, email, role, is_active: true },
      });
    }
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Conflict', message: 'A user with this email already exists' });
    }
    return next(err);
  }
};

/**
 * GET /api/v1/auth/me
 */
const getMe = async (req, res) => {
  return res.status(200).json({
    user: req.user,
  });
};

module.exports = {
  login,
  register,
  getMe,
};
