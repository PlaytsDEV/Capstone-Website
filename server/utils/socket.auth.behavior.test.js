import { jest } from '@jest/globals';

const warn = jest.fn();
await jest.unstable_mockModule('../middleware/logger.js', () => ({ default: { warn, info: jest.fn() } }));
await jest.unstable_mockModule('../models/index.js', () => ({ User: {}, UserSession: {} }));
await jest.unstable_mockModule('../config/firebase.js', () => ({ getAuth: jest.fn() }));
const {
  createSocketAuthenticator,
  emitToChatAdminRooms,
  joinAuthorizedSocketRooms,
} = await import('./socket.js');

function socket(token = 'safe-token', handshake = {}) {
  const rooms = new Set();
  return {
    id: 's1',
    handshake: {
      auth: token ? { token, deviceId: 'test-device' } : {},
      headers: { cookie: 'lilycrest_web_session=test-session' },
      query: {},
      ...handshake,
    },
    conn: { transport: { name: 'websocket' } },
    data: {},
    rooms,
    join: jest.fn((room) => rooms.add(room)),
  };
}

async function authenticate({ token = 'safe-token', verify, user, applicationSession, handshake }) {
  const verifyIdToken = jest.fn(verify || (async () => ({ uid: 'f1', role: 'tenant' })));
  const findUser = jest.fn(async () => user);
  const resolvedSession = applicationSession === undefined
    ? {
        securityVersion: Number(user?.securityVersion || 0),
        assuranceMethod: ['branch_admin', 'owner'].includes(user?.role) ? 'admin_password' : 'login_otp',
        otpVerifiedAt: ['branch_admin', 'owner'].includes(user?.role) ? null : new Date(),
      }
    : applicationSession;
  const findSession = jest.fn(async () => resolvedSession);
  const middleware = createSocketAuthenticator({ getFirebaseAuth: () => ({ verifyIdToken }), findUser, findSession });
  const client = socket(token, handshake); let error;
  await middleware(client, (value) => { error = value; });
  return { client, error, verifyIdToken, findUser, findSession };
}

describe('Socket.IO authentication behavior', () => {
  test('active user connects with revocation-aware verification and sanitized database identity', async () => {
    const user = { _id: 'u1', role: 'tenant', branch: 'x', accountStatus: 'active', isActive: true, isArchived: false };
    const result = await authenticate({ user });
    expect(result.error).toBeUndefined(); expect(result.verifyIdToken).toHaveBeenCalledWith('safe-token', true);
    expect(result.findUser).toHaveBeenCalledWith('f1');
    expect(result.findSession).toHaveBeenCalledWith('u1', 'test-device', 'test-session');
    expect(result.client.data.authUser).toEqual({ userId: 'u1', role: 'tenant', permissions: [], branch: null, accountStatus: 'active' });
  });

  test('revoked token and provider failure reject without attaching or joining', async () => {
    for (const message of ['auth/id-token-revoked', 'provider unavailable']) {
      const result = await authenticate({ verify: async () => { throw new Error(message); }, user: null });
      expect(result.error?.message).toBe('Authentication failed'); expect(result.client.data.authUser).toBeUndefined(); expect(result.client.join).not.toHaveBeenCalled();
    }
  });

  test.each([
    ['deactivated', { accountStatus: 'active', isActive: false }],
    ['suspended', { accountStatus: 'suspended' }],
    ['banned', { accountStatus: 'banned' }],
    ['archived', { accountStatus: 'active', isArchived: true }],
    ['unknown', null],
  ])('%s identity is rejected before private rooms can be joined', async (_label, user) => {
    const result = await authenticate({ user: user && { _id: 'u1', role: 'tenant', branch: 'x', isActive: true, isArchived: false, ...user } });
    expect(result.error?.message).toBe('Authentication failed'); expect(result.client.data.authUser).toBeUndefined(); expect(result.client.join).not.toHaveBeenCalled();
  });

  test('missing token rejects before Firebase or database access', async () => {
    const result = await authenticate({ token: '', user: { accountStatus: 'active' } });
    expect(result.error?.message).toBe('Authentication required'); expect(result.verifyIdToken).not.toHaveBeenCalled(); expect(result.findUser).not.toHaveBeenCalled();
  });

  test('missing database identity with stale owner claims is rejected without trusted context', async () => {
    const result = await authenticate({
      verify: async () => ({ uid: 'deleted-owner', role: 'owner', owner: true, permissions: ['manageUsers'] }),
      user: null,
    });
    expect(result.error?.message).toBe('Authentication failed');
    expect(result.client.data.authUser).toBeUndefined();
    expect(result.client.join).not.toHaveBeenCalled();
  });

  test.each(['applicant', 'tenant'])('%s without an authorized application session is rejected', async (role) => {
    const result = await authenticate({
      user: { _id: 'u1', role, accountStatus: 'active', isActive: true, isArchived: false },
      applicationSession: null,
    });
    expect(result.error?.message).toBe('Authentication failed');
    expect(result.client.data.authUser).toBeUndefined();
  });

  test('expired, revoked, and device/session-mismatched application sessions are rejected', async () => {
    for (const applicationSession of [null, { securityVersion: 1, otpVerifiedAt: new Date() }]) {
      const result = await authenticate({
        user: { _id: 'u1', role: 'tenant', securityVersion: 2, accountStatus: 'active', isActive: true, isArchived: false },
        applicationSession: applicationSession && { ...applicationSession, assuranceMethod: 'login_otp' },
      });
      expect(result.error?.message).toBe('Authentication failed');
    }
  });

  test('applicant first-verified-login session can connect without an OTP timestamp', async () => {
    const result = await authenticate({
      user: { _id: 'u1', role: 'applicant', securityVersion: 0, accountStatus: 'active', isActive: true, isArchived: false },
      applicationSession: { securityVersion: 0, assuranceMethod: 'first_verified_login', otpVerifiedAt: null },
    });
    expect(result.error).toBeUndefined();
  });

  test.each(['branch_admin', 'owner'])('%s requires admin_password assurance while preserving the OTP bypass', async (role) => {
    const user = { _id: 'admin-1', role, securityVersion: 0, accountStatus: 'active', isActive: true, isArchived: false };
    const allowed = await authenticate({ user });
    expect(allowed.error).toBeUndefined();
    expect(allowed.findSession).toHaveBeenCalled();

    for (const applicationSession of [
      null,
      { securityVersion: 0, assuranceMethod: 'first_verified_login', otpVerifiedAt: null },
      { securityVersion: 0, assuranceMethod: 'login_otp', otpVerifiedAt: new Date() },
    ]) {
      const rejected = await authenticate({ user, applicationSession });
      expect(rejected.error?.message).toBe('Authentication failed');
    }
  });

  test('role transition invalidates an assurance that was valid for the prior role', async () => {
    const transitioned = await authenticate({
      user: { _id: 'u1', role: 'tenant', securityVersion: 0, accountStatus: 'active', isActive: true, isArchived: false },
      applicationSession: { securityVersion: 0, assuranceMethod: 'first_verified_login', otpVerifiedAt: null },
    });
    expect(transitioned.error?.message).toBe('Authentication failed');
  });
});

function connectWithIdentity(identity, claims = {}) {
  const client = socket('safe-token', { query: { room: 'admins:all', branch: 'guadalupe' } });
  client.data.authUser = identity;
  client.data.claims = claims;
  joinAuthorizedSocketRooms(client);
  return client;
}

describe('Socket.IO database-authoritative room membership', () => {
  test.each([
    ['owner', { owner: true, role: 'owner', permissions: ['manageUsers'], branch: 'guadalupe' }],
    ['branch admin', { branch_admin: true, role: 'branch_admin', permissions: ['manageUsers'], branch: 'guadalupe' }],
  ])('database tenant with stale %s claims joins no admin room', async (_label, claims) => {
    const result = await authenticate({
      verify: async () => ({ uid: 'tenant-firebase', ...claims }),
      user: { _id: 'tenant-1', role: 'tenant', permissions: [], branch: 'gil-puyat', accountStatus: 'active', isActive: true, isArchived: false },
    });
    expect(result.error).toBeUndefined();
    joinAuthorizedSocketRooms(result.client);
    expect([...result.client.rooms]).toEqual(['user:tenant-1']);
  });

  test('database owner joins global admin rooms when token claims say tenant', async () => {
    const result = await authenticate({
      verify: async () => ({ uid: 'owner-firebase', role: 'tenant' }),
      user: { _id: 'owner-1', role: 'owner', permissions: [], branch: null, accountStatus: 'active', isActive: true, isArchived: false },
    });
    expect(result.error).toBeUndefined();
    joinAuthorizedSocketRooms(result.client);
    expect(result.client.rooms).toEqual(new Set(['user:owner-1', 'admins', 'admins:all']));
  });

  test('permitted branch admin joins only its authoritative database branch', () => {
    const client = connectWithIdentity(
      { userId: 'admin-a', role: 'branch_admin', permissions: ['manageUsers'], branch: 'gil-puyat', accountStatus: 'active' },
      { role: 'owner', owner: true, branch: 'guadalupe' },
    );
    expect(client.rooms).toEqual(new Set(['user:admin-a', 'admins', 'admins:branch:gil-puyat']));
    expect(client.rooms.has('admins:all')).toBe(false);
    expect(client.rooms.has('admins:branch:guadalupe')).toBe(false);
  });

  test.each([
    ['missing branch', { userId: 'admin-a', role: 'branch_admin', permissions: ['manageUsers'], branch: null, accountStatus: 'active' }],
    ['invalid branch', { userId: 'admin-a', role: 'branch_admin', permissions: ['manageUsers'], branch: 'other', accountStatus: 'active' }],
  ])('branch admin with %s joins no branch room', (_label, identity) => {
    const client = connectWithIdentity(identity, { owner: true, branch: 'guadalupe' });
    expect([...client.rooms]).toEqual(['user:admin-a', 'admins']);
    expect(client.rooms.has('admins:all')).toBe(false);
    expect(client.rooms.has('admins:branch:gil-puyat')).toBe(false);
  });

  test('client-provided room and branch values cannot request privileged membership', () => {
    const client = connectWithIdentity(
      { userId: 'tenant-1', role: 'tenant', permissions: [], branch: 'gil-puyat', accountStatus: 'active' },
      {},
    );
    expect(client.join).toHaveBeenCalledTimes(1);
    expect(client.rooms.has('admins:all')).toBe(false);
    expect(client.rooms.has('admins:branch:guadalupe')).toBe(false);
  });

  test('private branch chat broadcast reaches only the database owner and correct permitted branch admin', () => {
    const clients = [
      connectWithIdentity({ userId: 'owner-1', role: 'owner', permissions: [], branch: null, accountStatus: 'active' }, { role: 'tenant' }),
      connectWithIdentity({ userId: 'admin-a', role: 'branch_admin', permissions: ['manageUsers'], branch: 'gil-puyat', accountStatus: 'active' }),
      connectWithIdentity({ userId: 'admin-b', role: 'branch_admin', permissions: ['manageUsers'], branch: 'guadalupe', accountStatus: 'active' }),
      connectWithIdentity({ userId: 'tenant-1', role: 'tenant', permissions: [], branch: 'gil-puyat', accountStatus: 'active' }, { owner: true, branch_admin: true }),
      connectWithIdentity({ userId: 'admin-no-permission', role: 'branch_admin', permissions: [], branch: 'gil-puyat', accountStatus: 'active' }),
    ];
    const delivered = [];
    const targets = [];
    const io = {
      to(room) {
        targets.push(room);
        return this;
      },
      emit(event, payload) {
        for (const client of clients) {
          if (targets.some((room) => client.rooms.has(room))) delivered.push(client.data.authUser.userId);
        }
        expect(event).toBe('chat:message-new');
        expect(payload).toEqual({ conversationId: 'conversation-a' });
      },
    };

    emitToChatAdminRooms(io, 'gil-puyat', 'chat:message-new', { conversationId: 'conversation-a' });
    expect(delivered).toEqual(['owner-1', 'admin-a']);
  });
});
