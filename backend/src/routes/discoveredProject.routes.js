const express = require('express');
const {
  listDiscoveredProjects,
  getDiscoveredProjectById,
  reviewDiscoveredProject,
} = require('../controllers/discoveredProject.controller');
const { authenticate, authorize } = require('../middlewares/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', listDiscoveredProjects);
router.get('/:id', getDiscoveredProjectById);
router.put('/:id/review', authorize('admin', 'management', 'research_analyst', 'sales_manager'), reviewDiscoveredProject);

module.exports = router;
