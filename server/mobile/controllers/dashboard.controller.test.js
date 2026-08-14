const mockGetDb = jest.fn();
jest.mock('../config/database.js', () => ({ getDb: (...args) => mockGetDb(...args) }));
jest.mock('uuid', () => ({ v4: () => 'test-uuid-0000-0000-0000-000000000000' }));
// dashboard.controller.js -> user.controller.js now transitively requires
// announcement.controller.js -> pushService.js -> firebase-admin (ESM) —
// stub it, matching announcement.controller.test.js's own mock.
jest.mock('../services/pushService.js', () => ({ notifyNewAnnouncement: jest.fn() }));

const { getDashboard } = require('./dashboard.controller.js');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function emptyFind() {
  return { toArray: async () => [], catch: () => [], sort: () => emptyFind(), limit: () => emptyFind(), findOne: async () => null };
}

function makeDb({ bills = [] } = {}) {
  return {
    collection(name) {
      if (name === 'bills') {
        return { find: () => ({ sort: () => ({ limit: () => ({ toArray: async () => bills }) }) }) };
      }
      if (name === 'billing') {
        return { find: () => ({ sort: () => ({ limit: () => ({ toArray: async () => [] }) }) }) };
      }
      if (['roomoccupancyhistories', 'bedhistories', 'reservations'].includes(name)) {
        return { findOne: async () => null };
      }
      if (['maintenance_requests', 'maintenancerequests'].includes(name)) {
        return { find: () => ({ toArray: async () => [] }) };
      }
      throw new Error(`unexpected collection: ${name}`);
    },
  };
}

describe('dashboard.controller getDashboard — user field allowlist', () => {
  beforeEach(() => { mockGetDb.mockReset(); });

  test('never leaks fields outside the client-visible allowlist', async () => {
    mockGetDb.mockReturnValue(makeDb({}));
    const req = { user: { user_id: 't1', _id: 'mongo1', email: 'a@b.com', role: 'tenant', push_token: 'secret', password_hash: 'leak' } };
    const res = response();
    await getDashboard(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.user.push_token).toBeUndefined();
    expect(res.body.user.password_hash).toBeUndefined();
    expect(res.body.user._id).toBeUndefined();
    expect(res.body.user.email).toBe('a@b.com');
  });
});

describe('dashboard.controller getDashboard — billing effective status', () => {
  beforeEach(() => { mockGetDb.mockReset(); });

  test('a bill with confirmed paidAmount === totalAmount is reported paid, even if the raw stored status is stale', async () => {
    mockGetDb.mockReturnValue(makeDb({
      bills: [{ _id: 'bill1', totalAmount: 1000, paidAmount: 1000, status: 'pending', dueDate: new Date(), billingMonth: new Date() }],
    }));
    const req = { user: { user_id: 't1', _id: 'mongo1' } };
    const res = response();
    await getDashboard(req, res);
    expect(res.body.billing[0].status).toBe('paid');
    expect(res.body.billing[0].remaining_amount).toBe(0);
  });

  test('a partially paid bill reports partially_paid with the correct remaining amount', async () => {
    mockGetDb.mockReturnValue(makeDb({
      bills: [{ _id: 'bill1', totalAmount: 1000, paidAmount: 400, status: 'pending', dueDate: new Date(), billingMonth: new Date() }],
    }));
    const req = { user: { user_id: 't1', _id: 'mongo1' } };
    const res = response();
    await getDashboard(req, res);
    expect(res.body.billing[0].status).toBe('partially_paid');
    expect(res.body.billing[0].remaining_amount).toBe(600);
  });

  test('an unpaid bill with no payment evidence reports the raw status and full remaining amount', async () => {
    mockGetDb.mockReturnValue(makeDb({
      bills: [{ _id: 'bill1', totalAmount: 1000, paidAmount: 0, status: 'unpaid', dueDate: new Date(), billingMonth: new Date() }],
    }));
    const req = { user: { user_id: 't1', _id: 'mongo1' } };
    const res = response();
    await getDashboard(req, res);
    expect(res.body.billing[0].status).toBe('unpaid');
    expect(res.body.billing[0].remaining_amount).toBe(1000);
  });
});
