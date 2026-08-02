const mockGetDb = jest.fn();
const mockVerifyFirebaseIdToken = jest.fn();
const mockUpdateUser = jest.fn();
const mockRevokeRefreshTokens = jest.fn();
const mockAxiosPost = jest.fn();

jest.mock('./config/database.js', () => ({ getDb: (...args) => mockGetDb(...args) }));
jest.mock('./config/firebase.js', () => ({
  verifyFirebaseIdToken: (...args) => mockVerifyFirebaseIdToken(...args),
  verifyTenantInFirebase: jest.fn(),
  admin: { auth: () => ({ updateUser: mockUpdateUser, revokeRefreshTokens: mockRevokeRefreshTokens }) },
}));
jest.mock('axios', () => ({ post: (...args) => mockAxiosPost(...args) }));

const controller = require('./controllers/auth.controller.js');

function response() {
  return { statusCode: 200, body: null, cookies: [], status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, cookie(...args) { this.cookies.push(args); } };
}

function conflictDb() {
  const initial = [
    { _id: 'a', user_id: 'A', email: 'a@example.test', firebase_uid: 'uid-a', role: 'tenant', branch: 'x', accountStatus: 'active', tenantStatus: 'active', securityVersion: 0 },
    { _id: 'b', user_id: 'B', email: 'b@example.test', firebase_uid: 'uid-b', role: 'tenant', branch: 'y', accountStatus: 'active', tenantStatus: 'active', securityVersion: 0 },
  ];
  const state = { users: structuredClone(initial), audits: [], mobileDeletes: 0, webUpdates: 0, sessionInserts: 0, userUpdates: [] };
  const matchesEmail = (value, matcher) => matcher instanceof RegExp && matcher.test(value);
  const users = {
    async findOne(q) {
      if (q.email) return state.users.find((u) => matchesEmail(u.email, q.email) && !q.role?.$nin?.includes(u.role)) || null;
      if (q.google_email) return null;
      if (q.firebase_uid) return state.users.find((u) => u.firebase_uid === q.firebase_uid && !q.role?.$nin?.includes(u.role)) || null;
      if (q.$or) return state.users.find((u) => q.$or.some((part) => u.firebase_uid === part.firebase_uid || u.firebaseUid === part.firebaseUid)) || null;
      if (q.user_id) return state.users.find((u) => u.user_id === q.user_id) || null;
      return null;
    },
    async findOneAndUpdate(q, update) {
      const user = state.users.find((u) => u.user_id === q.user_id);
      if (user && update.$inc?.securityVersion) user.securityVersion += 1;
      if (user && update.$set) Object.assign(user, update.$set);
      return user;
    },
    async updateOne(q, update) { state.userUpdates.push({ q, update }); return { modifiedCount: 1 }; },
  };
  const db = { collection(name) {
    if (name === 'users') return users;
    if (name === 'user_sessions') return { async deleteMany() { state.mobileDeletes += 1; }, async insertOne() { state.sessionInserts += 1; } };
    if (name === 'usersessions') return { async updateMany() { state.webUpdates += 1; }, async insertOne() { state.sessionInserts += 1; } };
    if (name === 'login_attempts') return { async insertOne(record) { state.audits.push(record); } };
    throw new Error(`unexpected collection ${name}`);
  } };
  return { db, state, initial };
}

function assertSafeConflict(result, fixture, email) {
  expect(result.statusCode).toBe(401);
  expect(result.body).toEqual(expect.objectContaining({ code: 'AUTHENTICATION_FAILED' }));
  expect(fixture.state.users.map(({ authInvalidatedAt, securityVersion, ...u }) => u)).toEqual(fixture.initial.map(({ securityVersion, ...u }) => u));
  expect(fixture.state.userUpdates).toEqual([]);
  expect(fixture.state.sessionInserts).toBe(0);
  expect(mockUpdateUser).not.toHaveBeenCalled();
  const serialized = JSON.stringify(fixture.state.audits);
  expect(serialized).not.toContain(email);
  expect(serialized).not.toMatch(/password|id[_ ]?token|session[_ ]?token|reset[_ ]?token/i);
  expect(fixture.state.audits.some((a) => a.reason === 'firebase_uid_conflict')).toBe(true);
}

describe('mobile Firebase UID identity conflicts', () => {
  beforeEach(() => { jest.clearAllMocks(); process.env.FIREBASE_API_KEY = 'test-key'; });

  test.each([
    ['UID belongs to another user', 'b@example.test', 'uid-a'],
    ['stored UID differs from authenticated UID', 'b@example.test', 'uid-unowned'],
  ])('%s fails closed without identity mutation', async (_label, email, authenticatedUid) => {
    const fixture = conflictDb(); mockGetDb.mockReturnValue(fixture.db);
    mockAxiosPost.mockResolvedValue({ data: { localId: authenticatedUid } });
    const res = response(); await controller.login({ body: { email, password: 'correct-password' }, headers: {}, ip: '127.0.0.1' }, res);
    await new Promise((resolve) => setImmediate(resolve));
    assertSafeConflict(res, fixture, email);
    expect(fixture.state.mobileDeletes).toBe(1); expect(fixture.state.webUpdates).toBe(1); expect(mockRevokeRefreshTokens).toHaveBeenCalledWith('uid-b');
  });

  test('email and Google UID resolving to different users fails without mutation', async () => {
    const fixture = conflictDb(); mockGetDb.mockReturnValue(fixture.db);
    mockVerifyFirebaseIdToken.mockResolvedValue({ uid: 'uid-a', email: 'b@example.test', name: 'B' });
    const res = response(); await controller.googleSignIn({ body: { idToken: 'opaque-token' }, headers: {}, ip: '127.0.0.1' }, res);
    await new Promise((resolve) => setImmediate(resolve));
    assertSafeConflict(res, fixture, 'b@example.test');
  });

  test('repeated conflicts remain consistent and create no sessions', async () => {
    const fixture = conflictDb(); mockGetDb.mockReturnValue(fixture.db);
    mockAxiosPost.mockResolvedValue({ data: { localId: 'uid-a' } });
    const results = [];
    for (let i = 0; i < 2; i += 1) { const res = response(); await controller.login({ body: { email: 'b@example.test', password: 'correct-password' }, headers: {} }, res); results.push(res); }
    await new Promise((resolve) => setImmediate(resolve));
    expect(results.map((r) => [r.statusCode, r.body.code])).toEqual([[401, 'AUTHENTICATION_FAILED'], [401, 'AUTHENTICATION_FAILED']]);
    expect(fixture.state.userUpdates).toEqual([]); expect(fixture.state.sessionInserts).toBe(0); expect(fixture.state.audits).toHaveLength(4);
    expect(JSON.stringify(fixture.state.audits)).not.toContain('b@example.test');
  });
});
