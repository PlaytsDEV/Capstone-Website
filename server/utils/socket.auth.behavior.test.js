import { jest } from '@jest/globals';

const warn = jest.fn();
await jest.unstable_mockModule('../middleware/logger.js', () => ({ default: { warn, info: jest.fn() } }));
await jest.unstable_mockModule('../models/index.js', () => ({ User: {} }));
await jest.unstable_mockModule('../config/firebase.js', () => ({ getAuth: jest.fn() }));
const { createSocketAuthenticator } = await import('./socket.js');

function socket(token = 'safe-token') {
  return { id: 's1', handshake: { auth: token ? { token } : {}, headers: {}, query: {} }, conn: { transport: { name: 'websocket' } }, data: {}, join: jest.fn() };
}

async function authenticate({ token = 'safe-token', verify, user }) {
  const verifyIdToken = jest.fn(verify || (async () => ({ uid: 'f1', role: 'tenant' })));
  const findUser = jest.fn(async () => user);
  const middleware = createSocketAuthenticator({ getFirebaseAuth: () => ({ verifyIdToken }), findUser });
  const client = socket(token); let error;
  await middleware(client, (value) => { error = value; });
  return { client, error, verifyIdToken, findUser };
}

describe('Socket.IO authentication behavior', () => {
  test('active user connects with revocation-aware verification and approved projected data', async () => {
    const user = { _id: 'u1', role: 'tenant', branch: 'x', accountStatus: 'active', isActive: true, isArchived: false };
    const result = await authenticate({ user });
    expect(result.error).toBeUndefined(); expect(result.verifyIdToken).toHaveBeenCalledWith('safe-token', true);
    expect(result.findUser).toHaveBeenCalledWith('f1'); expect(result.client.data.user).toEqual(user);
  });

  test('revoked token and provider failure reject without attaching or joining', async () => {
    for (const message of ['auth/id-token-revoked', 'provider unavailable']) {
      const result = await authenticate({ verify: async () => { throw new Error(message); }, user: null });
      expect(result.error?.message).toBe('Authentication failed'); expect(result.client.data.user).toBeUndefined(); expect(result.client.join).not.toHaveBeenCalled();
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
    expect(result.error?.message).toBe('User not allowed'); expect(result.client.data.user).toBeUndefined(); expect(result.client.join).not.toHaveBeenCalled();
  });

  test('missing token rejects before Firebase or database access', async () => {
    const result = await authenticate({ token: '', user: { accountStatus: 'active' } });
    expect(result.error?.message).toBe('Authentication required'); expect(result.verifyIdToken).not.toHaveBeenCalled(); expect(result.findUser).not.toHaveBeenCalled();
  });
});
