const express = require('express');
const router = express.Router();
const maintenanceController = require('../controllers/maintenance.controller');
const { authMiddleware, activeTenantMiddleware } = require('../middleware/auth');

// Tenant routes
router.get('/', authMiddleware, activeTenantMiddleware, maintenanceController.getMyMaintenance);
router.get('/me', authMiddleware, activeTenantMiddleware, maintenanceController.getMyMaintenance);
router.post('/', authMiddleware, activeTenantMiddleware, maintenanceController.createMaintenance);

// Detail and interaction routes
router.get('/:requestId', authMiddleware, activeTenantMiddleware, maintenanceController.getMaintenanceDetail);
router.post('/:requestId/replies', authMiddleware, activeTenantMiddleware, maintenanceController.sendTenantReply);
router.post('/:requestId/reply', authMiddleware, activeTenantMiddleware, maintenanceController.sendTenantReply);
router.put('/:requestId', authMiddleware, activeTenantMiddleware, maintenanceController.updateMaintenance);
router.patch('/:requestId', authMiddleware, activeTenantMiddleware, maintenanceController.updateMaintenance);
router.patch('/:requestId/cancel', authMiddleware, activeTenantMiddleware, maintenanceController.cancelMaintenance);
router.post('/:requestId/cancel', authMiddleware, activeTenantMiddleware, maintenanceController.cancelMaintenance);
router.patch('/:requestId/reopen', authMiddleware, activeTenantMiddleware, maintenanceController.reopenMaintenance);
router.post('/:requestId/reopen', authMiddleware, activeTenantMiddleware, maintenanceController.reopenMaintenance);
router.patch('/:requestId/confirm-resolved', authMiddleware, activeTenantMiddleware, maintenanceController.confirmMaintenanceResolved);
router.post('/:requestId/confirm-resolved', authMiddleware, activeTenantMiddleware, maintenanceController.confirmMaintenanceResolved);
router.patch('/:requestId/confirm', authMiddleware, activeTenantMiddleware, maintenanceController.confirmMaintenanceResolved);
router.post('/:requestId/confirm', authMiddleware, activeTenantMiddleware, maintenanceController.confirmMaintenanceResolved);

module.exports = router;

