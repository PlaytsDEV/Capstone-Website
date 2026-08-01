const { createMobileAuth } = require('./security/mobileAuthCore');
const mockFirebaseCreateUser = jest.fn(); const mockFirebaseCreateCustomToken = jest.fn(); const mockFirebaseSetCustomUserClaims = jest.fn();
jest.mock('./config/database.js', () => ({ getDb: () => { throw new Error('test dependency not configured'); } }));
jest.mock('./config/firebase.js', () => ({
  verifyFirebaseIdToken: async () => null, verifyTenantInFirebase: async () => null,
  admin: { auth: () => ({ createUser: mockFirebaseCreateUser, createCustomToken: mockFirebaseCreateCustomToken, setCustomUserClaims: mockFirebaseSetCustomUserClaims, updateUser: async () => {}, revokeRefreshTokens: async () => {} }) },
}));
const authController = require('./controllers/auth.controller');
const { invalidateUserSessionsCore } = require('../security/sessionInvalidationCore.cjs');
const express = require('express');
const http = require('http');
const authRoutes = require('./routes/auth.routes.js');

function response() {
  return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, cookie() {} };
}

function database({ user, session } = {}) {
  const state = { user, session, audits: [], deleted: 0, webRevoked: 0 };
  const db = { collection(name) {
    if (name === 'user_sessions') return {
      async findOne(q) { return state.session && q.session_token === state.session.session_token && state.session.expires_at > new Date() ? { ...state.session } : null; },
      async deleteMany() { state.deleted += 1; state.session = null; return { deletedCount: 1 }; },
    };
    if (name === 'users') return {
      async findOne() { return state.user ? { ...state.user } : null; },
      async findOneAndUpdate() { state.user.securityVersion = Number(state.user.securityVersion || 0) + 1; return { ...state.user }; },
    };
    if (name === 'usersessions') return { async updateMany() { state.webRevoked += 1; return { modifiedCount: 1 }; } };
    if (name === 'login_attempts') return { async insertOne(value) { state.audits.push(value); } };
    throw new Error(`Unexpected collection ${name}`);
  } };
  return { db, state };
}

async function run(middleware, req) {
  const res = response(); let nextCalled = false;
  await middleware(req, res, () => { nextCalled = true; });
  return { res, nextCalled };
}

async function postJson(app, path, body) {
  const server = http.createServer(app); await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    const result = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    return { status: result.status, body: await result.json() };
  } finally { await new Promise((resolve) => server.close(resolve)); }
}

describe('Phase 0 mobile authentication behavior', () => {
  test('real registration controller returns 410 without consulting submitted authority fields', async () => {
    const req = { body: { role: 'owner', status: 'active', branch: 'guadalupe' } }; const res = response();
    await authController.register(req, res);
    expect(res.statusCode).toBe(410); expect(res.body.code).toBe('MOBILE_REGISTRATION_DISABLED');
  });

  test('mounted registration route has zero persistent side effects across repeated privileged payloads', async () => {
    const app = express(); app.use(express.json()); app.use('/auth', authRoutes);
    const payload = { email: 'new@example.test', password: 'Password123!', name: 'New', phone: '123', role: 'owner', accountStatus: 'active', tenantStatus: 'active', branchId: 'other', permissions: ['*'], admin: true };
    const first = await postJson(app, '/auth/register', payload);
    const second = await postJson(app, '/auth/register', { ...payload, role: 'tenant' });
    expect(first).toEqual({ status: 410, body: expect.objectContaining({ code: 'MOBILE_REGISTRATION_DISABLED' }) });
    expect(second).toEqual({ status: 410, body: expect.objectContaining({ code: 'MOBILE_REGISTRATION_DISABLED' }) });
    expect(mockFirebaseCreateUser).not.toHaveBeenCalled(); expect(mockFirebaseCreateCustomToken).not.toHaveBeenCalled(); expect(mockFirebaseSetCustomUserClaims).not.toHaveBeenCalled();
    // The configured DB dependency throws on any access; reaching 410 twice proves no
    // user/reservation/tenant/session/OTP insert or update path was consulted.
  });

  test.each([
    ['bearer', { headers: { authorization: 'Bearer good' }, cookies: {}, query: {} }],
    ['cookie', { headers: {}, cookies: { session_token: 'good' }, query: {} }],
  ])('%s token authenticates an active user', async (_name, request) => {
    const { db } = database({ user: { user_id: 'u1', role: 'tenant', tenantStatus: 'active', accountStatus: 'active', securityVersion: 0 }, session: { user_id: 'u1', session_token: 'good', expires_at: new Date(Date.now() + 10000), security_version: 0 } });
    const auth = createMobileAuth({ getDb: () => db }); const result = await run(auth.required, request);
    expect(result.nextCalled).toBe(true); expect(request.user.user_id).toBe('u1');
  });

  test('query token is ignored', async () => {
    const { db } = database(); const auth = createMobileAuth({ getDb: () => db });
    const result = await run(auth.required, { headers: {}, cookies: {}, query: { token: 'good' } });
    expect(result.res.statusCode).toBe(401); expect(result.res.body).not.toEqual(expect.objectContaining({ token: 'good' }));
  });

  test.each([
    ['deactivated', { isActive: false }], ['archived', { isArchived: true }],
    ['suspended', { accountStatus: 'suspended' }], ['banned', { accountStatus: 'banned' }],
  ])('%s account is rejected and its session revoked', async (_name, change) => {
    const { db, state } = database({ user: { user_id: 'u1', role: 'tenant', tenantStatus: 'active', accountStatus: 'active', ...change }, session: { user_id: 'u1', session_token: 'good', expires_at: new Date(Date.now() + 10000), security_version: 0 } });
    const auth = createMobileAuth({ getDb: () => db }); const result = await run(auth.required, { headers: { authorization: 'Bearer good' }, cookies: {} });
    expect(result.res.statusCode).toBe(403); expect(state.deleted).toBe(1);
  });

  test.each(['inactive', 'moved_out', 'evicted', 'blacklisted', 'applicant'])('%s tenant lifecycle cannot enter active-tenant route', async (tenantStatus) => {
    const auth = createMobileAuth({ getDb: () => { throw new Error('unused'); } });
    const result = await run(auth.activeTenant, { user: { user_id: 'u1', role: 'tenant', accountStatus: 'active', tenantStatus } });
    expect(result.res.statusCode).toBe(403);
  });

  test('admin and tenant authorization are separated', async () => {
    const auth = createMobileAuth({ getDb: () => { throw new Error('unused'); } });
    expect((await run(auth.admin, { user: { user_id: 'a', role: 'branch_admin', accountStatus: 'active' } })).nextCalled).toBe(true);
    expect((await run(auth.admin, { user: { user_id: 't', role: 'tenant', tenantStatus: 'active', accountStatus: 'active' } })).res.statusCode).toBe(403);
  });

  test('optional auth treats restricted identity as anonymous', async () => {
    const { db } = database({ user: { user_id: 'u1', role: 'tenant', tenantStatus: 'active', accountStatus: 'suspended' }, session: { user_id: 'u1', session_token: 'good', expires_at: new Date(Date.now() + 10000), security_version: 0 } });
    const auth = createMobileAuth({ getDb: () => db }); const req = { headers: { authorization: 'Bearer good' }, cookies: {} };
    expect((await run(auth.optional, req)).nextCalled).toBe(true); expect(req.user).toBeNull();
  });

  test.each([
    ['no token', null, null],
    ['expired session', { user_id: 'u1', session_token: 'old', expires_at: new Date(0), security_version: 0 }, { accountStatus: 'active' }],
    ['archived identity', { user_id: 'u1', session_token: 'good', expires_at: new Date(Date.now() + 10000), security_version: 0 }, { accountStatus: 'active', isArchived: true }],
  ])('optional auth treats %s as anonymous', async (_name, session, user) => {
    const { db } = database({ user: user && { user_id: 'u1', role: 'tenant', tenantStatus: 'active', securityVersion: 0, ...user }, session });
    const auth = createMobileAuth({ getDb: () => db });
    const req = { headers: session ? { authorization: `Bearer ${session.session_token}` } : {}, cookies: {} };
    expect((await run(auth.optional, req)).nextCalled).toBe(true); expect(req.user).toBeNull();
  });

  test('central invalidation reaches Firebase, web, and mobile stores and is idempotent', async () => {
    const { db, state } = database({ user: { user_id: 'u1', securityVersion: 0 }, session: null });
    let firebaseRevocations = 0;
    const first = await invalidateUserSessionsCore({ db, adminAuth: { revokeRefreshTokens: async () => { firebaseRevocations += 1; } }, userId: 'u1', mongoId: 'm1', firebaseUid: 'f1', reason: 'test' });
    const second = await invalidateUserSessionsCore({ db, adminAuth: { revokeRefreshTokens: async () => { firebaseRevocations += 1; } }, userId: 'u1', mongoId: 'm1', firebaseUid: 'f1', reason: 'test' });
    expect(first.failures).toEqual([]); expect(second.failures).toEqual([]);
    expect(firebaseRevocations).toBe(2); expect(state.webRevoked).toBe(2); expect(state.deleted).toBe(2);
  });

  test('partial physical cleanup failure is reported while logical invalidation rejects old mobile session', async () => {
    const { db, state } = database({ user: { user_id: 'u1', _id: 'm1', firebase_uid: 'f1', role: 'tenant', tenantStatus: 'active', accountStatus: 'active', securityVersion: 0 }, session: { user_id: 'u1', session_token: 'old', expires_at: new Date(Date.now() + 10000), security_version: 0 } });
    const base = db.collection.bind(db); db.collection = (name) => {
      if (name === 'user_sessions') return { ...base(name), async deleteMany() { throw new Error('mobile cleanup failed'); } };
      if (name === 'usersessions') return { async updateMany() { throw new Error('web cleanup failed'); } };
      return base(name);
    };
    const audit = jest.fn(); const result = await invalidateUserSessionsCore({ db, adminAuth: { revokeRefreshTokens: async () => {} }, userId: 'u1', mongoId: 'm1', firebaseUid: 'f1', reason: 'password_reset', audit });
    expect(result.failures.map((f) => f.store)).toEqual(expect.arrayContaining(['web', 'mobile'])); expect(audit).toHaveBeenCalledWith(expect.objectContaining({ failures: expect.arrayContaining(['web', 'mobile']) }));
    const auth = createMobileAuth({ getDb: () => db }); const rejected = await run(auth.required, { headers: { authorization: 'Bearer old' }, cookies: {} });
    expect(rejected.res.statusCode).toBe(403); expect(rejected.res.body.code).toBe('SESSION_REVOKED'); expect(state.user.securityVersion).toBe(1);
  });

  test('security-version increment failure makes invalidation fail closed', async () => {
    const { db } = database({ user: { user_id: 'u1', securityVersion: 0 } }); const base = db.collection.bind(db);
    db.collection = (name) => name === 'users' ? { ...base(name), async findOneAndUpdate() { throw new Error('version unavailable'); } } : base(name);
    const audit = jest.fn(); await expect(invalidateUserSessionsCore({ db, userId: 'u1', reason: 'password_reset', audit })).rejects.toMatchObject({ code: 'SESSION_INVALIDATION_FAILED' });
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ failures: expect.arrayContaining(['securityVersion']) }));
  });

  test('security version rejects an old session even when deletion fails', async () => {
    const { db, state } = database({ user: { user_id: 'u1', _id: 'm1', firebase_uid: 'f1', role: 'tenant', tenantStatus: 'active', accountStatus: 'active', securityVersion: 0 }, session: { user_id: 'u1', session_token: 'old', expires_at: new Date(Date.now() + 10000), security_version: 0 } });
    const originalCollection = db.collection.bind(db); db.collection = (name) => name === 'user_sessions' ? { ...originalCollection(name), async deleteMany() { throw new Error('cleanup unavailable'); } } : originalCollection(name);
    await invalidateUserSessionsCore({ db, adminAuth: { revokeRefreshTokens: async () => {} }, userId: 'u1', mongoId: 'm1', firebaseUid: 'f1', reason: 'test' });
    state.session = { user_id: 'u1', session_token: 'old', expires_at: new Date(Date.now() + 10000), security_version: 0 };
    const auth = createMobileAuth({ getDb: () => db }); const result = await run(auth.required, { headers: { authorization: 'Bearer old' }, cookies: {} });
    expect(result.res.statusCode).toBe(403); expect(result.res.body.code).toBe('SESSION_REVOKED');
  });
});

describe('OTP behavior', () => {
  function otpDb(record) {
    const state = { record: { ...record }, sessions: 0, emails: 0 };
    const db = { collection(name) {
      if (name === 'otp_store') return {
        async findOne(q) { return state.record?.otp_token === q.otp_token ? { ...state.record } : null; },
        async updateOne(q, update) { if (!state.record || q.otp_token !== state.record.otp_token) return { modifiedCount: 0 }; Object.assign(state.record, update.$set || {}); for (const key of Object.keys(update.$unset || {})) delete state.record[key]; if (update.$inc) state.record.attempts += update.$inc.attempts; return { modifiedCount: 1 }; },
        async deleteOne() { state.record = null; },
        async findOneAndDelete(q) { if (!state.record || q.otp_hash !== state.record.otp_hash || state.record.attempts >= 3) return null; const old = state.record; state.record = null; return old; },
        async findOneAndUpdate(q, update) { if (!state.record || state.record.last_sent_at > q.last_sent_at.$lte || state.record.resend_reserved_at) return null; const old = { ...state.record }; Object.assign(state.record, update.$set); return old; },
      };
      if (name === 'users') return { async findOne() { return { securityVersion: 0 }; } };
      if (name === 'user_sessions') return { async deleteMany() {}, async insertOne() { state.sessions += 1; } };
      if (name === 'login_attempts') return { async insertOne() {} };
      throw new Error(name);
    } };
    return { db, state };
  }

  test('correct OTP is consumed once under parallel verification', async () => {
    const code = '246810'; const { db, state } = otpDb({ otp_token: 'c1', otp_hash: authController.__test.hashOtp(code), user_id: 'u1', email: 'masked', attempts: 0, expires_at: new Date(Date.now() + 10000), consumed_at: null });
    authController.__test.setDependencies({ getDb: () => db, createSession: async () => { state.sessions += 1; return { session_token: 'safe' }; } });
    const invoke = async () => { const res = response(); await authController.__test.verifyOtp({ body: { otp_token: 'c1', otp_code: code }, headers: {} }, res); return res; };
    const results = await Promise.all([invoke(), invoke()]);
    expect(results.filter((r) => r.statusCode === 200)).toHaveLength(1); expect(state.sessions).toBe(1);
  });

  test('real session creation persists authoritative version and becomes stale only after increment', async () => {
    const state = { user: { user_id: 'u5', role: 'tenant', tenantStatus: 'active', accountStatus: 'active', securityVersion: 5 }, session: null };
    const db = { collection(name) {
      if (name === 'users') return { async findOne() { return { ...state.user }; } };
      if (name === 'user_sessions') return {
        async deleteMany() { state.session = null; }, async insertOne(doc) { state.session = { ...doc }; },
        async findOne(q) { return state.session && q.session_token === state.session.session_token && state.session.expires_at > new Date() ? { ...state.session } : null; },
      };
      if (name === 'login_attempts') return { async insertOne() {} };
      throw new Error(name);
    } };
    const issued = await authController.__test.createSession(db, 'u5');
    expect(state.session.security_version).toBe(5); expect(issued.session_token).toBe(state.session.session_token);
    const auth = createMobileAuth({ getDb: () => db });
    expect((await run(auth.required, { headers: { authorization: `Bearer ${issued.session_token}` }, cookies: {} })).nextCalled).toBe(true);
    state.user.securityVersion = 6;
    const stale = await run(auth.required, { headers: { authorization: `Bearer ${issued.session_token}` }, cookies: {} });
    expect(stale.res.statusCode).toBe(403); expect(stale.res.body.code).toBe('SESSION_REVOKED');
  });

  test.each([[undefined, 0], ['3', 3]])('session creation normalizes compatible user version %p', async (value, expected) => {
    let inserted; const db = { collection: (name) => name === 'users'
      ? { async findOne() { return { securityVersion: value }; } }
      : { async deleteMany() {}, async insertOne(doc) { inserted = doc; } } };
    await authController.__test.createSession(db, 'u1'); expect(inserted.security_version).toBe(expected);
  });

  test('session creation rejects invalid authoritative version', async () => {
    const db = { collection: (name) => name === 'users' ? { async findOne() { return { securityVersion: 'invalid' }; } } : { async deleteMany() {}, async insertOne() {} } };
    await expect(authController.__test.createSession(db, 'u1')).rejects.toThrow('Invalid account security version');
  });

  test('parallel resend sends only one replacement code', async () => {
    const { db, state } = otpDb({ otp_token: 'c1', otp_hash: authController.__test.hashOtp('111111'), user_id: 'u1', email: 'masked', attempts: 0, expires_at: new Date(Date.now() + 600000), last_sent_at: new Date(Date.now() - 120000) });
    authController.__test.setDependencies({ getDb: () => db, sendLoginOtpEmail: async () => { state.emails += 1; return true; } });
    const invoke = async () => { const res = response(); await authController.__test.resendOtp({ body: { otp_token: 'c1' } }, res); return res; };
    const results = await Promise.all([invoke(), invoke()]);
    expect(state.emails).toBe(1); expect(results.some((r) => r.statusCode === 429)).toBe(true); expect(state.record.otp_code).toBeUndefined();
  });

  test('wrong OTP increments attempts and expiry removes the challenge', async () => {
    const { db, state } = otpDb({ otp_token: 'c1', otp_hash: authController.__test.hashOtp('111111'), user_id: 'u1', email: 'masked', attempts: 0, expires_at: new Date(Date.now() + 10000), consumed_at: null });
    authController.__test.setDependencies({ getDb: () => db });
    let res = response(); await authController.__test.verifyOtp({ body: { otp_token: 'c1', otp_code: '222222' }, headers: {} }, res);
    expect(res.statusCode).toBe(400); expect(state.record.attempts).toBe(1);
    state.record.expires_at = new Date(0); res = response();
    await authController.__test.verifyOtp({ body: { otp_token: 'c1', otp_code: '111111' }, headers: {} }, res);
    expect(res.statusCode).toBe(400); expect(state.record).toBeNull();
  });

  test('maximum OTP attempts block and remove the challenge', async () => {
    const { db, state } = otpDb({ otp_token: 'c1', otp_hash: authController.__test.hashOtp('111111'), user_id: 'u1', email: 'masked', attempts: 3, expires_at: new Date(Date.now() + 10000), consumed_at: null });
    authController.__test.setDependencies({ getDb: () => db }); const res = response();
    await authController.__test.verifyOtp({ body: { otp_token: 'c1', otp_code: '111111' }, headers: {} }, res);
    expect(res.statusCode).toBe(400); expect(state.record).toBeNull();
  });

  test('failed resend delivery preserves the prior OTP and releases reservation', async () => {
    const priorHash = authController.__test.hashOtp('111111');
    const { db, state } = otpDb({ otp_token: 'c1', otp_hash: priorHash, user_id: 'u1', email: 'masked', attempts: 0, expires_at: new Date(Date.now() + 600000), last_sent_at: new Date(Date.now() - 120000) });
    authController.__test.setDependencies({ getDb: () => db, sendLoginOtpEmail: async () => false }); const res = response();
    await authController.__test.resendOtp({ body: { otp_token: 'c1' } }, res);
    expect(res.statusCode).toBe(503); expect(state.record.otp_hash).toBe(priorHash); expect(state.record.resend_reserved_at).toBeUndefined();
  });
});
