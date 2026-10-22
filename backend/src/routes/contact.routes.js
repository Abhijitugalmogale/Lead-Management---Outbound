const express = require('express');
const {
  listContacts,
  createContact,
  verifyContact,
} = require('../controllers/contact.controller');
const { authenticate, authorize } = require('../middlewares/auth');

const router = express.Router();

router.use(authenticate);

router.get('/', listContacts);
router.post('/', authorize('admin', 'management', 'sales_manager', 'research_analyst', 'salesperson'), createContact);
router.post('/:id/verify', authorize('admin', 'management', 'sales_manager', 'research_analyst'), verifyContact);

module.exports = router;
