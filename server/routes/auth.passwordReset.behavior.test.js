import { jest } from '@jest/globals';
import express from 'express';
import http from 'http';
import coreModule from '../security/sessionInvalidationCore.cjs';

const state = { users: [], mobile: [], web: [], audits: [], firebase: [], versionFailure: false, mobileFailure: false, webFailure: false };
const verifyIdToken = jest.fn();
const pass = (_req, _res, next) => next();

function db() {
  return { collection(name) {
    if (name === 'users') return { async findOneAndUpdate(q, update) { if (state.versionFailure) throw new Error('version unavailable'); const user = state.users.find((u) => u.user_id === q.user_id); user.securityVersion += 1; user.authInvalidatedAt = update.$set.authInvalidatedAt; return user; } };
    if (name === 'user_sessions') return { async deleteMany(q) { if (state.mobileFailure) throw new Error('mobile unavailable'); state.mobile = state.mobile.filter((s) => s.user_id !== q.user_id); } };
    if (name === 'usersessions') return { async updateMany(q) { if (state.webFailure) throw new Error('web unavailable'); state.web.filter((s) => s.userId === q.userId).forEach((s) => { s.isActive = false; }); } };
    throw new Error(name);
  } };
}

await jest.unstable_mockModule('../middleware/auth.js', () => ({
  verifyToken: async (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Authentication failed', code: 'AUTHENTICATION_FAILED' });
    try { req.user = await verifyIdToken(token, true); return next(); }
    catch { return res.status(401).json({ error: 'Authentication failed', code: 'AUTHENTICATION_FAILED' }); }
  },
  verifyOnboardingToken: async (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Authentication failed', code: 'AUTHENTICATION_FAILED' });
    try { req.user = await verifyIdToken(token, true); return next(); }
    catch { return res.status(401).json({ error: 'Authentication failed', code: 'AUTHENTICATION_FAILED' }); }
  },
  verifyOwner: pass,
}));
await jest.unstable_mockModule('../middleware/rateLimiter.js', () => ({ publicLimiter: pass, authLimiter: pass }));
await jest.unstable_mockModule('../middleware/validation.js', () => ({ validateRegisterInput: {}, validateProfileUpdateInput: {}, createValidationMiddleware: () => pass, sanitizeEmail: (v) => (typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim().toLowerCase()) ? v.trim().toLowerCase() : null) }));
await jest.unstable_mockModule('../validation/validate.js', () => ({ validate: () => pass }));
await jest.unstable_mockModule('../validation/schemas.js', () => ({ setRoleSchema: {}, updateBranchSchema: {} }));
await jest.unstable_mockModule('../config/firebase.js', () => ({ getAuth: () => ({}) }));
await jest.unstable_mockModule('../utils/auditLogger.js', () => ({ default: { log: jest.fn() } }));
await jest.unstable_mockModule('../models/index.js', () => ({
  User: { findOne: async (q) => state.users.find((u) => u.firebaseUid === q.firebaseUid) || null }, UserSession: {},
}));
await jest.unstable_mockModule('../services/sessionInvalidationService.js', () => ({
  invalidateUserSessions: async ({ user, firebaseUid, reason }) => coreModule.invalidateUserSessionsCore({
    db: db(), adminAuth: { revokeRefreshTokens: async (uid) => { state.firebase.push(uid); } },
    userId: user?.user_id, mongoId: user?._id, firebaseUid: firebaseUid || user?.firebaseUid, reason,
    audit: async (event) => state.audits.push(event),
  }),
}));
await jest.unstable_mockModule('../controllers/authController.js', () => ({ register: pass, login: pass, verifyLoginOtp: pass, resendLoginOtp: pass, logout: pass, getProfile: pass, updateProfile: pass, updateBranch: pass, setRole: pass, logPasswordReset: pass, notifyPasswordChanged: pass }));

const { default: authRoutes } = await import('./authRoutes.js');

async function request(body = {}, token = 'fresh') {
  const app = express(); app.use(express.json()); app.use('/api/auth', authRoutes);
  app.use((_error, _req, res, _next) => res.status(500).json({ error: 'Unable to finalize password reset', code: 'RESET_FINALIZATION_FAILED' }));
  const server = http.createServer(app); await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/auth/finalize-password-reset`, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    return { status: response.status, body: await response.json() };
  } finally { await new Promise((resolve) => server.close(resolve)); }
}

describe('web password reset finalization endpoint', () => {
  beforeEach(() => {
    state.users = [{ _id: 'm1', user_id: 'u1', firebaseUid: 'f1', securityVersion: 2 }]; state.mobile = [{ user_id: 'u1', security_version: 2 }]; state.web = [{ userId: 'm1', isActive: true }]; state.audits = []; state.firebase = [];
    state.versionFailure = false; state.mobileFailure = false; state.webFailure = false; verifyIdToken.mockReset().mockResolvedValue({ uid: 'f1', auth_time: Math.floor(Date.now() / 1000) });
  });

  test('real endpoint derives identity from verified token and invalidates every session store idempotently', async () => {
    const first = await request({ userId: 'attacker-selected' }); const second = await request({ userId: 'different-user' });
    expect(first.status).toBe(200); expect(second.status).toBe(200); expect(verifyIdToken).toHaveBeenCalledWith('fresh', true);
    expect(state.users[0].securityVersion).toBe(4); expect(state.users[0].authInvalidatedAt).toBeInstanceOf(Date);
    expect(state.mobile).toEqual([]); expect(state.web[0].isActive).toBe(false); expect(state.firebase).toEqual(['f1', 'f1']); expect(state.audits).toHaveLength(2);
  });

  test.each([
    ['missing token', '', {}],
    ['tampered token', 'tampered', {}],
    ['revoked token', 'revoked', {}],
  ])('%s cannot invalidate any user', async (_label, token) => {
    if (token) verifyIdToken.mockRejectedValueOnce(new Error('invalid credential'));
    const result = await request({ userId: 'u1' }, token);
    expect(result.status).toBe(401); expect(result.body).toEqual(expect.objectContaining({ code: 'AUTHENTICATION_FAILED' })); expect(state.users[0].securityVersion).toBe(2); expect(state.firebase).toEqual([]);
  });

  test('unknown verified identity still revokes Firebase refresh tokens without touching Mongo sessions', async () => {
    verifyIdToken.mockResolvedValueOnce({ uid: 'unknown' }); const result = await request({ userId: 'u1' });
    expect(result.status).toBe(200); expect(result.body).toEqual({ message: 'Password reset finalized', sessionCleanupComplete: true }); expect(state.users[0].securityVersion).toBe(2); expect(state.firebase).toEqual(['unknown']);
  });

  test('partial physical cleanup is observable after logical invalidation succeeds', async () => {
    state.mobileFailure = true; state.webFailure = true; const result = await request();
    expect(result).toEqual({ status: 200, body: { message: 'Password reset finalized', sessionCleanupComplete: false } });
    expect(state.users[0].securityVersion).toBe(3); expect(state.audits[0].failures).toEqual(expect.arrayContaining(['web', 'mobile']));
  });

  test('security-version failure fails endpoint closed without a success response', async () => {
    state.versionFailure = true; const result = await request();
    expect(result.status).toBe(500); expect(result.body).toEqual(expect.objectContaining({ code: 'RESET_FINALIZATION_FAILED' })); expect(result.body.message).toBeUndefined();
  });
});
