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
    // billReleaseDate now reflects the bill-level authoritative releasedAt
    // (the release lifecycle — see models/Bill.js and
    // services/billing/billingPolicy.js syncBillAmounts()), not the
    // per-utility issuedAt (a due-date-calculation concept). See
    // services/mobileBillingBridge.js mobileUtilityDeadlines().
    const releasedAt = new Date('2026-08-02');
    mockGetDb.mockReturnValue(makeDb({
      bills: [{
        _id: 'bill1',
        charges: { electricity: 500 },
        paidAmount: 500,
        status: 'paid',
        dueDate: new Date(),
        billingMonth: new Date(),
        releasedAt,
        utilityDispatch: { electricity: { state: 'sent', issuedAt, dueDate } },
      }],
    }));
    const req = { user: { user_id: 't1', _id: 'mongo1' } };
    const res = response();
    await getDashboard(req, res);
    expect(res.body.billing[0].status).toBe('paid');
    expect(res.body.billing[0].utility_deadlines.electricity.billReleaseDate).toEqual(releasedAt);
    expect(res.body.billing[0].utility_deadlines.electricity.finalDueDate).toEqual(dueDate);
  });
});

// Regression for the dashboard's raw `db.collection('bills').find({ userId })
// .sort({ dueDate: -1 })` bug: rent bills are pre-generated ~7 days ahead of
// their due date (services/billing/rentGenerator.js), so a released current
// bill and a just-created next-cycle bill (later dueDate, utilityDispatch
// still "draft") can legitimately coexist. Sorting by dueDate picked the
// future bill as "latest_bill", which then reported the tenant's already-
// released utilities as unreleased. The fix applies the SAME
// NON_DRAFT_BILL_FILTER + CURRENT_BILL_SORT (billingCycleStart/billingMonth/
// createdAt) that routes/mobileBillingRoutes.js already uses, sourced from
// services/mobileBillingBridge.js so Home and Billing can never disagree.
describe('dashboard.controller getDashboard — current vs future pre-generated bill selection', () => {
  beforeEach(() => { mockGetDb.mockReset(); });

  // Unlike makeDb() above (which ignores its find/sort arguments and just
  // returns whatever fixture bills were passed), this mock actually applies
  // the query filter and sort key it receives — necessary to prove the
  // controller passes the *correct* filter/sort, not merely that it still
  // renders whatever bill happens to come back first.
  function makeFilteringBillsDb(bills) {
    return {
      collection(name) {
        if (name === 'bills') {
          return {
            find(query = {}) {
              const filtered = bills.filter((b) => {
                if (query.userId !== undefined && String(b.userId) !== String(query.userId)) return false;
                if (query.status?.$ne !== undefined && b.status === query.status.$ne) return false;
                if (query.isArchived !== undefined && Boolean(b.isArchived) !== query.isArchived) return false;
                return true;
              });
              return {
                sort(sortSpec = {}) {
                  const keys = Object.keys(sortSpec);
                  const sorted = [...filtered].sort((a, b) => {
                    for (const key of keys) {
                      const av = a[key] ? new Date(a[key]).getTime() : 0;
                      const bv = b[key] ? new Date(b[key]).getTime() : 0;
                      if (av !== bv) return sortSpec[key] === -1 ? bv - av : av - bv;
                    }
                    return 0;
                  });
                  return { limit: () => ({ toArray: async () => sorted }) };
                },
              };
            },
          };
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

  // Cycle boundaries computed relative to the real wall-clock "now" (never
  // hard-coded calendar dates) so these tests stay valid regardless of when
  // they run — the important thing is that currentBill's
  // [billingCycleStart, billingCycleEnd) window contains "now" and
  // futureBill's does not, matching selectCurrentBillFromList's contract.
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const monthAfterNextStart = new Date(now.getFullYear(), now.getMonth() + 2, 1);

  test('a released current bill is selected over a future pre-generated bill with a later billingCycleStart and draft utility dispatch (Billing Test 1)', async () => {
    const currentReleasedAt = thisMonthStart;
    const currentBill = {
      _id: 'current-bill', userId: 'mongo1', status: 'pending', isArchived: false,
      charges: { rent: 5000, electricity: 500 }, paidAmount: 0,
      billingCycleStart: thisMonthStart, billingCycleEnd: nextMonthStart, billingMonth: thisMonthStart,
      dueDate: thisMonthStart, createdAt: thisMonthStart,
      releasedAt: currentReleasedAt,
      utilityDispatch: { electricity: { state: 'sent', issuedAt: thisMonthStart, dueDate: thisMonthStart } },
    };
    const futureBill = {
      _id: 'future-bill', userId: 'mongo1', status: 'pending', isArchived: false,
      charges: { rent: 5000, electricity: 500 }, paidAmount: 0,
      billingCycleStart: nextMonthStart, billingCycleEnd: monthAfterNextStart, billingMonth: nextMonthStart,
      dueDate: nextMonthStart, createdAt: now,
      releasedAt: null,
      utilityDispatch: { electricity: { state: 'draft' } },
    };

    mockGetDb.mockReturnValue(makeFilteringBillsDb([currentBill, futureBill]));
    const req = { user: { user_id: 't1', _id: 'mongo1' } };
    const res = response();
    await getDashboard(req, res);

    expect(res.body.latest_bill.billing_id).toBe('current-bill');
    expect(res.body.latest_bill.utility_deadlines.electricity).toBeDefined();
    expect(res.body.latest_bill.utility_deadlines.electricity.billReleaseDate).toEqual(currentReleasedAt);
  });

  test('a genuinely unreleased current-cycle utility charge still correctly reports no utility_deadlines entry (Billing Test 2)', async () => {
    const currentBill = {
      _id: 'current-bill', userId: 'mongo1', status: 'pending', isArchived: false,
      charges: { rent: 5000, electricity: 500 }, paidAmount: 0,
      billingCycleStart: thisMonthStart, billingCycleEnd: nextMonthStart, billingMonth: thisMonthStart,
      dueDate: thisMonthStart, createdAt: thisMonthStart,
      releasedAt: thisMonthStart,
      utilityDispatch: { electricity: { state: 'draft' } },
    };
    mockGetDb.mockReturnValue(makeFilteringBillsDb([currentBill]));
    const req = { user: { user_id: 't1', _id: 'mongo1' } };
    const res = response();
    await getDashboard(req, res);
    expect(res.body.latest_bill.billing_id).toBe('current-bill');
    expect(res.body.latest_bill.utility_deadlines.electricity).toBeUndefined();
  });

  test('a draft (pre-generation placeholder) bill never becomes latest_bill even when it is newest (Billing Test 4)', async () => {
    const currentBill = {
      _id: 'current-bill', userId: 'mongo1', status: 'pending', isArchived: false,
      charges: { rent: 5000 }, paidAmount: 0,
      billingCycleStart: thisMonthStart, billingCycleEnd: nextMonthStart, billingMonth: thisMonthStart,
      dueDate: thisMonthStart, createdAt: thisMonthStart,
      releasedAt: thisMonthStart,
    };
    const draftBill = {
      _id: 'draft-bill', userId: 'mongo1', status: 'draft', isArchived: false,
      charges: { rent: 5000 }, paidAmount: 0,
      billingCycleStart: nextMonthStart, billingCycleEnd: monthAfterNextStart, billingMonth: nextMonthStart,
      dueDate: nextMonthStart, createdAt: now,
      releasedAt: null,
    };
    mockGetDb.mockReturnValue(makeFilteringBillsDb([currentBill, draftBill]));
    const req = { user: { user_id: 't1', _id: 'mongo1' } };
    const res = response();
    await getDashboard(req, res);
    expect(res.body.latest_bill.billing_id).toBe('current-bill');
  });

  test('an archived stale bill never overrides the current bill even with a later billingCycleStart (Billing Test 4)', async () => {
    const currentBill = {
      _id: 'current-bill', userId: 'mongo1', status: 'pending', isArchived: false,
      charges: { rent: 5000 }, paidAmount: 0,
      billingCycleStart: thisMonthStart, billingCycleEnd: nextMonthStart, billingMonth: thisMonthStart,
      dueDate: thisMonthStart, createdAt: thisMonthStart,
      releasedAt: thisMonthStart,
    };
    const archivedBill = {
      _id: 'archived-bill', userId: 'mongo1', status: 'pending', isArchived: true,
      charges: { rent: 5000 }, paidAmount: 0,
      billingCycleStart: nextMonthStart, billingCycleEnd: monthAfterNextStart, billingMonth: nextMonthStart,
      dueDate: nextMonthStart, createdAt: now,
      releasedAt: null,
    };
    mockGetDb.mockReturnValue(makeFilteringBillsDb([currentBill, archivedBill]));
    const req = { user: { user_id: 't1', _id: 'mongo1' } };
    const res = response();
    await getDashboard(req, res);
    expect(res.body.latest_bill.billing_id).toBe('current-bill');
  });
});
