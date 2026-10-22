const express = require('express');
const {
  getPipeline,
  updateLeadStage,
  assignLead,
  logActivity,
  getActivities,
} = require('../controllers/crm.controller');
const { authenticate, authorize } = require('../middlewares/auth');

const router = express.Router();

router.use(authenticate);

// Pipeline Kanban board
router.get('/pipeline', getPipeline);

// Stage transitions
router.post('/leads/:id/stage', updateLeadStage);

// Assign lead to salesperson (managers & admin)
router.post('/leads/:id/assign', authorize('admin', 'management', 'sales_manager'), assignLead);

// Activity logging
router.post('/leads/:id/activities', logActivity);
router.get('/leads/:id/activities', getActivities);

module.exports = router;
