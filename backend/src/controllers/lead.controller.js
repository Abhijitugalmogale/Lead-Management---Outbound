const db = require('../db');
const { calculateLeadScore } = require('../services/scoring.service');

/**
 * Generates formatted lead code: LD-YYYY-XXXXXX
 */
const generateLeadCode = () => {
  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  return `LD-${year}-${randomSuffix}`;
};

/**
 * Gathers all data for a lead and runs scoring algorithm
 */
const scoreLeadInternal = async (leadId) => {
  if (!db.isConnected) {
    return { totalScore: 50, band: 'nurture', breakdown: {} };
  }

  // 1. Get lead and company info
  const leadRes = await db.query(
    `SELECT l.*, c.state as company_state, c.country as company_country
     FROM lead l
     JOIN company c ON l.company_id = c.company_id
     WHERE l.lead_id = $1`,
    [leadId]
  );
  if (leadRes.rows.length === 0) return null;
  const lead = leadRes.rows[0];

  // 2. Get project role & project capacity
  const roleRes = await db.query(
    `SELECT r.role, p.capacity_mw, p.country, p.project_id
     FROM lead_project lp
     JOIN renewable_project p ON lp.project_id = p.project_id
     LEFT JOIN project_company_role r ON (p.project_id = r.project_id AND r.company_id = $1)
     WHERE lp.lead_id = $2`,
    [lead.company_id, leadId]
  );

  let largestCapacityMw = 0;
  let companyRole = '';
  roleRes.rows.forEach((r) => {
    if (r.capacity_mw && parseFloat(r.capacity_mw) > largestCapacityMw) {
      largestCapacityMw = parseFloat(r.capacity_mw);
    }
    if (r.role) companyRole = r.role;
  });

  // 3. Count total projects for company
  const countProjRes = await db.query(
    `SELECT COUNT(DISTINCT project_id) as count FROM project_company_role WHERE company_id = $1`,
    [lead.company_id]
  );
  const projectCount = parseInt(countProjRes.rows[0].count, 10) || roleRes.rows.length;

  // 4. Get service needs
  const needRes = await db.query(
    `SELECT * FROM lead_service_need WHERE lead_id = $1`,
    [leadId]
  );
  const hasConfirmedNeed = needRes.rows.some((n) => n.status === 'confirmed');
  const possibleNeedsCount = needRes.rows.length;

  // 5. Get contacts
  const contRes = await db.query(
    `SELECT c.* FROM lead_contact lc
     JOIN contact c ON lc.contact_id = c.contact_id
     WHERE lc.lead_id = $1 AND c.do_not_contact = FALSE`,
    [leadId]
  );
  const hasVerifiedDecisionMaker = contRes.rows.some((c) => c.is_verified && c.is_decision_maker);
  const hasIdentifiedContact = contRes.rows.length > 0;

  // 6. Latest engagement in last 90 days
  const actRes = await db.query(
    `SELECT activity_type FROM crm_activity
     WHERE lead_id = $1 AND performed_at >= NOW() - INTERVAL '90 days'
     ORDER BY performed_at DESC LIMIT 1`,
    [leadId]
  );
  const latestEngagementType = actRes.rows.length > 0 ? actRes.rows[0].activity_type : '';

  // Calculate score via Algorithm A5
  const scoringInput = {
    companyRole,
    hasProject: roleRes.rows.length > 0,
    projectSourceType: 'confirmed',
    largestCapacityMw,
    projectCount,
    hasConfirmedNeed,
    possibleNeedsCount,
    hasVerifiedDecisionMaker,
    hasIdentifiedContact,
    country: lead.company_country || 'India',
    latestEngagementType,
  };

  const calculated = calculateLeadScore(scoringInput);

  // Save new score record, marking old as is_current = FALSE
  await db.query(`UPDATE lead_score SET is_current = FALSE WHERE lead_id = $1`, [leadId]);
  await db.query(
    `INSERT INTO lead_score (lead_id, rule_version, total_score, band, breakdown, is_current)
     VALUES ($1, $2, $3, $4, $5, TRUE)`,
    [leadId, calculated.ruleVersion, calculated.totalScore, calculated.band, JSON.stringify(calculated.breakdown)]
  );

  return calculated;
};

/**
 * GET /api/v1/leads
 */
const listLeads = async (req, res, next) => {
  try {
    const { stage, band, origin, assigned_to, search, limit = 50, offset = 0 } = req.query;

    if (!db.isConnected) {
      return res.status(200).json({ data: [], total: 0, message: 'Database offline' });
    }

    let query = `
      SELECT l.*, c.legal_name as company_name, c.website_domain,
             u.full_name as assigned_to_name,
             s.total_score, s.band as score_band, s.breakdown as score_breakdown
      FROM lead l
      JOIN company c ON l.company_id = c.company_id
      LEFT JOIN app_user u ON l.assigned_to = u.user_id
      LEFT JOIN lead_score s ON (l.lead_id = s.lead_id AND s.is_current = TRUE)
      WHERE 1=1
    `;
    const params = [];
    let idx = 1;

    if (stage) {
      query += ` AND l.stage = $${idx}`;
      params.push(stage.toLowerCase());
      idx++;
    }
    if (band) {
      query += ` AND s.band = $${idx}`;
      params.push(band.toLowerCase());
      idx++;
    }
    if (origin) {
      query += ` AND l.origin = $${idx}`;
      params.push(origin.toLowerCase());
      idx++;
    }
    if (assigned_to) {
      query += ` AND l.assigned_to = $${idx}`;
      params.push(assigned_to);
      idx++;
    }
    if (search) {
      query += ` AND (c.legal_name ILIKE $${idx} OR l.lead_code ILIKE $${idx})`;
      params.push(`%${search.trim()}%`);
      idx++;
    }

    query += ` ORDER BY s.total_score DESC NULLS LAST, l.created_at DESC LIMIT $${idx} OFFSET $${idx + 1}`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const result = await db.query(query, params);
    const countResult = await db.query('SELECT COUNT(*) FROM lead');

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
 * POST /api/v1/leads
 */
const createLead = async (req, res, next) => {
  try {
    const { company_id, origin = 'inbound', project_ids = [], contact_ids = [], services = [], notes } = req.body;

    if (!company_id) {
      return res.status(400).json({ error: 'Validation error', message: 'company_id is required' });
    }

    const leadCode = generateLeadCode();

    if (!db.isConnected) {
      return res.status(201).json({
        message: 'Lead created (Dev mock mode)',
        lead: { lead_code: leadCode, company_id, origin, stage: 'new' },
      });
    }

    // Insert lead
    const leadRes = await db.query(
      `INSERT INTO lead (lead_code, company_id, origin, stage, notes)
       VALUES ($1, $2, $3, 'new', $4)
       RETURNING *`,
      [leadCode, company_id, origin, notes || null]
    );
    const lead = leadRes.rows[0];

    // Link projects
    for (const pid of project_ids) {
      await db.query(`INSERT INTO lead_project (lead_id, project_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [lead.lead_id, pid]);
    }

    // Link contacts
    for (const cid of contact_ids) {
      await db.query(`INSERT INTO lead_contact (lead_id, contact_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [lead.lead_id, cid]);
    }

    // Link service needs
    for (const s of services) {
      await db.query(
        `INSERT INTO lead_service_need (lead_id, service_code, status)
         VALUES ($1, $2, $3)
         ON CONFLICT (lead_id, service_code) DO NOTHING`,
        [lead.lead_id, s.service_code || s, s.status || 'possible']
      );
    }

    // Calculate initial score
    const score = await scoreLeadInternal(lead.lead_id);

    return res.status(201).json({
      message: 'Lead created successfully',
      lead,
      score,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/leads/:id
 */
const getLeadById = async (req, res, next) => {
  try {
    const { id } = req.params;

    if (!db.isConnected) {
      return res.status(200).json({ lead: { lead_id: id, lead_code: 'LD-2026-MOCK' } });
    }

    const leadRes = await db.query(
      `SELECT l.*, c.legal_name as company_name, c.normalized_name, c.website_domain, c.state as company_state,
              u.full_name as assigned_to_name, u.email as assigned_to_email,
              vb.full_name as verified_by_name,
              s.total_score, s.band as score_band, s.breakdown as score_breakdown, s.calculated_at as scored_at
       FROM lead l
       JOIN company c ON l.company_id = c.company_id
       LEFT JOIN app_user u ON l.assigned_to = u.user_id
       LEFT JOIN app_user vb ON l.verified_by = vb.user_id
       LEFT JOIN lead_score s ON (l.lead_id = s.lead_id AND s.is_current = TRUE)
       WHERE l.lead_id = $1`,
      [id]
    );

    if (leadRes.rows.length === 0) {
      return res.status(404).json({ error: 'Not found', message: 'Lead not found' });
    }

    const lead = leadRes.rows[0];

    // Linked projects
    const projRes = await db.query(
      `SELECT p.*, r.role FROM renewable_project p
       JOIN lead_project lp ON p.project_id = lp.project_id
       LEFT JOIN project_company_role r ON (p.project_id = r.project_id AND r.company_id = $1)
       WHERE lp.lead_id = $2`,
      [lead.company_id, id]
    );
    lead.projects = projRes.rows;

    // Linked contacts
    const contRes = await db.query(
      `SELECT c.*, lc.is_primary FROM contact c
       JOIN lead_contact lc ON c.contact_id = lc.contact_id
       WHERE lc.lead_id = $1`,
      [id]
    );
    lead.contacts = contRes.rows;

    // Service needs
    const needRes = await db.query(`SELECT * FROM lead_service_need WHERE lead_id = $1`, [id]);
    lead.service_needs = needRes.rows;

    // Score history
    const scoreHistRes = await db.query(
      `SELECT * FROM lead_score WHERE lead_id = $1 ORDER BY calculated_at DESC`,
      [id]
    );
    lead.score_history = scoreHistRes.rows;

    // Recent CRM activities
    const actRes = await db.query(
      `SELECT a.*, u.full_name as user_name FROM crm_activity a
       JOIN app_user u ON a.user_id = u.user_id
       WHERE a.lead_id = $1 ORDER BY a.performed_at DESC`,
      [id]
    );
    lead.activities = actRes.rows;

    return res.status(200).json({ lead });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/v1/leads/:id/verify (Verification Gate)
 */
const verifyLead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user ? req.user.user_id : null;

    if (!db.isConnected) {
      return res.status(200).json({ message: 'Lead verified (Dev mock mode)' });
    }

    const result = await db.query(
      `UPDATE lead
       SET stage = CASE WHEN stage = 'new' THEN 'verified' ELSE stage END,
           verified_by = $2,
           verified_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE lead_id = $1
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not found', message: 'Lead not found' });
    }

    // Re-score upon verification
    const score = await scoreLeadInternal(id);

    return res.status(200).json({
      message: 'Lead verified successfully',
      lead: result.rows[0],
      score,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/v1/leads/:id/rescore
 */
const rescoreLead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const score = await scoreLeadInternal(id);
    if (!score) {
      return res.status(404).json({ error: 'Not found', message: 'Lead not found' });
    }
    return res.status(200).json({ message: 'Lead re-scored successfully', score });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/v1/leads/:id/needs
 */
const addServiceNeed = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { service_code, status = 'possible' } = req.body;
    const userId = req.user ? req.user.user_id : null;

    const validCodes = ['fs', 'qca', 'telemetry', 'open_access', 'liaisoning', 'other'];
    if (!service_code || !validCodes.includes(service_code.toLowerCase())) {
      return res.status(400).json({ error: 'Validation error', message: `service_code must be one of: ${validCodes.join(', ')}` });
    }

    if (!db.isConnected) {
      return res.status(200).json({ message: 'Service need added (Dev mock mode)' });
    }

    await db.query(
      `INSERT INTO lead_service_need (lead_id, service_code, status, recorded_by)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (lead_id, service_code)
       DO UPDATE SET status = EXCLUDED.status, recorded_by = EXCLUDED.recorded_by`,
      [id, service_code.toLowerCase(), status.toLowerCase(), userId]
    );

    // Re-score lead after service need recorded
    const score = await scoreLeadInternal(id);

    return res.status(200).json({ message: 'Service need recorded and lead re-scored', score });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  listLeads,
  createLead,
  getLeadById,
  verifyLead,
  rescoreLead,
  addServiceNeed,
};
