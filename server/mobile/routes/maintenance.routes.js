const express = require('express');
const router = express.Router();
const maintenanceController = require('../controllers/maintenance.controller');
const { authMiddleware, activeTenantMiddleware } = require('../middleware/auth');

// Tenant routes
router.get('/me', authMiddleware, activeTenantMiddleware, maintenanceController.getMyMaintenance);
router.post('/', authMiddleware, activeTenantMiddleware, maintenanceController.createMaintenance);

// Admin maintenance routes are owned by the web/backend contract router.
// This mobile bridge intentionally exposes tenant-only endpoints.
router.get('/:requestId', authMiddleware, activeTenantMiddleware, maintenanceController.getMaintenanceDetail);
router.post('/:requestId/replies', authMiddleware, activeTenantMiddleware, maintenanceController.sendTenantReply);
router.post('/:requestId/reply', authMiddleware, activeTenantMiddleware, maintenanceController.sendTenantReply);
router.put('/:requestId', authMiddleware, activeTenantMiddleware, maintenanceController.updateMaintenance);
router.patch('/:requestId/cancel', authMiddleware, activeTenantMiddleware, maintenanceController.cancelMaintenance);
router.patch('/:requestId/reopen', authMiddleware, activeTenantMiddleware, maintenanceController.reopenMaintenance);

module.exports = router;
