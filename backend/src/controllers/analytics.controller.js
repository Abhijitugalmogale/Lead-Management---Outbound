const db = require('../db');

/**
 * GET /api/v1/analytics/overview
 */
const getOverview = async (req, res, next) => {
  try {
    if (!db.isConnected) {
      return res.status(200).json({
        totalLeads: 0,
        totalCompanies: 0,
        totalProjects: 0,
        totalCapacityMw: 0,
        stageBreakdown: {},
        scoreBandBreakdown: { high: 0, medium: 0, nurture: 0 },
        originBreakdown: { outbound: 0, inbound: 0 },
        sourceAttribution: [],
        winRatePercent: 0,
        message: 'Database offline',
      });
    }

    // 1. High-level totals
    const leadsCountRes = await db.query('SELECT COUNT(*) FROM lead');
    const companiesCountRes = await db.query('SELECT COUNT(*) FROM company WHERE status = $1', ['active']);
    const projectsCountRes = await db.query('SELECT COUNT(*), COALESCE(SUM(capacity_mw), 0) as total_mw FROM renewable_project');

    // 2. Stage breakdown
    const stageRes = await db.query('SELECT stage, COUNT(*) as count FROM lead GROUP BY stage');
    const stageBreakdown = {};
    stageRes.rows.forEach((r) => {
      stageBreakdown[r.stage] = parseInt(r.count, 10);
    });

    // 3. Score band breakdown
    const bandRes = await db.query(
      `SELECT s.band, COUNT(*) as count
       FROM lead_score s
       WHERE s.is_current = TRUE
       GROUP BY s.band`
    );
    const scoreBandBreakdown = { high: 0, medium: 0, nurture: 0 };
    bandRes.rows.forEach((r) => {
      if (scoreBandBreakdown[r.band] !== undefined) {
        scoreBandBreakdown[r.band] = parseInt(r.count, 10);
      }
    });

    // 4. Origin breakdown (Outbound vs Inbound)
    const originRes = await db.query('SELECT origin, COUNT(*) as count FROM lead GROUP BY origin');
    const originBreakdown = { outbound: 0, inbound: 0 };
    originRes.rows.forEach((r) => {
      if (originBreakdown[r.origin] !== undefined) {
        originBreakdown[r.origin] = parseInt(r.count, 10);
      }
    });

    // 5. Marketing source attribution
    const sourceRes = await db.query(
      `SELECT m.name as source_name, m.code as source_code, COUNT(l.lead_id) as total_leads,
              COUNT(CASE WHEN l.stage = 'won' THEN 1 END) as won_leads
       FROM marketing_source m
       LEFT JOIN lead l ON m.source_id = l.first_source_id
       GROUP BY m.source_id, m.name, m.code
       ORDER BY total_leads DESC`
    );

    // 6. Win Rate
    const wonCount = stageBreakdown['won'] || 0;
    const lostCount = stageBreakdown['lost'] || 0;
    const closedCount = wonCount + lostCount;
    const winRatePercent = closedCount > 0 ? Math.round((wonCount / closedCount) * 100) : 0;

    return res.status(200).json({
      totalLeads: parseInt(leadsCountRes.rows[0].count, 10),
      totalCompanies: parseInt(companiesCountRes.rows[0].count, 10),
      totalProjects: parseInt(projectsCountRes.rows[0].count, 10),
      totalCapacityMw: parseFloat(projectsCountRes.rows[0].total_mw || 0),
      stageBreakdown,
      scoreBandBreakdown,
      originBreakdown,
      sourceAttribution: sourceRes.rows,
      winRatePercent,
    });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getOverview,
};
