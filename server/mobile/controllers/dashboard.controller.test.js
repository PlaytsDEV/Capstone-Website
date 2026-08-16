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

  // Phase: dashboard now maps through mobileBillingBridge.js's toMobileBill()
  // (the SAME function /billing/me/latest uses) instead of a local
  // hand-rolled effectiveBillingFields() — so, like every other canonical
  // bill read, totals are derived from `charges`, never from a bare
  // top-level `totalAmount` field (see billingPolicy.js getVisibleBillSnapshot).
  test('a bill with confirmed paidAmount === totalAmount is reported paid, even if the raw stored status is stale', async () => {
    mockGetDb.mockReturnValue(makeDb({
      bills: [{ _id: 'bill1', charges: { rent: 1000 }, paidAmount: 1000, status: 'pending', dueDate: new Date(), billingMonth: new Date() }],
    }));
    const req = { user: { user_id: 't1', _id: 'mongo1' } };
    const res = response();
    await getDashboard(req, res);
    expect(res.body.billing[0].status).toBe('paid');
    expect(res.body.billing[0].remaining_amount).toBe(0);
  });

  test('a partially paid bill reports partially_paid with the correct remaining amount', async () => {
    mockGetDb.mockReturnValue(makeDb({
      bills: [{ _id: 'bill1', charges: { rent: 1000 }, paidAmount: 400, status: 'pending', dueDate: new Date(), billingMonth: new Date() }],
    }));
    const req = { user: { user_id: 't1', _id: 'mongo1' } };
    const res = response();
    await getDashboard(req, res);
    expect(res.body.billing[0].status).toBe('partially_paid');
    expect(res.body.billing[0].remaining_amount).toBe(600);
  });

  test('an unpaid bill with no payment evidence reports unpaid and the full remaining amount', async () => {
    mockGetDb.mockReturnValue(makeDb({
      bills: [{ _id: 'bill1', charges: { rent: 1000 }, paidAmount: 0, status: 'unpaid', dueDate: new Date(), billingMonth: new Date() }],
    }));
    const req = { user: { user_id: 't1', _id: 'mongo1' } };
    const res = response();
    await getDashboard(req, res);
    expect(res.body.billing[0].status).toBe('unpaid');
    expect(res.body.billing[0].remaining_amount).toBe(1000);
  });

  test('a voided bill is reported cancelled on the dashboard, matching Billing History — not the raw "voided" string', async () => {
    mockGetDb.mockReturnValue(makeDb({
      bills: [{ _id: 'bill1', charges: { rent: 1000 }, paidAmount: 0, status: 'voided', dueDate: new Date(), billingMonth: new Date() }],
    }));
    const req = { user: { user_id: 't1', _id: 'mongo1' } };
    const res = response();
    await getDashboard(req, res);
    expect(res.body.billing[0].status).toBe('cancelled');
  });

  test('a waived bill with a remaining balance is reported paid on the dashboard, matching Billing History', async () => {
    // Regression for the exact class of bug this dashboard used to have: its
    // old local effectiveBillingFields() had no rule for status === 'waived'
    // and would have fallen through to 'partially_paid'/the raw string
    // while /billing/me/latest correctly showed 'paid' for the same bill.
    mockGetDb.mockReturnValue(makeDb({
      bills: [{ _id: 'bill1', charges: { rent: 1000 }, paidAmount: 0, status: 'waived', dueDate: new Date(), billingMonth: new Date() }],
    }));
    const req = { user: { user_id: 't1', _id: 'mongo1' } };
    const res = response();
    await getDashboard(req, res);
    expect(res.body.billing[0].status).toBe('paid');
  });

  test('a bill with a fully released electricity charge carries utility_deadlines — matching Billing History, never a permanent "not released" contradiction', async () => {
    const issuedAt = new Date('2026-08-01');
    const dueDate = new Date('2026-08-15');
    mockGetDb.mockReturnValue(makeDb({
      bills: [{
        _id: 'bill1',
        charges: { electricity: 500 },
        paidAmount: 500,
        status: 'paid',
        dueDate: new Date(),
        billingMonth: new Date(),
        utilityDispatch: { electricity: { state: 'sent', issuedAt, dueDate } },
      }],
    }));
    const req = { user: { user_id: 't1', _id: 'mongo1' } };
    const res = response();
    await getDashboard(req, res);
    expect(res.body.billing[0].status).toBe('paid');
    expect(res.body.billing[0].utility_deadlines.electricity.billReleaseDate).toEqual(issuedAt);
    expect(res.body.billing[0].utility_deadlines.electricity.finalDueDate).toEqual(dueDate);
  });
});
