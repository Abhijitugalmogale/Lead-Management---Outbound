const db = require('../db');
const { normalizeCompanyName } = require('./company.controller');
const { calculateLeadScore } = require('../services/scoring.service');

/**
 * Generates formatted lead code
 */
const generateLeadCode = () => {
  const year = new Date().getFullYear();
  const randomSuffix = Math.floor(100000 + Math.random() * 900000);
  return `LD-${year}-${randomSuffix}`;
};

/**
 * POST /api/v1/enquiries (Public endpoint)
 * Ingests inbound form submissions with UTM source tracking
 */
const submitEnquiry = async (req, res, next) => {
  try {
    const {
      company_name,
      contact_name,
      email,
      phone,
      capacity_mw,
      technology = 'solar',
      services_interested,
      message,
      utm_source = 'website',
      utm_medium,
      utm_campaign,
      utm_content,
      utm_term,
      channel = 'website',
    } = req.body;

    if (!company_name || !contact_name || !email) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'company_name, contact_name, and email are required fields',
      });
    }

    if (!db.isConnected) {
      return res.status(201).json({
        message: 'Enquiry received successfully (Dev mock mode)',
        enquiry: { company_name, contact_name, email, channel },
      });
    }

    // 1. Resolve Marketing Source ID
    let sourceId = null;
    const srcRes = await db.query('SELECT source_id FROM marketing_source WHERE code = $1', [utm_source.toLowerCase().trim()]);
    if (srcRes.rows.length > 0) {
      sourceId = srcRes.rows[0].source_id;
    } else {
      const defaultSrc = await db.query('SELECT source_id FROM marketing_source WHERE code = $1', ['website']);
      if (defaultSrc.rows.length > 0) sourceId = defaultSrc.rows[0].source_id;
    }

    // 2. Resolve or Create Company
    const normName = normalizeCompanyName(company_name);
    let companyId;
    const compRes = await db.query('SELECT company_id FROM company WHERE normalized_name = $1 LIMIT 1', [normName]);
    if (compRes.rows.length > 0) {
      companyId = compRes.rows[0].company_id;
    } else {
      const newComp = await db.query(
        `INSERT INTO company (legal_name, normalized_name, country)
         VALUES ($1, $2, 'India')
         RETURNING company_id`,
        [company_name.trim(), normName]
      );
      companyId = newComp.rows[0].company_id;
    }

    // 3. Resolve or Create Contact
    let contactId;
    const contRes = await db.query('SELECT contact_id FROM contact WHERE email = $1 AND company_id = $2 LIMIT 1', [email.toLowerCase().trim(), companyId]);
    if (contRes.rows.length > 0) {
      contactId = contRes.rows[0].contact_id;
    } else {
      const newCont = await db.query(
        `INSERT INTO contact (company_id, full_name, email, phone, is_decision_maker)
         VALUES ($1, $2, $3, $4, FALSE)
         RETURNING contact_id`,
        [companyId, contact_name.trim(), email.toLowerCase().trim(), phone || null]
      );
      contactId = newCont.rows[0].contact_id;
    }

    // 4. Create Inbound Lead
    const leadCode = generateLeadCode();
    const newLead = await db.query(
      `INSERT INTO lead (lead_code, company_id, origin, first_source_id, stage, notes)
       VALUES ($1, $2, 'inbound', $3, 'new', $4)
       RETURNING *`,
      [leadCode, companyId, sourceId, message ? `Inbound enquiry message: ${message}` : 'Direct website form lead']
    );
    const lead = newLead.rows[0];

    // Link contact to lead
    await db.query(
      `INSERT INTO lead_contact (lead_id, contact_id, is_primary) VALUES ($1, $2, TRUE)`,
      [lead.lead_id, contactId]
    );

    // 5. If project capacity provided, create or link project
    if (capacity_mw) {
      const newProj = await db.query(
        `INSERT INTO renewable_project (project_name, technology, capacity_mw, country, stage)
         VALUES ($1, $2, $3, 'India', 'planned')
         RETURNING project_id`,
        [`${company_name} Renewable Project`, technology.toLowerCase(), parseFloat(capacity_mw)]
      );
      const projectId = newProj.rows[0].project_id;
      await db.query(`INSERT INTO lead_project (lead_id, project_id) VALUES ($1, $2)`, [lead.lead_id, projectId]);
      await db.query(`INSERT INTO project_company_role (project_id, company_id, role) VALUES ($1, $2, 'developer')`, [projectId, companyId]);
    }

    // 6. Record Enquiry record
    const enqRes = await db.query(
      `INSERT INTO enquiry (
         channel, source_id, company_name, contact_name, email, phone, capacity_mw,
         technology, services_interested, message, utm_source, utm_medium, utm_campaign,
         utm_content, utm_term, lead_id, status
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, 'converted')
       RETURNING *`,
      [
        channel.toLowerCase(),
        sourceId,
        company_name.trim(),
        contact_name.trim(),
        email.toLowerCase().trim(),
        phone || null,
        capacity_mw ? parseFloat(capacity_mw) : null,
        technology.toLowerCase(),
        services_interested || null,
        message || null,
        utm_source,
        utm_medium || null,
        utm_campaign || null,
        utm_content || null,
        utm_term || null,
        lead.lead_id,
      ]
    );

    // 7. Calculate initial score for inbound lead (enquiry counts for 8 points under Factor 8)
    const scoreResult = calculateLeadScore({
      companyRole: 'developer',
      hasProject: Boolean(capacity_mw),
      projectSourceType: 'confirmed',
      largestCapacityMw: capacity_mw || 0,
      projectCount: 1,
      hasConfirmedNeed: false,
      possibleNeedsCount: 1,
      hasVerifiedDecisionMaker: false,
      hasIdentifiedContact: true,
      country: 'India',
      latestEngagementType: 'enquiry',
    });

    await db.query(
      `INSERT INTO lead_score (lead_id, rule_version, total_score, band, breakdown, is_current)
       VALUES ($1, $2, $3, $4, $5, TRUE)`,
      [lead.lead_id, scoreResult.ruleVersion, scoreResult.totalScore, scoreResult.band, JSON.stringify(scoreResult.breakdown)]
    );

    return res.status(201).json({
      message: 'Thank you for your enquiry. Our team will contact you shortly.',
      enquiry_id: enqRes.rows[0].enquiry_id,
      lead_code: lead.lead_code,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/enquiries (Private endpoint for marketing/sales)
 */
const listEnquiries = async (req, res, next) => {
  try {
    if (!db.isConnected) {
      return res.status(200).json({ data: [], total: 0 });
    }

    const { limit = 50, offset = 0 } = req.query;
    const result = await db.query(
      `SELECT e.*, l.lead_code, l.stage as lead_stage
       FROM enquiry e
       LEFT JOIN lead l ON e.lead_id = l.lead_id
       ORDER BY e.received_at DESC
       LIMIT $1 OFFSET $2`,
      [parseInt(limit, 10), parseInt(offset, 10)]
    );

    const countRes = await db.query('SELECT COUNT(*) FROM enquiry');

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

module.exports = {
  submitEnquiry,
  listEnquiries,
};
