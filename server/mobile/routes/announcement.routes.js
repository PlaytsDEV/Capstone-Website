const express = require('express');
const router = express.Router();
const announcementController = require('../controllers/announcement.controller');
const { authMiddleware, adminMiddleware, optionalAuthMiddleware, requireMobilePermission } = require('../middleware/auth');

router.get('/', optionalAuthMiddleware, announcementController.getAllAnnouncements);

// Tenant: dismiss (per-tenant hide) announcements from the News tab only.
// Separate persistence from the Home bell's notification dismissal — see
// dismissAnnouncement()'s comment in announcement.controller.js. Route
// shape (POST .../dismiss, POST dismiss-bulk) matches what the mobile
// client already calls (frontend/src/context/AuthContext.js) — this is the
// same contract the standalone LilyCrest-Mobile backend served, so no
// mobile-side change is required.
router.post('/dismiss-bulk', authMiddleware, announcementController.dismissAnnouncementsBulk);
router.post('/:announcementId/dismiss', authMiddleware, announcementController.dismissAnnouncement);

// Admin: create announcement (pushes notification to all tenants)
router.post('/', authMiddleware, adminMiddleware, requireMobilePermission('manageAnnouncements', { branchScoped: true }), announcementController.createAnnouncement);

module.exports = router;
