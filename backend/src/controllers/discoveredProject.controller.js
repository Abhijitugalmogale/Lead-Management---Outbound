const db = require('../db');
const localStore = require('../db/localStore');
const { calculateLeadScore } = require('../services/scoring.service');
const { normalizeCompanyName } = require('./company.controller');

/**
 * Generates formatted lead code
 */
const generateLeadCode = () => {
  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  return `LD-${year}-${randomSuffix}`;
};

/**
 * GET /api/v1/discovered-projects
 * List discovered projects with search & filters
 */
const listDiscoveredProjects = async (req, res, next) => {
  try {
    const { review_status = 'pending_review', technology, state, search, min_capacity, limit = 50, offset = 0 } = req.query;

    if (!db.isConnected) {
      const resList = localStore.getDiscoveredProjects({ review_status, technology, state, search, min_capacity, limit, offset });
      return res.status(200).json({
        data: resList.data,
        total: resList.total,
        limit: parseInt(limit, 10),
        offset: parseInt(offset, 10),
      });
    }

    let query = `
      SELECT dp.*, s.name as source_name, s.source_type,
             c.legal_name as matched_company_legal_name
      FROM discovered_project dp
      LEFT JOIN data_source s ON dp.data_source_id = s.data_source_id
      LEFT JOIN company c ON dp.matched_company_id = c.company_id
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (review_status && review_status !== 'all') {
      query += ` AND dp.review_status = $${idx}`;
      params.push(review_status.toLowerCase());
      idx++;
    }

    if (technology) {
      query += ` AND dp.technology = $${idx}`;
      params.push(technology.toLowerCase());
      idx++;
    }

    if (state) {
      query += ` AND dp.state ILIKE $${idx}`;
      params.push(`%${state.trim()}%`);
      idx++;
    }

    if (min_capacity) {
      query += ` AND dp.capacity_mw >= $${idx}`;
      params.push(parseFloat(min_capacity));
      idx++;
    }

    if (search) {
      query += ` AND (dp.raw_project_name ILIKE $${idx} OR dp.raw_company_name ILIKE $${idx})`;
      params.push(`%${search.trim()}%`);
      idx++;
    }

    query += ` ORDER BY dp.capacity_mw DESC NULLS LAST, dp.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const result = await db.query(query, params);
    const countRes = await db.query('SELECT COUNT(*) FROM discovered_project WHERE review_status = $1', [review_status || 'pending_review']);

    return res.status(200).json({
      data: result.rows,
      total: parseInt(countRes.rows[0].count, 10),
      limit: parseInt(limit, 10),
      offset: parseInt(offset, 10),
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/discovered-projects/:id
 * Inspect a discovered project and preview lead scoring
 */
const getDiscoveredProjectById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!db.isConnected) {
      const project = localStore.getDiscoveredProjectById(id);
      if (!project) {
        return res.status(404).json({ error: 'Not found', message: 'Discovered project not found' });
      }
      const previewScore = calculateLeadScore({
        companyRole: project.matched_company_role || 'developer',
        hasProject: true,
        projectSourceType: project.source_type || 'news_feed',
        largestCapacityMw: project.capacity_mw || 0,
        projectCount: 1,
        hasConfirmedNeed: false,
        possibleNeedsCount: 1,
        country: 'India',
        latestEngagementType: 'none',
      });
      return res.status(200).json({ project, previewScore });
    }

    const result = await db.query(
      `SELECT dp.*, s.name as source_name, s.source_type,
              c.legal_name as matched_company_legal_name, c.website_domain as matched_company_domain,
              u.full_name as reviewed_by_name
       FROM discovered_project dp
       LEFT JOIN data_source s ON dp.data_source_id = s.data_source_id
       LEFT JOIN company c ON dp.matched_company_id = c.company_id
       LEFT JOIN app_user u ON dp.reviewed_by = u.user_id
       WHERE dp.discovered_project_id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not found', message: 'Discovered project not found' });
    }

    const project = result.rows[0];

    // Compute preview score based on discovered facts
    const previewScore = calculateLeadScore({
      companyRole: 'developer',
      hasProject: true,
      projectSourceType: project.source_type || 'official_file',
      largestCapacityMw: project.capacity_mw || 0,
      projectCount: 1,
      hasConfirmedNeed: false,
      possibleNeedsCount: 1,
      hasVerifiedDecisionMaker: false,
      hasIdentifiedContact: false,
      country: project.country || 'India',
      latestEngagementType: 'none',
    });

    return res.status(200).json({
      project,
      previewScore,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * PUT /api/v1/discovered-projects/:id/review
 * Update review status: 'approved', 'rejected', or 'merged'
 */
const reviewDiscoveredProject = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { review_status, review_notes, company_id, role = 'developer' } = req.body;
    const userId = req.user ? req.user.user_id : null;

    if (!review_status || !['approved', 'rejected', 'merged'].includes(review_status.toLowerCase())) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'review_status must be one of: approved, rejected, merged',
      });
    }

    const action = review_status.toLowerCase();

    if (!db.isConnected) {
      if (action === 'rejected') {
        const updated = localStore.updateDiscoveredProject(id, {
          review_status: 'rejected',
          review_notes: review_notes || 'Rejected during analyst review'
        });
        return res.status(200).json({ message: 'Project rejected', project: updated });
      }

      if (action === 'approved' || action === 'merged') {
        const proj = localStore.getDiscoveredProjectById(id);
        if (!proj) return res.status(404).json({ error: 'Not found', message: 'Discovered project not found' });

        localStore.updateDiscoveredProject(id, {
          review_status: 'approved',
          review_notes: review_notes || 'Approved during analyst review'
        });
        const lead = localStore.convertToLead(id, userId);
        return res.status(200).json({
          message: 'Discovered project approved and lead created successfully',
          lead,
          project: proj
        });
      }
    }

    // 1. Fetch discovered project
    const projRes = await db.query('SELECT * FROM discovered_project WHERE discovered_project_id = $1', [id]);
    if (projRes.rows.length === 0) {
      return res.status(404).json({ error: 'Not found', message: 'Discovered project not found' });
    }
    const item = projRes.rows[0];

    // Handle rejection
    if (action === 'rejected') {
      const updated = await db.query(
        `UPDATE discovered_project
         SET review_status = 'rejected', reviewed_by = $1, reviewed_at = CURRENT_TIMESTAMP, review_notes = $2
         WHERE discovered_project_id = $3
         RETURNING *`,
        [userId, review_notes || 'Rejected during analyst review', id]
      );
      return res.status(200).json({ message: 'Project rejected', project: updated.rows[0] });
    }

    // Handle approval
    if (action === 'approved' || action === 'merged') {
      let resolvedCompanyId = company_id || item.matched_company_id;

      // Create company if not provided or matched
      if (!resolvedCompanyId && item.raw_company_name) {
        const normName = normalizeCompanyName(item.raw_company_name);
        const compRes = await db.query('SELECT company_id FROM company WHERE normalized_name = $1 LIMIT 1', [normName]);
        if (compRes.rows.length > 0) {
          resolvedCompanyId = compRes.rows[0].company_id;
        } else {
          const newComp = await db.query(
            `INSERT INTO company (legal_name, normalized_name, state, country, is_verified, verified_by, verified_at)
             VALUES ($1, $2, $3, $4, TRUE, $5, CURRENT_TIMESTAMP)
             RETURNING company_id`,
            [item.raw_company_name.trim(), normName, item.state || null, item.country || 'India', userId]
          );
          resolvedCompanyId = newComp.rows[0].company_id;
        }
      }

      if (!resolvedCompanyId) {
        return res.status(400).json({
          error: 'Validation error',
          message: 'Cannot approve project without an identified or created company',
        });
      }

      // Create Renewable Project record
      const newProj = await db.query(
        `INSERT INTO renewable_project (project_name, technology, capacity_mw, state, district, country, stage, expected_cod)
         VALUES ($1, $2, $3, $4, $5, $6, 'planned', $7)
         RETURNING project_id`,
        [item.raw_project_name, item.technology || 'solar', item.capacity_mw, item.state, item.district, item.country || 'India', item.expected_cod]
      );
      const projectId = newProj.rows[0].project_id;

      // Link Company & Project Role
      await db.query(
        `INSERT INTO project_company_role (project_id, company_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (project_id, company_id, role) DO NOTHING`,
        [projectId, resolvedCompanyId, role.toLowerCase()]
      );

      // Create Outbound Lead
      const leadCode = generateLeadCode();
      const newLead = await db.query(
        `INSERT INTO lead (lead_code, company_id, origin, stage, verified_by, verified_at, notes)
         VALUES ($1, $2, 'outbound', 'verified', $3, CURRENT_TIMESTAMP, $4)
         RETURNING *`,
        [leadCode, resolvedCompanyId, userId, review_notes || `Discovered from source via automated collection run`]
      );
      const lead = newLead.rows[0];

      // Link Lead to Project
      await db.query(`INSERT INTO lead_project (lead_id, project_id) VALUES ($1, $2)`, [lead.lead_id, projectId]);

      // Calculate initial score for the approved outbound lead
      const score = calculateLeadScore({
        companyRole: role,
        hasProject: true,
        projectSourceType: 'official_file',
        largestCapacityMw: item.capacity_mw || 0,
        projectCount: 1,
        hasConfirmedNeed: false,
        possibleNeedsCount: 1,
        hasVerifiedDecisionMaker: false,
        hasIdentifiedContact: false,
        country: item.country || 'India',
        latestEngagementType: 'none',
      });

      await db.query(
        `INSERT INTO lead_score (lead_id, rule_version, total_score, band, breakdown, is_current)
         VALUES ($1, $2, $3, $4, $5, TRUE)`,
        [lead.lead_id, score.ruleVersion, score.totalScore, score.band, JSON.stringify(score.breakdown)]
      );

      // Update discovered project record
      const updatedItem = await db.query(
        `UPDATE discovered_project
         SET review_status = $1,
             reviewed_by = $2,
             reviewed_at = CURRENT_TIMESTAMP,
             review_notes = $3,
             renewable_project_id = $4,
             lead_id = $5,
             matched_company_id = $6
         WHERE discovered_project_id = $7
         RETURNING *`,
        [action, userId, review_notes || null, projectId, lead.lead_id, resolvedCompanyId, id]
      );

      return res.status(200).json({
        message: `Discovered project ${action} successfully and converted to Lead ${lead.lead_code}`,
        project: updatedItem.rows[0],
        lead,
        score,
      });
    }
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  listDiscoveredProjects,
  getDiscoveredProjectById,
  reviewDiscoveredProject,
};
