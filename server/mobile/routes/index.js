const { execSync } = require('child_process');
const express = require('express');
const router = express.Router();
const seedRoutes = require('./seed.routes');

// Resolved once at process start, not per-request — the commit a running
// process is serving never changes without a redeploy. Render sets
// RENDER_GIT_COMMIT automatically; `git rev-parse` covers any other host
// that ships the .git dir. This is the release-identity fix ported from the
// (now-bypassed) standalone LilyCrest-Mobile backend's GET /health, moved to
// its actual canonical home: this is the only /api/m/health handler this
// server defines (no canonical bridge exists for it — see mobileRoutes.mjs's
// header comment), and it's the exact path the mobile app calls in
// production (confirmed distinct from this server's own /api/health).
const DEPLOYED_COMMIT = (() => {
  if (process.env.RENDER_GIT_COMMIT) return process.env.RENDER_GIT_COMMIT.slice(0, 9);
  try {
    return execSync('git rev-parse --short HEAD', { cwd: __dirname }).toString().trim();
  } catch (_error) {
    return 'unknown';
  }
})();
const DEPLOYED_AT = new Date().toISOString();

// Auth routes
const authRoutes = require('./auth.routes');
router.use('/auth', authRoutes);

// User routes
const userRoutes = require('./user.routes');
router.use('/users', userRoutes);

// Dashboard routes
const dashboardRoutes = require('./dashboard.routes');
router.use('/dashboard', dashboardRoutes);

// Room routes
const roomRoutes = require('./room.routes');
router.use('/rooms', roomRoutes);

// Billing routes
const billingRoutes = require('./billing.routes');
router.use('/billing', billingRoutes);

// Maintenance routes
const maintenanceRoutes = require('./maintenance.routes');
router.use('/maintenance', maintenanceRoutes);

// Announcement routes
const announcementRoutes = require('./announcement.routes');
router.use('/announcements', announcementRoutes);

// FAQ routes
const faqRoutes = require('./faq.routes');
router.use('/faqs', faqRoutes);

// Ticket routes
const ticketRoutes = require('./ticket.routes');
router.use('/tickets', ticketRoutes);

// Documents routes
const documentRoutes = require('./documents.routes');
router.use('/documents', documentRoutes);

// Chatbot routes
const chatbotRoutes = require('./chatbot.routes');
router.use('/chatbot', chatbotRoutes);

// PayMongo routes
const paymongoRoutes = require('./paymongo.routes');
router.use('/paymongo', paymongoRoutes);

// Seed route (auth only — for demo/presentation use)
router.use('/seed', seedRoutes);

// Health check — also the source of truth for "which commit is this backend
// actually running" (release identity), so a mismatch against a device's
// Profile build-info footer proves a deployment/build gap, not a code bug.
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    backend: 'Node.js/Express',
    auth: 'Firebase-only',
    commit: DEPLOYED_COMMIT,
    deployedAt: DEPLOYED_AT,
    env: process.env.NODE_ENV || 'development',
  });
});

// Root route
router.get('/', (req, res) => {
  res.json({ message: 'Lilycrest Dormitory Management API - Node.js' });
});

module.exports = router;
