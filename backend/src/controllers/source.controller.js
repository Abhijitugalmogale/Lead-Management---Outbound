const db = require('../db');
const localStore = require('../db/localStore');

/**
 * GET /api/v1/sources
 * List all configured outbound data sources
 */
const listSources = async (req, res, next) => {
  try {
    if (!db.isConnected) {
      return res.status(200).json({ sources: localStore.getSources() });
    }

    const result = await db.query(
      `SELECT s.*, u.full_name as approved_by_name,
              COUNT(j.job_run_id) as total_runs,
              MAX(j.started_at) as last_run_at
       FROM data_source s
       LEFT JOIN app_user u ON s.approved_by = u.user_id
       LEFT JOIN job_run j ON s.data_source_id = j.data_source_id
       GROUP BY s.data_source_id, u.full_name
       ORDER BY s.created_at ASC`
    );

    return res.status(200).json({ sources: result.rows });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/v1/sources
 * Register a new data source
 */
const createSource = async (req, res, next) => {
  try {
    const { name, source_type, terms_note, is_permitted = true } = req.body;
    const userId = req.user ? req.user.user_id : null;

    if (!name || !source_type) {
      return res.status(400).json({ error: 'Validation error', message: 'name and source_type are required' });
    }

    const validTypes = ['official_api', 'official_file', 'licensed', 'news_feed', 'manual_research', 'website_form', 'ad_platform'];
    if (!validTypes.includes(source_type.toLowerCase())) {
      return res.status(400).json({ error: 'Validation error', message: `source_type must be one of: ${validTypes.join(', ')}` });
    }

    if (!db.isConnected) {
      const source = localStore.createSource({ name, source_type, terms_note, is_permitted });
      return res.status(201).json({ message: 'Data source registered successfully', source });
    }

    const result = await db.query(
      `INSERT INTO data_source (name, source_type, terms_note, is_permitted, approved_by, approved_at, is_active)
       VALUES ($1, $2, $3, $4, $5, CASE WHEN $4 = TRUE THEN CURRENT_TIMESTAMP ELSE NULL END, TRUE)
       RETURNING *`,
      [name.trim(), source_type.toLowerCase(), terms_note || null, Boolean(is_permitted), userId]
    );

    return res.status(201).json({
      message: 'Data source registered successfully',
      source: result.rows[0],
    });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Conflict', message: 'A data source with this name already exists' });
    }
    return next(err);
  }
};

module.exports = {
  listSources,
  createSource,
};
