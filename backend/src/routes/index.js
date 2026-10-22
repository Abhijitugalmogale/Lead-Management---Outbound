const express = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const companyRoutes = require('./company.routes');
const projectRoutes = require('./project.routes');
const contactRoutes = require('./contact.routes');
const leadRoutes = require('./lead.routes');
const crmRoutes = require('./crm.routes');
const enquiryRoutes = require('./enquiry.routes');
const analyticsRoutes = require('./analytics.routes');

// Outbound Discovery Module Routes
const sourceRoutes = require('./source.routes');
const collectionRunRoutes = require('./collectionRun.routes');
const discoveredProjectRoutes = require('./discoveredProject.routes');
const uploadRoutes = require('./upload.routes');

const router = express.Router();

// Mount Core & Diagnostic Routes
router.use('/', healthRoutes);
router.use('/auth', authRoutes);
router.use('/companies', companyRoutes);
router.use('/projects', projectRoutes);
router.use('/contacts', contactRoutes);
router.use('/leads', leadRoutes);
router.use('/crm', crmRoutes);
router.use('/analytics', analyticsRoutes);

// Mount Outbound Lead Discovery Module Routes
router.use('/sources', sourceRoutes);
router.use('/collection-runs', collectionRunRoutes);
router.use('/discovered-projects', discoveredProjectRoutes);
router.use('/outbound', uploadRoutes);

module.exports = router;
