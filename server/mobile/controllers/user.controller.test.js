const mockGetDb = jest.fn();
jest.mock('../config/database.js', () => ({ getDb: (...args) => mockGetDb(...args) }));
// The real 'uuid' package (v13) is ESM-only and cannot be required from this
// CJS test file — stub it, matching the pattern needed by every vendored
// mobile controller test that transitively requires a controller using it.
jest.mock('uuid', () => ({ v4: () => 'test-uuid-0000-0000-0000-000000000000' }));
// user.controller.js now reuses announcement.controller.js's
// resolveRequesterBranchCode() for Branch resolution, which transitively
// requires pushService.js -> firebase-admin (ESM, unrunnable under Jest CJS)
// — stub it, matching announcement.controller.test.js's own mock.
jest.mock('../services/pushService.js', () => ({ notifyNewAnnouncement: jest.fn() }));

const { getMe, updateMe, sanitizeUserForClient, normalizeUser, resolveTenantBranchLocation } = require('./user.controller.js');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

// branchSource optionally simulates resolveRequesterBranchCode()'s tiers:
// { tier: 'occupancy' | 'bedhistory' | 'reservation' | 'contract', doc }
function makeDb(users, branchSource = null) {
  return {
    collection(name) {
      if (name === 'roomoccupancyhistories') {
        return { findOne: async () => (branchSource?.tier === 'occupancy' ? branchSource.doc : null) };
      }
      if (name === 'bedhistories') {
        return { findOne: async () => (branchSource?.tier === 'bedhistory' ? branchSource.doc : null) };
      }
      if (name === 'reservations') {
        return { findOne: async () => (branchSource?.tier === 'reservation' ? branchSource.doc : null) };
      }
      if (name === 'contracts') {
        return { findOne: async () => (branchSource?.tier === 'contract' ? branchSource.doc : null) };
      }
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

describe('user.controller getMe / updateMe — Branch object', () => {
  beforeEach(() => { mockGetDb.mockReset(); });

  const GUADALUPE_ROOM = { branchName: 'LilyCrest Residences – Guadalupe', branchAddress: '1212, 9431 Magallanes, Makati, 1212 Metro Manila', googleMapsUrl: 'https://maps.app.goo.gl/zEQJECzxDY4qdhYp6', isActive: true };
  const GIL_PUYAT_ROOM = { branchName: 'LilyCrest Residences – Gil Puyat', branchAddress: '#7 Gil Puyat Ave. corner Marconi St., Makati City', googleMapsUrl: 'https://www.google.com/maps/search/?api=1&query=%237%20Gil%20Puyat%20Ave.%20corner%20Marconi%20St.%2C%20Makati%20City', isActive: true };

  test('a tenant with an authoritative current-stay assignment gets the matching Branch object', async () => {
    const users = { t1: { user_id: 't1', email: 'a@b.com', name: 'Ana' } };
    mockGetDb.mockReturnValue(makeDb(users, { tier: 'occupancy', doc: { branch: 'guadalupe' } }));
    const req = { user: { user_id: 't1', _id: 'mongo1' } };
    const res = response();
    await getMe(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.branch).toEqual(GUADALUPE_ROOM);
  });

  test('Guadalupe tenant receives only Guadalupe branch info, never Gil Puyat data', async () => {
    const users = { t1: { user_id: 't1' } };
    mockGetDb.mockReturnValue(makeDb(users, { tier: 'bedhistory', doc: { branch: 'guadalupe' } }));
    const req = { user: { user_id: 't1', _id: 'mongo1' } };
    const res = response();
    await getMe(req, res);
    expect(res.body.branch.branchName).toContain('Guadalupe');
    expect(res.body.branch.branchName).not.toContain('Gil Puyat');
  });

  test('Gil Puyat tenant receives only Gil Puyat branch info, never Guadalupe data', async () => {
    const users = { t1: { user_id: 't1' } };
    mockGetDb.mockReturnValue(makeDb(users, { tier: 'reservation', doc: { branch: 'gil-puyat', status: 'approved' } }));
    const req = { user: { user_id: 't1', _id: 'mongo1' } };
    const res = response();
    await getMe(req, res);
    expect(res.body.branch).toEqual(GIL_PUYAT_ROOM);
  });

  test('a client-supplied branch/branchId in the request body cannot influence the returned Branch — resolution is session/db-derived only', async () => {
    const users = { t1: { user_id: 't1' } };
    mockGetDb.mockReturnValue(makeDb(users, { tier: 'occupancy', doc: { branch: 'guadalupe' } }));
    const req = { user: { user_id: 't1', _id: 'mongo1' }, body: { branch: 'gil-puyat', branchId: 'gil-puyat', roomId: 'attacker-supplied', reservationId: 'attacker-supplied' } };
    const res = response();
    await getMe(req, res);
    // getMe never reads req.body at all, and the resolver is keyed only on
    // req.user._id — the attacker-supplied body is fully inert.
    expect(res.body.branch.branchName).toContain('Guadalupe');
  });

  test('a tenant with no resolvable Branch context gets branch: null, never a guessed default', async () => {
    const users = { t1: { user_id: 't1' } };
    mockGetDb.mockReturnValue(makeDb(users, null));
    const req = { user: { user_id: 't1', _id: 'mongo1' } };
    const res = response();
    await getMe(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.branch).toBeNull();
  });

  test('an unrecognized/legacy branch code resolves to branch: null rather than throwing or guessing', async () => {
    const users = { t1: { user_id: 't1' } };
    mockGetDb.mockReturnValue(makeDb(users, { tier: 'occupancy', doc: { branch: 'some-decommissioned-branch' } }));
    const req = { user: { user_id: 't1', _id: 'mongo1' } };
    const res = response();
    await getMe(req, res);
    expect(res.body.branch).toBeNull();
  });

  test('a user with no mongo _id (defensive) never triggers a branch lookup and gets branch: null', async () => {
    const users = { t1: { user_id: 't1' } };
    mockGetDb.mockReturnValue(makeDb(users, { tier: 'occupancy', doc: { branch: 'guadalupe' } }));
    const req = { user: { user_id: 't1' } }; // no _id
    const res = response();
    await getMe(req, res);
    expect(res.body.branch).toBeNull();
  });

  test('applicant/pre-move-in: an approved (not yet moved-in) reservation with a room still resolves a Branch', async () => {
    const users = { t1: { user_id: 't1' } };
    mockGetDb.mockReturnValue(makeDb(users, { tier: 'reservation', doc: { branch: 'gil-puyat', status: 'approved' } }));
    const req = { user: { user_id: 't1', _id: 'mongo1' } };
    const res = response();
    await getMe(req, res);
    expect(res.body.branch.branchName).toContain('Gil Puyat');
  });

  test('legacy occupancy record keyed under branchId (not branch) still resolves correctly', async () => {
    const users = { t1: { user_id: 't1' } };
    mockGetDb.mockReturnValue(makeDb(users, { tier: 'occupancy', doc: { branchId: 'guadalupe' } }));
    const req = { user: { user_id: 't1', _id: 'mongo1' } };
    const res = response();
    await getMe(req, res);
    expect(res.body.branch.branchName).toContain('Guadalupe');
  });

  test('raw sensitive fields remain absent from getMe even when a Branch is resolved', async () => {
    const users = { t1: { user_id: 't1', email: 'a@b.com', password_hash: 'nope', push_token: 'secret' } };
    mockGetDb.mockReturnValue(makeDb(users, { tier: 'occupancy', doc: { branch: 'guadalupe' } }));
    const req = { user: { user_id: 't1', _id: 'mongo1' } };
    const res = response();
    await getMe(req, res);
    expect(res.body.password_hash).toBeUndefined();
    expect(res.body.push_token).toBeUndefined();
    expect(res.body.email).toBe('a@b.com');
  });

  test('existing profile fields (username, email) remain unchanged by the Branch addition', async () => {
    const users = { t1: { user_id: 't1', email: 'a@b.com', username: 'ana' } };
    mockGetDb.mockReturnValue(makeDb(users, null));
    const req = { user: { user_id: 't1', _id: 'mongo1' } };
    const res = response();
    await getMe(req, res);
    expect(res.body.username).toBe('ana');
    expect(res.body.email).toBe('a@b.com');
  });

  test('updateMe also returns a resolved Branch, so a profile edit never silently drops the client-cached branch (updateUser merge safety)', async () => {
    const users = { t1: { user_id: 't1', username: 'ana' } };
    mockGetDb.mockReturnValue(makeDb(users, { tier: 'occupancy', doc: { branch: 'guadalupe' } }));
    const req = { user: { user_id: 't1', _id: 'mongo1' }, body: { username: 'newname' } };
    const res = response();
    await updateMe(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.branch.branchName).toContain('Guadalupe');
  });

  test('no cross-tenant Branch resolution: two different sessions resolve independently, keyed only by their own req.user._id', async () => {
    const users = { t1: { user_id: 't1' }, t2: { user_id: 't2' } };
    const dbT1 = makeDb(users, { tier: 'occupancy', doc: { branch: 'guadalupe' } });
    mockGetDb.mockReturnValue(dbT1);
    const req1 = { user: { user_id: 't1', _id: 'mongo1' } };
    const res1 = response();
    await getMe(req1, res1);
    expect(res1.body.branch.branchName).toContain('Guadalupe');

    const dbT2 = makeDb(users, { tier: 'occupancy', doc: { branch: 'gil-puyat' } });
    mockGetDb.mockReturnValue(dbT2);
    const req2 = { user: { user_id: 't2', _id: 'mongo2' } };
    const res2 = response();
    await getMe(req2, res2);
    expect(res2.body.branch.branchName).toContain('Gil Puyat');
  });
});

describe('resolveTenantBranchLocation', () => {
  test('returns null immediately for a falsy mongoId without querying the db', async () => {
    const db = { collection: () => { throw new Error('should not query db when mongoId is falsy'); } };
    const result = await resolveTenantBranchLocation(db, null);
    expect(result).toBeNull();
  });

  test('falls back to the current Contract.branch when no occupancy/bedhistory/reservation record resolves a Branch', async () => {
    const users = { t1: { user_id: 't1' } };
    const db = makeDb(users, { tier: 'contract', doc: { isCurrent: true, branch: 'gil-puyat' } });
    mockGetDb.mockReturnValue(db);

    const req = { user: { user_id: 't1', _id: 'mongo1' } };
    const res = response();
    await getMe(req, res);

    expect(res.body.branch.branchName).toContain('Gil Puyat');
  });
});
