const express = require('express');
const router = express.Router();
const maintenanceController = require('../controllers/maintenance.controller');
const { authMiddleware } = require('../middleware/auth');

// Tenant routes
router.get('/me', authMiddleware, maintenanceController.getMyMaintenance);
router.post('/', authMiddleware, maintenanceController.createMaintenance);

// Admin maintenance routes are owned by the web/backend contract router.
// This mobile bridge intentionally exposes tenant-only endpoints.
router.get('/:requestId', authMiddleware, maintenanceController.getMaintenanceDetail);
router.post('/:requestId/replies', authMiddleware, maintenanceController.sendTenantReply);
router.post('/:requestId/reply', authMiddleware, maintenanceController.sendTenantReply);
router.put('/:requestId', authMiddleware, maintenanceController.updateMaintenance);
router.patch('/:requestId/cancel', authMiddleware, maintenanceController.cancelMaintenance);
router.patch('/:requestId/reopen', authMiddleware, maintenanceController.reopenMaintenance);

module.exports = router;
