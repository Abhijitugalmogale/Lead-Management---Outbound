const db = require('../db');

/**
 * GET /api/v1/projects
 */
const listProjects = async (req, res, next) => {
  try {
    const { technology, stage, state, min_capacity, max_capacity, limit = 50, offset = 0 } = req.query;

    if (!db.isConnected) {
      return res.status(200).json({ data: [], total: 0, message: 'Database offline' });
    }

    let query = 'SELECT * FROM renewable_project WHERE 1=1';
    const params = [];
    let idx = 1;

    if (technology) {
      query += ` AND technology = $${idx}`;
      params.push(technology.toLowerCase().trim());
      idx++;
    }
    if (stage) {
      query += ` AND stage = $${idx}`;
      params.push(stage.toLowerCase().trim());
      idx++;
    }
    if (state) {
      query += ` AND state ILIKE $${idx}`;
      params.push(`%${state.trim()}%`);
      idx++;
    }
    if (min_capacity) {
      query += ` AND capacity_mw >= $${idx}`;
      params.push(parseFloat(min_capacity));
      idx++;
    }
    if (max_capacity) {
      query += ` AND capacity_mw <= $${idx}`;
      params.push(parseFloat(max_capacity));
      idx++;
    }

    query += ` ORDER BY capacity_mw DESC NULLS LAST LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const result = await db.query(query, params);
    const countResult = await db.query('SELECT COUNT(*) FROM renewable_project');

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
 * POST /api/v1/projects
 */
const createProject = async (req, res, next) => {
  try {
    const { project_name, technology, capacity_mw, substation, state, district, country = 'India', stage = 'planned', expected_cod } = req.body;

    if (!project_name || !technology) {
      return res.status(400).json({ error: 'Validation error', message: 'project_name and technology are required' });
    }

    const validTechs = ['solar', 'wind', 'hybrid', 'storage'];
    if (!validTechs.includes(technology.toLowerCase())) {
      return res.status(400).json({ error: 'Validation error', message: `technology must be one of: ${validTechs.join(', ')}` });
    }

    if (!db.isConnected) {
      return res.status(201).json({ message: 'Project created (Dev mock mode)', project: { project_name, technology, capacity_mw } });
    }

    const result = await db.query(
      `INSERT INTO renewable_project (project_name, technology, capacity_mw, substation, state, district, country, stage, expected_cod)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [project_name.trim(), technology.toLowerCase(), capacity_mw || null, substation || null, state || null, district || null, country, stage, expected_cod || null]
    );

    return res.status(201).json({ message: 'Project created successfully', project: result.rows[0] });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/projects/:id
 */
const getProjectById = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!db.isConnected) {
      return res.status(200).json({ project: { project_id: id, project_name: 'Mock Project' } });
    }

    const projRes = await db.query('SELECT * FROM renewable_project WHERE project_id = $1', [id]);
    if (projRes.rows.length === 0) {
      return res.status(404).json({ error: 'Not found', message: 'Project not found' });
    }

    const project = projRes.rows[0];

    // Fetch linked companies and their roles
    const compRes = await db.query(
      `SELECT c.company_id, c.legal_name, c.normalized_name, c.website_domain, r.role
       FROM company c
       JOIN project_company_role r ON c.company_id = r.company_id
       WHERE r.project_id = $1`,
      [id]
    );
    project.companies = compRes.rows;

    return res.status(200).json({ project });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/v1/projects/:id/link-company
 */
const linkCompanyToProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { company_id, role } = req.body;

    if (!company_id || !role) {
      return res.status(400).json({ error: 'Validation error', message: 'company_id and role are required' });
    }

    const validRoles = ['owner', 'developer', 'operator', 'spv', 'epc', 'om'];
    if (!validRoles.includes(role.toLowerCase())) {
      return res.status(400).json({ error: 'Validation error', message: `role must be one of: ${validRoles.join(', ')}` });
    }

    if (!db.isConnected) {
      return res.status(200).json({ message: 'Company linked to project (Dev mock mode)' });
    }

    await db.query(
      `INSERT INTO project_company_role (project_id, company_id, role)
       VALUES ($1, $2, $3)
       ON CONFLICT (project_id, company_id, role) DO NOTHING`,
      [id, company_id, role.toLowerCase()]
    );

    return res.status(200).json({ message: 'Company linked to project successfully' });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  listProjects,
  createProject,
  getProjectById,
  linkCompanyToProject,
};
