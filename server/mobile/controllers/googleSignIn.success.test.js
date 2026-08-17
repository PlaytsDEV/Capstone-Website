const mockGetDb = jest.fn();
const mockVerifyFirebaseIdToken = jest.fn();

jest.mock('../config/database.js', () => ({ getDb: (...args) => mockGetDb(...args) }));
jest.mock('../config/firebase.js', () => ({
  verifyFirebaseIdToken: (...args) => mockVerifyFirebaseIdToken(...args),
  verifyTenantInFirebase: jest.fn(),
  admin: { auth: () => ({ updateUser: jest.fn(), revokeRefreshTokens: jest.fn() }) },
}));

const controller = require('./auth.controller.js');

function response() {
  return {
    statusCode: 200,
    body: null,
    cookies: [],
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    cookie(...args) { this.cookies.push(args); },
  };
}

// Successful Google sign-in for an already-linked, active tenant. This
// pins the post-optimization response contract: googleSignIn no longer
// re-fetches the user document after createSession() — the response body
// is built from the tenant doc already in memory plus the fields just
// written — so this test also asserts on findOne('users') call count to
// prove the redundant round trip is actually gone, not just that the
// shape happens to still match.
describe('googleSignIn success path', () => {
  beforeEach(() => jest.clearAllMocks());

  test('returns canonical stored profile fields without allowing Firebase metadata to overwrite them', async () => {
    const storedUser = {
      _id: 'mongo-id-1',
      user_id: 'U1',
      email: 'tenant@example.test',
      firebase_uid: 'uid-1',
      role: 'tenant',
      accountStatus: 'active',
      tenantStatus: 'active',
      securityVersion: 3,
      name: 'Canonical Name',
      picture: 'https://example.test/canonical.png',
    };

    let usersFindOneCalls = 0;
    const usersCollection = {
      async findOne(query) {
        usersFindOneCalls += 1;
        if (query.email) return storedUser;
        if (query.$or) return storedUser;
        if (query.user_id) return storedUser; // createSession's securityVersion fetch
        return null;
      },
      updateOne: jest.fn(async () => ({ modifiedCount: 1 })),
    };
    const sessionsCollection = {
      async findOne() { return null; }, // no recent session — normal rotation path
      async deleteMany() {},
      async insertOne() {},
    };
    const db = {
      collection(name) {
        if (name === 'users') return usersCollection;
        if (name === 'user_sessions') return sessionsCollection;
        if (name === 'login_attempts') return { async insertOne() {} };
        throw new Error(`unexpected collection ${name}`);
      },
    };
    mockGetDb.mockReturnValue(db);
    mockVerifyFirebaseIdToken.mockResolvedValue({
      uid: 'uid-1',
      email: 'tenant@example.test',
      name: 'Stale Firebase Name',
      picture: 'https://example.test/stale-firebase.png',
    });

    const res = response();
    await controller.googleSignIn({ body: { idToken: 'opaque-token' }, headers: {}, ip: '127.0.0.1' }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.session_token).toEqual(expect.stringMatching(/^session_/));
    expect(res.body.user).toEqual(expect.objectContaining({
      user_id: 'U1',
      role: 'tenant',
      tenantStatus: 'active',
      name: 'Canonical Name',
      picture: 'https://example.test/canonical.png',
      google_email: 'tenant@example.test',
    }));
    expect(res.body.user._id).toBeUndefined();
    const persistedSet = usersCollection.updateOne.mock.calls[0][1].$set;
    expect(persistedSet.name).toBeUndefined();
    expect(persistedSet.picture).toBeUndefined();

    // Exactly 3 users.findOne calls: (1) the email-match tenant lookup,
    // (2) the firebase_uid conflict check, (3) createSession's
    // securityVersion fetch. No 4th call for a post-session getCleanUser
    // re-fetch — that redundant round trip is what this test pins.
    expect(usersFindOneCalls).toBe(3);
  });

  // Pins the idempotency guard added for the mobile client's connect-timeout
  // retry: when a session for this user was already minted moments ago
  // (the scenario a retry after a connection stall produces), googleSignIn
  // must reuse it verbatim rather than deleting it and minting a new one.
  test('reuses a just-minted session instead of rotating when called again within the idempotency window', async () => {
    const storedUser = {
      _id: 'mongo-id-2',
      user_id: 'U2',
      email: 'retry@example.test',
      firebase_uid: 'uid-2',
      role: 'tenant',
      accountStatus: 'active',
      tenantStatus: 'active',
      securityVersion: 0,
      name: 'Retry Tenant',
      picture: null,
    };
    const existingSession = {
      user_id: 'U2',
      session_token: 'session_existing_from_first_attempt',
      expires_at: new Date(Date.now() + 60_000),
      created_at: new Date(Date.now() - 2_000), // minted 2s ago
      security_version: 0,
    };

    const usersCollection = {
      async findOne(query) {
        if (query.email) return storedUser;
        if (query.$or) return storedUser;
        return null;
      },
      async updateOne() { return { modifiedCount: 1 }; },
    };
    let deleteManyCalls = 0;
    let insertOneCalls = 0;
    const sessionsCollection = {
      async findOne(query) {
        if (query.user_id === 'U2' && query.created_at) return existingSession;
        return null;
      },
      async deleteMany() { deleteManyCalls += 1; },
      async insertOne() { insertOneCalls += 1; },
    };
    const db = {
      collection(name) {
        if (name === 'users') return usersCollection;
        if (name === 'user_sessions') return sessionsCollection;
        if (name === 'login_attempts') return { async insertOne() {} };
        throw new Error(`unexpected collection ${name}`);
      },
    };
    mockGetDb.mockReturnValue(db);
    mockVerifyFirebaseIdToken.mockResolvedValue({ uid: 'uid-2', email: 'retry@example.test' });

    const res = response();
    await controller.googleSignIn({ body: { idToken: 'opaque-token' }, headers: {}, ip: '127.0.0.1' }, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.session_token).toBe('session_existing_from_first_attempt');
    // createSession's rotation path (deleteMany + insertOne) must never run
    // when an in-window session is reused.
    expect(deleteManyCalls).toBe(0);
    expect(insertOneCalls).toBe(0);
  });
});
