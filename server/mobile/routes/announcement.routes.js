const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcement.controller');
const { authMiddleware, adminMiddleware, optionalAuthMiddleware, requireMobilePermission } = require('../middleware/auth');

router.get('/', optionalAuthMiddleware, announcementController.getAllAnnouncements);

// Admin: create announcement (pushes notification to all tenants)
router.post('/', authMiddleware, adminMiddleware, requireMobilePermission('manageAnnouncements', { branchScoped: true }), announcementController.createAnnouncement);

module.exports = router;
