const express = require('express');
const {
  listProjects,
  createProject,
  getProjectById,
  linkCompanyToProject,
} = require('../controllers/project.controller');
const { authenticate, authorize } = require('../middlewares/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', listProjects);
router.post('/', authorize('admin', 'management', 'sales_manager', 'research_analyst', 'technical'), createProject);
router.get('/:id', getProjectById);
router.post('/:id/link-company', authorize('admin', 'management', 'sales_manager', 'research_analyst'), linkCompanyToProject);

module.exports = router;
