const express = require('express');
const { listSources, createSource } = require('../controllers/source.controller');
const { authenticate, authorize } = require('../middlewares/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', listSources);
router.post('/', authorize('admin', 'management', 'research_analyst'), createSource);

module.exports = router;
