const db = require('../db');
const { calculateLeadScore } = require('../services/scoring.service');

const VALID_STAGES = [
  'new',
  'verified',
  'qualified',
  'contacted',
  'responded',
  'meeting',
  'demo',
  'proposal',
  'negotiation',
  'won',
  'lost',
];

/**
 * GET /api/v1/crm/pipeline
 * Groups leads by pipeline stage for Kanban board
 */
const getPipeline = async (req, res, next) => {
  try {
    if (!db.isConnected) {
      return res.status(200).json({ pipeline: {}, message: 'Database offline' });
    }

    const result = await db.query(
      `SELECT l.lead_id, l.lead_code, l.stage, l.origin, l.next_follow_up_date, l.notes,
              c.company_id, c.legal_name as company_name, c.state as company_state,
              u.full_name as assigned_to_name,
              s.total_score, s.band as score_band
       FROM lead l
       JOIN company c ON l.company_id = c.company_id
       LEFT JOIN app_user u ON l.assigned_to = u.user_id
       LEFT JOIN lead_score s ON (l.lead_id = s.lead_id AND s.is_current = TRUE)
       ORDER BY l.created_at DESC`
    );

    // Group leads by stage
    const pipeline = {};
    VALID_STAGES.forEach((stage) => {
      pipeline[stage] = {
        stage,
        count: 0,
        leads: [],
      };
    });

    result.rows.forEach((row) => {
      if (pipeline[row.stage]) {
        pipeline[row.stage].leads.push(row);
        pipeline[row.stage].count++;
      }
    });

    return res.status(200).json({
      pipeline,
      totalLeads: result.rows.length,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/v1/crm/leads/:id/stage
 * Validates transition rules and logs activity
 */
const updateLeadStage = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { stage, loss_reason, deal_value, notes } = req.body;
    const userId = req.user ? req.user.user_id : null;

    if (!stage || !VALID_STAGES.includes(stage.toLowerCase())) {
      return res.status(400).json({
        error: 'Validation error',
        message: `Stage must be one of: ${VALID_STAGES.join(', ')}`,
      });
    }

    const targetStage = stage.toLowerCase();

    // Business Rule Check: Lost requires loss_reason
    if (targetStage === 'lost' && !loss_reason) {
      return res.status(400).json({
        error: 'Validation error',
        message: 'A loss_reason is required when marking a lead as Lost',
      });
    }

    if (!db.isConnected) {
      return res.status(200).json({ message: 'Stage updated (Dev mock mode)', stage: targetStage });
    }

    // 1. Fetch current lead
    const leadRes = await db.query('SELECT * FROM lead WHERE lead_id = $1', [id]);
    if (leadRes.rows.length === 0) {
      return res.status(404).json({ error: 'Not found', message: 'Lead not found' });
    }
    const currentLead = leadRes.rows[0];
    const previousStage = currentLead.stage;

    // 2. Update lead stage
    const updatedLeadRes = await db.query(
      `UPDATE lead
       SET stage = $1,
           loss_reason = CASE WHEN $1 = 'lost' THEN $2 ELSE loss_reason END,
           updated_at = CURRENT_TIMESTAMP
       WHERE lead_id = $3
       RETURNING *`,
      [targetStage, loss_reason || null, id]
    );
    const updatedLead = updatedLeadRes.rows[0];

    // 3. Log stage change CRM activity
    if (userId) {
      await db.query(
        `INSERT INTO crm_activity (lead_id, user_id, activity_type, subject, description)
         VALUES ($1, $2, 'stage_change', $3, $4)`,
        [
          id,
          userId,
          `Stage changed to ${targetStage.toUpperCase()}`,
          notes || `Moved from ${previousStage} to ${targetStage}${loss_reason ? `. Reason: ${loss_reason}` : ''}`,
        ]
      );
    }

    // 4. If target is 'won', create or link customer and deal
    if (targetStage === 'won') {
      let custRes = await db.query('SELECT * FROM customer WHERE company_id = $1', [currentLead.company_id]);
      let customerId;
      if (custRes.rows.length === 0) {
        const newCust = await db.query(
          `INSERT INTO customer (company_id, account_manager_id, customer_since, status)
           VALUES ($1, $2, CURRENT_DATE, 'active')
           RETURNING customer_id`,
          [currentLead.company_id, currentLead.assigned_to || userId]
        );
        customerId = newCust.rows[0].customer_id;
      } else {
        customerId = custRes.rows[0].customer_id;
      }

      // Create Deal record
      await db.query(
        `INSERT INTO deal (customer_id, lead_id, deal_value, won_on)
         VALUES ($1, $2, $3, CURRENT_DATE)
         ON CONFLICT (lead_id) DO UPDATE SET deal_value = EXCLUDED.deal_value`,
        [customerId, id, deal_value ? parseFloat(deal_value) : 0.0]
      );
    }

    return res.status(200).json({
      message: `Lead successfully moved to ${targetStage}`,
      lead: updatedLead,
      previousStage,
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/v1/crm/leads/:id/assign
 * Assigns lead to a sales team member
 */
const assignLead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { assigned_to } = req.body;
    const managerId = req.user ? req.user.user_id : null;

    if (!assigned_to) {
      return res.status(400).json({ error: 'Validation error', message: 'assigned_to user_id is required' });
    }

    if (!db.isConnected) {
      return res.status(200).json({ message: 'Lead assigned (Dev mock mode)' });
    }

    const result = await db.query(
      `UPDATE lead
       SET assigned_to = $1, assigned_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE lead_id = $2
       RETURNING *`,
      [assigned_to, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not found', message: 'Lead not found' });
    }

    // Create Notification for the assigned salesperson
    await db.query(
      `INSERT INTO notification (user_id, lead_id, notification_type, title, message)
       VALUES ($1, $2, 'lead_assigned', 'New Lead Assigned', $3)`,
      [assigned_to, id, `You have been assigned lead ${result.rows[0].lead_code}`]
    );

    return res.status(200).json({
      message: 'Lead assigned successfully',
      lead: result.rows[0],
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * POST /api/v1/crm/leads/:id/activities
 * Log call, meeting, email, or note and set follow-up
 */
const logActivity = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { activity_type, subject, description, contact_id, follow_up_due } = req.body;
    const userId = req.user ? req.user.user_id : null;

    if (!activity_type || !subject) {
      return res.status(400).json({ error: 'Validation error', message: 'activity_type and subject are required' });
    }

    const validTypes = ['call', 'meeting', 'email', 'note', 'stage_change', 'proposal_sent'];
    if (!validTypes.includes(activity_type.toLowerCase())) {
      return res.status(400).json({ error: 'Validation error', message: `activity_type must be one of: ${validTypes.join(', ')}` });
    }

    if (!db.isConnected) {
      return res.status(201).json({ message: 'Activity logged (Dev mock mode)' });
    }

    const actRes = await db.query(
      `INSERT INTO crm_activity (lead_id, contact_id, user_id, activity_type, subject, description, follow_up_due)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [id, contact_id || null, userId, activity_type.toLowerCase(), subject.trim(), description || null, follow_up_due || null]
    );

    // Update lead's next follow-up date if provided
    if (follow_up_due) {
      await db.query(`UPDATE lead SET next_follow_up_date = $1, updated_at = CURRENT_TIMESTAMP WHERE lead_id = $2`, [follow_up_due, id]);
    }

    return res.status(201).json({
      message: 'Activity logged successfully',
      activity: actRes.rows[0],
    });
  } catch (err) {
    return next(err);
  }
};

/**
 * GET /api/v1/crm/leads/:id/activities
 */
const getActivities = async (req, res, next) => {
  try {
    const { id } = req.params;
    if (!db.isConnected) {
      return res.status(200).json({ activities: [] });
    }

    const result = await db.query(
      `SELECT a.*, u.full_name as author_name, c.full_name as contact_name
       FROM crm_activity a
       JOIN app_user u ON a.user_id = u.user_id
       LEFT JOIN contact c ON a.contact_id = c.contact_id
       WHERE a.lead_id = $1
       ORDER BY a.performed_at DESC`,
      [id]
    );

    return res.status(200).json({ activities: result.rows });
  } catch (err) {
    return next(err);
  }
};

module.exports = {
  getPipeline,
  updateLeadStage,
  assignLead,
  logActivity,
  getActivities,
};
