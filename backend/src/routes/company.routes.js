const express = require('express');
const {
  listCompanies,
  createCompany,
  getCompanyById,
  updateCompany,
  verifyCompany,
} = require('../controllers/company.controller');
const { authenticate, authorize } = require('../middlewares/auth');

const router = express.Router();

// All company operations require authentication
router.use(authenticate);

router.get('/', listCompanies);
router.post('/', authorize('admin', 'management', 'sales_manager', 'research_analyst'), createCompany);
router.get('/:id', getCompanyById);
router.put('/:id', authorize('admin', 'management', 'sales_manager', 'research_analyst'), updateCompany);
router.post('/:id/verify', authorize('admin', 'management', 'sales_manager', 'research_analyst'), verifyCompany);

module.exports = router;
