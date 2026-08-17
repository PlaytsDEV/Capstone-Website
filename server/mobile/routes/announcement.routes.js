const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcement.controller');
const { authMiddleware, adminMiddleware, optionalAuthMiddleware, requireMobilePermission } = require('../middleware/auth');

router.get('/', optionalAuthMiddleware, announcementController.getAllAnnouncements);

// Tenant: dismiss (per-tenant hide) a single announcement from the News tab
// only. Separate persistence from the Home bell's notification dismissal —
// see dismissAnnouncement()'s comment in announcement.controller.js.
router.delete('/:announcementId', authMiddleware, announcementController.dismissAnnouncement);

// Admin: create announcement (pushes notification to all tenants)
router.post('/', authMiddleware, adminMiddleware, requireMobilePermission('manageAnnouncements', { branchScoped: true }), announcementController.createAnnouncement);

module.exports = router;
