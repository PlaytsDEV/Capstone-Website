// Cross-endpoint regression: Dashboard and Profile must resolve the SAME
// tenant to the SAME Branch. Both ultimately read the same three tiers
// (roomoccupancyhistories -> bedhistories -> reservations), but through two
// independent code paths (dashboard.controller.js's inline lookup vs
// user.controller.js's resolveTenantBranchLocation -> announcement
// controller's resolveRequesterBranchCode) — this test proves they don't
// diverge for the same authenticated user (e.g. Profile: Guadalupe while
// Dashboard/Home: Gil Puyat, for one account).
const mockGetDb = jest.fn();
jest.mock('../config/database.js', () => ({ getDb: (...args) => mockGetDb(...args) }));
jest.mock('uuid', () => ({ v4: () => 'test-uuid-0000-0000-0000-000000000000' }));
// Both controllers under test transitively require announcement.controller.js
// -> pushService.js -> firebase-admin (ESM) — stub it.
jest.mock('../services/pushService.js', () => ({ notifyNewAnnouncement: jest.fn() }));

const { getDashboard } = require('./dashboard.controller.js');
const { getMe } = require('./user.controller.js');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

// occupancyDoc / bedHistoryDoc / reservationDoc simulate the SAME tenant's
// record in each of the three tiers dashboard.controller.js and
// resolveRequesterBranchCode() both read, in the same priority order.
function makeSharedDb({ users = {}, occupancyDoc = null, bedHistoryDoc = null, reservationDoc = null, room = null } = {}) {
  return {
    collection(name) {
      if (name === 'users') {
        return {
          findOne: async (query) => {
            const user = Object.values(users).find((u) => u.user_id === query.user_id);
            return user || null;
          },
        };
      }
      if (name === 'roomoccupancyhistories') {
        return { findOne: async () => occupancyDoc };
      }
      if (name === 'bedhistories') {
        return { findOne: async () => bedHistoryDoc };
      }
      if (name === 'reservations') {
        return { findOne: async () => reservationDoc };
      }
      if (name === 'rooms') {
        return { findOne: async () => room };
      }
      if (name === 'bills' || name === 'billing') {
        return { find: () => ({ sort: () => ({ limit: () => ({ toArray: async () => [] }) }) }) };
      }
      if (name === 'maintenance_requests' || name === 'maintenancerequests') {
        return { find: () => ({ toArray: async () => [] }) };
      }
      throw new Error(`unexpected collection: ${name}`);
    },
  };
}

describe('Dashboard vs Profile — Branch consistency', () => {
  beforeEach(() => { mockGetDb.mockReset(); });

  test('a Guadalupe tenant resolved via active-room-assignment (bedhistories) shows Guadalupe on BOTH Dashboard and Profile', async () => {
    const users = { t1: { user_id: 't1', email: 'a@b.com' } };
    const db = makeSharedDb({
      users,
      bedHistoryDoc: { _id: 'bh1', tenantId: 'mongo1', status: 'active', roomId: '507f1f77bcf86cd799439011', branch: 'guadalupe', bedId: 'b1' },
      room: { _id: '507f1f77bcf86cd799439011', roomNumber: '101', type: 'quadruple-sharing', beds: [{ id: 'b1', position: 'lower' }] },
    });
    mockGetDb.mockReturnValue(db);

    const req = { user: { user_id: 't1', _id: 'mongo1' } };

    const dashRes = response();
    await getDashboard(req, dashRes);
    const profileRes = response();
    await getMe(req, profileRes);

    expect(dashRes.body.assignment.branch).toBe('guadalupe');
    expect(profileRes.body.branch.branchName).toContain('Guadalupe');
    expect(profileRes.body.branch.branchName).not.toContain('Gil Puyat');
  });

  test('a Gil Puyat tenant resolved via reservation (no room-assignment record yet) shows Gil Puyat on BOTH Dashboard and Profile', async () => {
    const users = { t1: { user_id: 't1' } };
    const db = makeSharedDb({
      users,
      reservationDoc: { _id: 'r1', userId: 'mongo1', status: 'approved', roomId: '507f1f77bcf86cd799439012', branch: 'gil-puyat', selectedBed: { id: 'b1' } },
      room: { _id: '507f1f77bcf86cd799439012', roomNumber: '204', type: 'private', beds: [{ id: 'b1', position: 'upper' }] },
    });
    mockGetDb.mockReturnValue(db);

    const req = { user: { user_id: 't1', _id: 'mongo1' } };

    const dashRes = response();
    await getDashboard(req, dashRes);
    const profileRes = response();
    await getMe(req, profileRes);

    expect(dashRes.body.assignment.branch).toBe('gil-puyat');
    expect(profileRes.body.branch.branchName).toContain('Gil Puyat');
  });

  test('a tenant with no resolvable Branch context shows no assignment on Dashboard AND branch: null on Profile — never a guessed branch on either', async () => {
    const users = { t1: { user_id: 't1' } };
    const db = makeSharedDb({ users });
    mockGetDb.mockReturnValue(db);

    const req = { user: { user_id: 't1', _id: 'mongo1' } };

    const dashRes = response();
    await getDashboard(req, dashRes);
    const profileRes = response();
    await getMe(req, profileRes);

    expect(dashRes.body.assignment).toBeNull();
    expect(profileRes.body.branch).toBeNull();
  });
});
