const mockGetDb = jest.fn();
jest.mock('../config/database.js', () => ({ getDb: (...args) => mockGetDb(...args) }));
// The real 'uuid' package (v13) is ESM-only and cannot be required from this
// CJS test file — stub it, matching the pattern needed by every vendored
// mobile controller test that transitively requires a controller using it.
jest.mock('uuid', () => ({ v4: () => 'test-uuid-0000-0000-0000-000000000000' }));

const { getMe, updateMe, sanitizeUserForClient, normalizeUser } = require('./user.controller.js');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function makeDb(users) {
  return {
    collection(name) {
      if (name !== 'users') throw new Error(`unexpected collection: ${name}`);
      return {
        async findOne(query, options) {
          const user = Object.values(users).find((u) => {
            if (query.user_id && query.user_id.$ne) return u.user_id !== query.user_id.$ne && (!query.username || query.username.test(u.username || ''));
            if (query.user_id) return u.user_id === query.user_id;
            return false;
          });
          return user || null;
        },
        async updateOne(filter, update) {
          const user = users[filter.user_id];
          if (user) Object.assign(user, update.$set);
          return { matchedCount: user ? 1 : 0 };
        },
      };
    },
  };
}

describe('user.controller getMe — client-visible field allowlist', () => {
  beforeEach(() => { mockGetDb.mockReset(); });

  test('never leaks fields outside the allowlist (e.g. push_token, internal flags)', async () => {
    const users = {
      't1': {
        user_id: 't1', email: 'a@b.com', name: 'Ana', username: 'ana', phone: '+639171234567',
        push_token: 'secret-device-token', push_tokens: [{ token: 'x' }], role: 'tenant',
        password_hash: 'should-never-leak', lastUsernameChangedAt: null, someAdminOnlyFlag: true,
      },
    };
    mockGetDb.mockReturnValue(makeDb(users));
    const req = { user: { user_id: 't1' } };
    const res = response();
    await getMe(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.push_token).toBeUndefined();
    expect(res.body.push_tokens).toBeUndefined();
    expect(res.body.password_hash).toBeUndefined();
    expect(res.body.someAdminOnlyFlag).toBeUndefined();
    expect(res.body.email).toBe('a@b.com');
    expect(res.body.username).toBe('ana');
  });

  test('404 when the user cannot be found', async () => {
    mockGetDb.mockReturnValue(makeDb({}));
    const req = { user: { user_id: 'ghost' } };
    const res = response();
    await getMe(req, res);
    expect(res.statusCode).toBe(404);
  });
});

describe('sanitizeUserForClient', () => {
  test('drops any field not on the allowlist', () => {
    const safe = sanitizeUserForClient({ user_id: 'x', email: 'e', push_token: 'leak', role: 'tenant', hashedPassword: 'nope' });
    expect(safe).toEqual({ user_id: 'x', email: 'e', role: 'tenant' });
  });
});

describe('user.controller updateMe — field allowlist + username cooldown', () => {
  beforeEach(() => { mockGetDb.mockReset(); });

  test('name/email/address are silently ignored — never applied, matching admin-managed business rule', async () => {
    const users = { t1: { user_id: 't1', username: 'ana', name: 'Ana', email: 'a@b.com', address: '123 St' } };
    mockGetDb.mockReturnValue(makeDb(users));
    const req = { user: { user_id: 't1' }, body: { name: 'Hacker', email: 'new@evil.com', address: 'nowhere', phone: '+639171234567' } };
    const res = response();
    await updateMe(req, res);
    expect(res.statusCode).toBe(200);
    expect(users.t1.name).toBe('Ana');
    expect(users.t1.email).toBe('a@b.com');
    expect(users.t1.address).toBe('123 St');
    expect(users.t1.phone).toBe('+639171234567');
  });

  test('changing username within 7 days of the last change is rejected with 429 USERNAME_COOLDOWN', async () => {
    const users = { t1: { user_id: 't1', username: 'ana', lastUsernameChangedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) } };
    mockGetDb.mockReturnValue(makeDb(users));
    const req = { user: { user_id: 't1' }, body: { username: 'newname' } };
    const res = response();
    await updateMe(req, res);
    expect(res.statusCode).toBe(429);
    expect(res.body.code).toBe('USERNAME_COOLDOWN');
    expect(res.body.errors.username).toBeTruthy();
    expect(res.body.nextAllowedAt).toBeInstanceOf(Date);
    expect(res.body.serverTime).toBeInstanceOf(Date);
    expect(users.t1.username).toBe('ana');
  });

  test('changing username after the cooldown window has passed succeeds and resets lastUsernameChangedAt', async () => {
    const users = { t1: { user_id: 't1', username: 'ana', lastUsernameChangedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000) } };
    mockGetDb.mockReturnValue(makeDb(users));
    const req = { user: { user_id: 't1' }, body: { username: 'newname' } };
    const res = response();
    await updateMe(req, res);
    expect(res.statusCode).toBe(200);
    expect(users.t1.username).toBe('newname');
    expect(users.t1.lastUsernameChangedAt).toBeInstanceOf(Date);
  });

  test('resubmitting the same (current) username is a no-op — never triggers the cooldown check', async () => {
    const users = { t1: { user_id: 't1', username: 'ana', lastUsernameChangedAt: new Date() } };
    mockGetDb.mockReturnValue(makeDb(users));
    const req = { user: { user_id: 't1' }, body: { username: 'ana' } };
    const res = response();
    await updateMe(req, res);
    expect(res.statusCode).toBe(200);
  });

  test('a user with no prior username change is never cooldown-blocked', async () => {
    const users = { t1: { user_id: 't1', username: 'ana' } };
    mockGetDb.mockReturnValue(makeDb(users));
    const req = { user: { user_id: 't1' }, body: { username: 'firstchange' } };
    const res = response();
    await updateMe(req, res);
    expect(res.statusCode).toBe(200);
    expect(users.t1.username).toBe('firstchange');
  });
});
