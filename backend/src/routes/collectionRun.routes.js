const express = require('express');
const {
  triggerCollectionRun,
  listCollectionRuns,
  getCollectionRunById,
} = require('../controllers/collectionRun.controller');
const { authenticate, authorize } = require('../middlewares/auth');

const router = express.Router();

router.use(authenticate);

router.post('/', authorize('admin', 'management', 'research_analyst'), triggerCollectionRun);
router.get('/', listCollectionRuns);
router.get('/:id', getCollectionRunById);

module.exports = router;
