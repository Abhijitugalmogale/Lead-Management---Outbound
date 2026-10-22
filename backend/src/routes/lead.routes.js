const express = require('express');
const {
  listLeads,
  createLead,
  getLeadById,
  verifyLead,
  rescoreLead,
  addServiceNeed,
} = require('../controllers/lead.controller');
const { authenticate, authorize } = require('../middlewares/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', listLeads);
router.post('/', authorize('admin', 'management', 'sales_manager', 'research_analyst', 'marketing'), createLead);
router.get('/:id', getLeadById);
router.post('/:id/verify', authorize('admin', 'management', 'sales_manager', 'research_analyst'), verifyLead);
router.post('/:id/rescore', authorize('admin', 'management', 'sales_manager', 'research_analyst', 'salesperson'), rescoreLead);
router.post('/:id/needs', authorize('admin', 'management', 'sales_manager', 'research_analyst', 'salesperson'), addServiceNeed);

module.exports = router;
