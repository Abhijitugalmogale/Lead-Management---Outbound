const db = require('../db');

/**
 * Normalizes legal company name per SRS/Data Arch:
 * converts to lowercase, removes punctuation and corporate suffixes (Pvt Ltd, Limited, etc.)
 */
const normalizeCompanyName = (name = '') => {
  return name
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, ' ')
    .replace(/\b(private|pvt|limited|ltd|llp|inc|corporation|corp|group)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
};

/**
 * GET /api/v1/companies
 */
const listCompanies = async (req, res, next) => {
  try {
    const { search, state, is_verified, limit = 50, offset = 0 } = req.query;

    if (!db.isConnected) {
      return res.status(200).json({
        data: [],
        total: 0,
        message: 'Database not connected (PostgreSQL offline)',
      });
    }

    let query = 'SELECT * FROM company WHERE status = $1';
    const params = ['active'];
    let idx = 2;

    if (search) {
      query += ` AND (legal_name ILIKE $${idx} OR normalized_name ILIKE $${idx} OR website_domain ILIKE $${idx})`;
      params.push(`%${search.trim()}%`);
      idx++;
    }

    if (state) {
      query += ` AND state ILIKE $${idx}`;
      params.push(`%${state.trim()}%`);
      idx++;
    }

    if (is_verified !== undefined) {
      query += ` AND is_verified = $${idx}`;
      params.push(is_verified === 'true');
      idx++;
    }

    query += ` ORDER BY created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const result = await db.query(query, params);
    const countResult = await db.query('SELECT COUNT(*) FROM company WHERE status = $1', ['active']);

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
 * POST /api/v1/companies
 */
const createCompany = async (req, res, next) => {
  try {
    const { legal_name, website_domain, state, country = 'India', cin, pan, parent_company_id } = req.body;
    if (!legal_name) {
      return res.status(400).json({ error: 'Validation error', message: 'legal_name is required' });
    }

    const normalized_name = normalizeCompanyName(legal_name);

    if (!db.isConnected) {
      return res.status(201).json({
        message: 'Company created (Dev mock mode)',
        company: {
          company_id: 'mock-company-id',
          legal_name,
          normalized_name,
          website_domain,
          state,
          country,
          is_verified: false,
        },
      });
    }

    const result = await db.query(
      `INSERT INTO company (legal_name, normalized_name, website_domain, state, country, cin, pan, parent_company_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [legal_name.trim(), normalized_name, website_domain || null, state || null, country, cin || null, pan || null, parent_company_id || null]
    );

    return res.status(201).json({
      message: 'Company created successfully',
      company: result.rows[0],
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/companies/:id
 */
const getCompanyById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!db.isConnected) {
      return res.status(200).json({ company: { company_id: id, legal_name: 'Mock Company' } });
    }

    const compRes = await db.query('SELECT * FROM company WHERE company_id = $1', [id]);
    if (compRes.rows.length === 0) {
      return res.status(404).json({ error: 'Not found', message: 'Company not found' });
    }

    const company = compRes.rows[0];

    // Fetch linked projects
    const projRes = await db.query(
      `SELECT p.*, r.role FROM renewable_project p
       JOIN project_company_role r ON p.project_id = r.project_id
       WHERE r.company_id = $1`,
      [id]
    );
    company.projects = projRes.rows;

    // Fetch linked contacts
    const contRes = await db.query('SELECT * FROM contact WHERE company_id = $1 ORDER BY is_decision_maker DESC, full_name ASC', [id]);
    company.contacts = contRes.rows;

    // Fetch linked leads
    const leadRes = await db.query('SELECT * FROM lead WHERE company_id = $1 ORDER BY created_at DESC', [id]);
    company.leads = leadRes.rows;

    return res.status(200).json({ company });
  } catch (err) {
    return next(err);
  }
};

/**
 * PUT /api/v1/companies/:id
 */
const updateCompany = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { legal_name, website_domain, state, country, cin, pan } = req.body;

    if (!db.isConnected) {
      return res.status(200).json({ message: 'Company updated (Dev mock mode)' });
    }

    const updates = [];
    const params = [id];
    let idx = 2;

    if (legal_name) {
      updates.push(`legal_name = $${idx}`);
      params.push(legal_name.trim());
      idx++;
      updates.push(`normalized_name = $${idx}`);
      params.push(normalizeCompanyName(legal_name));
      idx++;
    }
    if (website_domain !== undefined) {
      updates.push(`website_domain = $${idx}`);
      params.push(website_domain);
      idx++;
    }
    if (state !== undefined) {
      updates.push(`state = $${idx}`);
      params.push(state);
      idx++;
    }
    if (country !== undefined) {
      updates.push(`country = $${idx}`);
      params.push(country);
      idx++;
    }
    if (cin !== undefined) {
      updates.push(`cin = $${idx}`);
      params.push(cin);
      idx++;
    }
    if (pan !== undefined) {
      updates.push(`pan = $${idx}`);
      params.push(pan);
      idx++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Validation error', message: 'No fields provided to update' });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    const query = `UPDATE company SET ${updates.join(', ')} WHERE company_id = $1 RETURNING *`;
    const result = await db.query(query, params);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not found', message: 'Company not found' });
    }

    return res.status(200).json({ message: 'Company updated successfully', company: result.rows[0] });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/v1/companies/:id/verify
 */
const verifyCompany = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user ? req.user.user_id : null;

    if (!db.isConnected) {
      return res.status(200).json({ message: 'Company verified (Dev mock mode)' });
    }

    const result = await db.query(
      `UPDATE company
       SET is_verified = TRUE, verified_by = $2, verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE company_id = $1
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not found', message: 'Company not found' });
    }

    return res.status(200).json({ message: 'Company verified successfully', company: result.rows[0] });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  normalizeCompanyName,
  listCompanies,
  createCompany,
  getCompanyById,
  updateCompany,
  verifyCompany,
};
