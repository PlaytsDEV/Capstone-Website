const express = require('express');
const router = express.Router();
const maintenanceController = require('../controllers/maintenance.controller');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

// Tenant routes
router.get('/me', authMiddleware, maintenanceController.getMyMaintenance);
router.post('/', authMiddleware, maintenanceController.createMaintenance);

// Admin routes
router.get('/admin/all', authMiddleware, adminMiddleware, maintenanceController.adminGetAll);
router.patch('/admin/:requestId/status', authMiddleware, adminMiddleware, maintenanceController.adminUpdateStatus);

// Tenant request detail routes must stay after /admin/* routes.
router.get('/:requestId', authMiddleware, maintenanceController.getMaintenanceDetail);
router.post('/:requestId/replies', authMiddleware, maintenanceController.sendTenantReply);
router.post('/:requestId/reply', authMiddleware, maintenanceController.sendTenantReply);
router.put('/:requestId', authMiddleware, maintenanceController.updateMaintenance);
router.patch('/:requestId/cancel', authMiddleware, maintenanceController.cancelMaintenance);
router.patch('/:requestId/reopen', authMiddleware, maintenanceController.reopenMaintenance);

module.exports = router;
