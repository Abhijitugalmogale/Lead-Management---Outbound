const db = require('../db');

/**
 * GET /api/v1/contacts
 */
const listContacts = async (req, res, next) => {
  try {
    const { company_id, search, is_decision_maker, is_verified, limit = 50, offset = 0 } = req.query;

    if (!db.isConnected) {
      return res.status(200).json({ data: [], total: 0, message: 'Database offline' });
    }

    let query = `
      SELECT c.*, comp.legal_name as company_name
      FROM contact c
      JOIN company comp ON c.company_id = comp.company_id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (company_id) {
      query += ` AND c.company_id = $${idx}`;
      params.push(company_id);
      idx++;
    }
    if (search) {
      query += ` AND (c.full_name ILIKE $${idx} OR c.email ILIKE $${idx} OR c.job_title ILIKE $${idx})`;
      params.push(`%${search.trim()}%`);
      idx++;
    }
    if (is_decision_maker !== undefined) {
      query += ` AND c.is_decision_maker = $${idx}`;
      params.push(is_decision_maker === 'true');
      idx++;
    }
    if (is_verified !== undefined) {
      query += ` AND c.is_verified = $${idx}`;
      params.push(is_verified === 'true');
      idx++;
    }

    query += ` ORDER BY c.is_decision_maker DESC, c.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const result = await db.query(query, params);
    const countResult = await db.query('SELECT COUNT(*) FROM contact');

    return res.status(200).json({
      data: result.rows,
      total: parseInt(countResult.rows[0].count, 10),
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/v1/contacts
 */
const createContact = async (req, res, next) => {
  try {
    const {
      company_id,
      full_name,
      job_title,
      department,
      seniority,
      email,
      phone,
      linkedin_url,
      is_decision_maker = false,
      do_not_contact = false,
      marketing_consent = true,
    } = req.body;

    if (!company_id || !full_name) {
      return res.status(400).json({ error: 'Validation error', message: 'company_id and full_name are required' });
    }

    const validSeniorities = ['c_level', 'director', 'vp', 'manager', 'lead', 'staff'];
    if (seniority && !validSeniorities.includes(seniority.toLowerCase())) {
      return res.status(400).json({ error: 'Validation error', message: `seniority must be one of: ${validSeniorities.join(', ')}` });
    }

    if (!db.isConnected) {
      return res.status(201).json({ message: 'Contact created (Dev mock mode)', contact: { full_name, email, job_title } });
    }

    const result = await db.query(
      `INSERT INTO contact (company_id, full_name, job_title, department, seniority, email, phone, linkedin_url, is_decision_maker, do_not_contact, marketing_consent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        company_id,
        full_name.trim(),
        job_title || null,
        department || null,
        seniority ? seniority.toLowerCase() : null,
        email ? email.toLowerCase().trim() : null,
        phone || null,
        linkedin_url || null,
        Boolean(is_decision_maker),
        Boolean(do_not_contact),
        Boolean(marketing_consent),
      ]
    );

    return res.status(201).json({ message: 'Contact created successfully', contact: result.rows[0] });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/v1/contacts/:id/verify
 */
const verifyContact = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user ? req.user.user_id : null;

    if (!db.isConnected) {
      return res.status(200).json({ message: 'Contact verified (Dev mock mode)' });
    }

    const result = await db.query(
      `UPDATE contact
       SET is_verified = TRUE, verified_by = $2, verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE contact_id = $1
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not found', message: 'Contact not found' });
    }

    return res.status(200).json({ message: 'Contact verified successfully', contact: result.rows[0] });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  listContacts,
  createContact,
  verifyContact,
};
