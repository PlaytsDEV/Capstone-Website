const { evaluateAccount, evaluateTenant } = require('../../security/mobileTenantEligibility.cjs');
const ADMIN_ROLES = new Set(['branch_admin', 'owner']);

function extractSessionToken(req) {
  const header = req.headers?.authorization;
  if (typeof header === 'string' && header.startsWith('Bearer ')) return header.slice(7);
  return req.cookies?.session_token || null;
}

function evaluateAdmin(user) {
  const account = evaluateAccount(user);
  if (!account.allowed) return account;
  return ADMIN_ROLES.has(String(user.role || '').toLowerCase())
    ? { allowed: true }
    : { allowed: false, code: 'ADMIN_ACCESS_REQUIRED' };
}

function createMobileAuth({ getDb, audit = async () => {} }) {
  async function resolve(req) {
    const token = extractSessionToken(req);
    if (!token) return { authenticated: false, code: 'NOT_AUTHENTICATED' };
    const db = getDb();
    const session = await db.collection('user_sessions').findOne({ session_token: token, expires_at: { $gt: new Date() } });
    if (!session?.user_id) return { authenticated: false, code: 'SESSION_INVALID', db, session };
    const user = await db.collection('users').findOne({ user_id: session.user_id });
    if (!user) return { authenticated: false, code: 'SESSION_INVALID', db, session };
    const account = evaluateAccount(user);
    const currentVersion = Number(user.securityVersion ?? user.security_version ?? 0);
    const sessionVersion = Number(session.security_version ?? 0);
    const versionsValid = Number.isSafeInteger(currentVersion) && currentVersion >= 0 && Number.isSafeInteger(sessionVersion) && sessionVersion >= 0;
    if (!account.allowed || !versionsValid || sessionVersion !== currentVersion) {
      await db.collection('user_sessions').deleteMany({ user_id: session.user_id }).catch(() => {});
      await audit({ db, req, user, reason: account.allowed ? 'session_version_mismatch' : 'session_account_restricted' });
      return { authenticated: false, code: account.allowed ? 'SESSION_REVOKED' : account.code, db, session, user };
    }
    return { authenticated: true, db, session, user };
  }

  async function required(req, res, next) {
    try {
      const result = await resolve(req);
      if (!result.authenticated) return res.status(result.code === 'NOT_AUTHENTICATED' || result.code === 'SESSION_INVALID' ? 401 : 403).json({ detail: 'Authentication is required. Please sign in again.', code: result.code });
      req.user = result.user; req.mobileSession = result.session; return next();
    } catch (_) { return res.status(401).json({ detail: 'Authentication failed.', code: 'AUTHENTICATION_FAILED' }); }
  }

  async function optional(req, _res, next) {
    req.user = null;
    try { const result = await resolve(req); if (result.authenticated) req.user = result.user; } catch (_) { /* anonymous */ }
    return next();
  }

  function activeTenant(req, res, next) {
    const result = evaluateTenant(req.user);
    return result.allowed ? next() : res.status(403).json({ detail: 'Active tenant access is required.', code: result.code });
  }

  function admin(req, res, next) {
    const result = evaluateAdmin(req.user);
    return result.allowed ? next() : res.status(403).json({ detail: 'Administrative access is required.', code: result.code });
  }

  function requirePermission(permission, { branchScoped = false } = {}) {
    return (req, res, next) => {
      const adminAccess = evaluateAdmin(req.user);
      if (!adminAccess.allowed) return res.status(403).json({ detail: 'Administrative access is required.', code: adminAccess.code });
      const role = String(req.user.role || '').toLowerCase();
      if (role === 'owner') { req.mobileBranchScope = null; return next(); }
      const permissions = Array.isArray(req.user.permissions) ? req.user.permissions : [];
      if (!permissions.includes(permission)) return res.status(403).json({ detail: 'Administrative permission is required.', code: 'PERMISSION_DENIED' });
      if (branchScoped) {
        const branch = String(req.user.branch || '').trim();
        if (!branch) return res.status(403).json({ detail: 'Administrative branch access is required.', code: 'BRANCH_ACCESS_DENIED' });
        const requested = req.body?.targetBranch ?? req.body?.branch ?? req.body?.branchId ?? req.body?.branch_id ?? req.query?.branch ?? req.params?.branch;
        if (requested && String(requested) !== branch) return res.status(403).json({ detail: 'Administrative branch access is required.', code: 'BRANCH_ACCESS_DENIED' });
        req.mobileBranchScope = branch;
      }
      return next();
    };
  }

  function owner(req, res, next) {
    return String(req.user?.role || '').toLowerCase() === 'owner'
      ? next()
      : res.status(403).json({ detail: 'Owner access is required.', code: 'OWNER_ACCESS_REQUIRED' });
  }

  return { required, optional, activeTenant, admin, requirePermission, owner, resolve };
}

module.exports = { createMobileAuth, extractSessionToken, evaluateAccount, evaluateTenant, evaluateAdmin };
