const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { authMiddleware, activeTenantMiddleware } = require('../middleware/auth');

router.get('/me', authMiddleware, activeTenantMiddleware, dashboardController.getDashboard);

module.exports = router;
