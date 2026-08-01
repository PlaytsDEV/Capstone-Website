const { getDb } = require('../config/database');
const { createMobileAuth } = require('../security/mobileAuthCore');

const audit = async ({ db, req, user, reason }) => {
  await db.collection('login_attempts').insertOne({
    user_id: user?.user_id || null,
    success: false,
    reason,
    ip: req.ip || req.headers['x-forwarded-for'] || 'unknown',
    user_agent: req.headers['user-agent'] || 'unknown',
    timestamp: new Date(),
  }).catch(() => {});
};

const core = createMobileAuth({ getDb, audit });
module.exports = {
  authMiddleware: core.required,
  activeTenantMiddleware: core.activeTenant,
  adminMiddleware: core.admin,
  requireMobilePermission: core.requirePermission,
  ownerMiddleware: core.owner,
  optionalAuthMiddleware: core.optional,
  __mobileAuthCore: createMobileAuth,
};
