function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

// Simulates a real MongoDB unique partial index on { user_id, client_request_id }
// well enough to exercise the controller's race-handling path: insertOne
// throws a duplicate-key error (code 11000) when a doc with the same
// (user_id, client_request_id) pair already exists.
function makeDb({ indexConflictCode = null } = {}) {
  const requests = [];
  let indexCreateCalls = 0;
  return {
    requests,
    get indexCreateCalls() { return indexCreateCalls; },
    collection(name) {
      if (name === 'reservations' || name === 'bedhistories' || name === 'roomoccupancyhistories' || name === 'rooms') {
        return { findOne: async () => null };
      }
      if (name === 'maintenancerequests') {
        return { findOne: async () => null };
      }
      if (name === 'maintenance_requests') {
        return {
          async createIndex() {
            indexCreateCalls += 1;
            if (indexConflictCode) {
              // Simulates Mongoose's autoIndex having already built the same
              // { user_id, client_request_id } partial-unique index under a
              // different auto-generated name before this lazy call runs —
              // a real, observed production failure mode (Phase 4A live
              // smoke test).
              const err = new Error('An equivalent index already exists with a different name');
              err.code = indexConflictCode;
              throw err;
            }
            return 'user_client_request_id_unique';
          },
          async findOne(query) {
            if (query.client_request_id !== undefined) {
              return requests.find((r) => r.user_id === query.user_id && r.client_request_id === query.client_request_id) || null;
            }
            return requests.find((r) => r.request_id === query.request_id) || null;
          },
          async insertOne(doc) {
            const collides = doc.client_request_id != null && requests.some(
              (r) => r.user_id === doc.user_id && r.client_request_id === doc.client_request_id,
            );
            if (collides) {
              const err = new Error('E11000 duplicate key error');
              err.code = 11000;
              throw err;
            }
            requests.push({ ...doc, __collection: 'maintenance_requests' });
          },
        };
      }
      throw new Error(`unexpected collection: ${name}`);
    },
  };
}

function baseReq(overrides = {}) {
  return {
    user: { user_id: 't1', _id: 'mongo1' },
    body: { request_type: 'plumbing', description: 'a valid description here', ...overrides },
  };
}

// The controller memoizes its index-creation promise at module scope (same
// pattern as auth.controller.js's otpIndexPromise) so it's issued once per
// process, not once per call. Reset the module registry between tests so
// each test gets its own memoized promise instead of inheriting whichever
// db happened to trigger it first.
let createMaintenance;
let uuidCounter;

beforeEach(() => {
  jest.resetModules();
  uuidCounter = 0;
  jest.doMock('../config/database.js', () => ({ getDb: () => currentDb }));
  jest.doMock('../services/pushService.js', () => ({ notifyMaintenanceStatusChange: jest.fn() }));
  jest.doMock('uuid', () => ({ v4: () => `test-uuid-${(uuidCounter++).toString().padStart(4, '0')}` }));
  jest.doMock('../config/firebase.js', () => ({ admin: { apps: [] }, resolveFirebaseStorageBucket: () => null }));
  // eslint-disable-next-line global-require
  ({ createMaintenance } = require('./maintenance.controller.js'));
});

let currentDb;

describe('maintenance.controller createMaintenance — idempotency', () => {
  test('same tenant + same key: sequential retry returns the original request, not a new one', async () => {
    currentDb = makeDb();

    const first = response();
    await createMaintenance(baseReq({ client_request_id: 'retry-key-1' }), first);
    expect(first.statusCode).toBe(201);

    const second = response();
    await createMaintenance(baseReq({ client_request_id: 'retry-key-1' }), second);
    expect(second.statusCode).toBe(200);
    expect(second.body.request_id).toBe(first.body.request_id);
    expect(currentDb.requests).toHaveLength(1);
  });

  test('same tenant + concurrent duplicate submissions: only one ticket persists', async () => {
    currentDb = makeDb();

    const resA = response();
    const resB = response();
    // Both requests race past the findOne check before either insert lands.
    await Promise.all([
      createMaintenance(baseReq({ client_request_id: 'concurrent-key' }), resA),
      createMaintenance(baseReq({ client_request_id: 'concurrent-key' }), resB),
    ]);

    expect(currentDb.requests).toHaveLength(1);
    const statuses = [resA.statusCode, resB.statusCode].sort();
    expect(statuses).toEqual([200, 201]);
    expect(resA.body.request_id).toBe(resB.body.request_id);
  });

  test('same tenant + different keys: creates separate requests', async () => {
    currentDb = makeDb();

    const first = response();
    await createMaintenance(baseReq({ client_request_id: 'key-a' }), first);
    const second = response();
    await createMaintenance(baseReq({ client_request_id: 'key-b' }), second);

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(first.body.request_id).not.toBe(second.body.request_id);
    expect(currentDb.requests).toHaveLength(2);
  });

  test('tenant A + same key as tenant B: separate requests, no cross-tenant dedupe', async () => {
    currentDb = makeDb();

    const forA = response();
    await createMaintenance({ user: { user_id: 't1', _id: 'mongo1' }, body: { request_type: 'plumbing', description: 'a valid description here', client_request_id: 'shared-key' } }, forA);
    const forB = response();
    await createMaintenance({ user: { user_id: 't2', _id: 'mongo2' }, body: { request_type: 'plumbing', description: 'a valid description here', client_request_id: 'shared-key' } }, forB);

    expect(forA.statusCode).toBe(201);
    expect(forB.statusCode).toBe(201);
    expect(forA.body.request_id).not.toBe(forB.body.request_id);
    expect(currentDb.requests).toHaveLength(2);
  });

  test('no key: existing backward-compatible behavior is unchanged', async () => {
    currentDb = makeDb();

    const first = response();
    await createMaintenance(baseReq(), first);
    const second = response();
    await createMaintenance(baseReq(), second);

    expect(first.statusCode).toBe(201);
    expect(second.statusCode).toBe(201);
    expect(first.body.request_id).not.toBe(second.body.request_id);
    expect(currentDb.requests).toHaveLength(2);
  });

  test('malformed key (invalid characters) is safely rejected with a 400 validation error', async () => {
    currentDb = makeDb();

    const res = response();
    await createMaintenance(baseReq({ client_request_id: 'has a space and $ymbols!' }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.errors.client_request_id).toBeTruthy();
    expect(currentDb.requests).toHaveLength(0);
  });

  test('oversized key is rejected with a 400 validation error', async () => {
    currentDb = makeDb();

    const res = response();
    await createMaintenance(baseReq({ client_request_id: 'x'.repeat(129) }), res);

    expect(res.statusCode).toBe(400);
    expect(res.body.errors.client_request_id).toBeTruthy();
    expect(currentDb.requests).toHaveLength(0);
  });

  test.each([85, 86])('an "equivalent index already exists" conflict (code %d) on createIndex does not fail the submission', async (code) => {
    currentDb = makeDb({ indexConflictCode: code });

    const res = response();
    await createMaintenance(baseReq({ client_request_id: 'k1' }), res);

    expect(res.statusCode).toBe(201);
    expect(currentDb.requests).toHaveLength(1);
  });

  test('an unrelated createIndex failure still surfaces as a 500, not silently swallowed', async () => {
    currentDb = makeDb({ indexConflictCode: 13 }); // Unauthorized, e.g.

    const res = response();
    await createMaintenance(baseReq({ client_request_id: 'k1' }), res);

    expect(res.statusCode).toBe(500);
  });

  test('the unique index is created lazily — not at all until a key is actually used', async () => {
    currentDb = makeDb();

    await createMaintenance(baseReq(), response());
    expect(currentDb.indexCreateCalls).toBe(0);

    await createMaintenance(baseReq({ client_request_id: 'k1' }), response());
    await createMaintenance(baseReq({ client_request_id: 'k2' }), response());
    expect(currentDb.indexCreateCalls).toBe(1);
  });
});
