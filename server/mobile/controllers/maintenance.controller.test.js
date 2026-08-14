const mockGetDb = jest.fn();
jest.mock('../config/database.js', () => ({ getDb: (...args) => mockGetDb(...args) }));
jest.mock('../services/pushService.js', () => ({ notifyMaintenanceStatusChange: jest.fn() }));
jest.mock('uuid', () => ({ v4: () => 'test-uuid-0000-0000-0000-000000000000' }));
// No Firebase Storage app configured in these tests — attachment-size
// verification (see maintenanceAttachmentSizeLimit.test.js for dedicated
// coverage) falls back to the client-reported `size` field, which none of
// the fixtures below set on their attachments, so any attachment payload
// used here is expected to be rejected by the size check UNLESS the test
// itself is specifically about something that already 400s first (e.g. the
// "more than 4 attachments" count check) or carries no attachments at all.
jest.mock('../config/firebase.js', () => ({ admin: { apps: [] }, resolveFirebaseStorageBucket: () => null }));

const {
  createMaintenance,
  sendTenantReply,
  confirmMaintenanceResolved,
} = require('./maintenance.controller.js');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function makeDb({ requests = {} } = {}) {
  const updates = [];
  return {
    updates,
    collection(name) {
      if (name === 'reservations' || name === 'bedhistories' || name === 'roomoccupancyhistories' || name === 'rooms') {
        return { findOne: async () => null };
      }
      if (name === 'maintenance_requests' || name === 'maintenancerequests') {
        return {
          async findOne(query) {
            const request = requests[query.request_id];
            if (!request) return null;
            if (query.user_id && request.user_id !== query.user_id) return null;
            return name === request.__collection ? request : (name === 'maintenance_requests' ? request : null);
          },
          async updateOne(filter, update) {
            const request = requests[filter.request_id];
            if (request) { Object.assign(request, update.$set); updates.push({ filter, update }); }
            return { matchedCount: request ? 1 : 0 };
          },
          async insertOne(doc) { requests[doc.request_id] = { ...doc, __collection: 'maintenance_requests' }; },
        };
      }
      throw new Error(`unexpected collection: ${name}`);
    },
  };
}

describe('maintenance.controller createMaintenance — validation', () => {
  beforeEach(() => { mockGetDb.mockReset(); });

  test('rejects an unknown request_type not in the mobile app\'s fixed category list', async () => {
    mockGetDb.mockReturnValue(makeDb());
    const req = { user: { user_id: 't1', _id: 'mongo1' }, body: { request_type: 'not-a-real-category', description: 'a valid description here' } };
    const res = response();
    await createMaintenance(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.errors.request_type).toBeTruthy();
  });

  test('rejects a description shorter than the minimum length', async () => {
    mockGetDb.mockReturnValue(makeDb());
    const req = { user: { user_id: 't1', _id: 'mongo1' }, body: { request_type: 'plumbing', description: 'short' } };
    const res = response();
    await createMaintenance(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.errors.description).toBeTruthy();
  });

  test('rejects more than 4 attachments', async () => {
    mockGetDb.mockReturnValue(makeDb());
    const attachments = Array.from({ length: 5 }, (_, i) => ({ downloadUrl: `https://x/${i}`, mimeType: 'image/png' }));
    const req = { user: { user_id: 't1', _id: 'mongo1' }, body: { request_type: 'plumbing', description: 'a valid description here', attachments } };
    const res = response();
    await createMaintenance(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('accepts a valid request with a known category and description', async () => {
    mockGetDb.mockReturnValue(makeDb());
    const req = { user: { user_id: 't1', _id: 'mongo1' }, body: { request_type: 'plumbing', description: 'a valid description here', urgency: 'high' } };
    const res = response();
    await createMaintenance(req, res);
    expect(res.statusCode).toBe(201);
    expect(res.body.request_type).toBe('plumbing');
  });
});

describe('maintenance.controller sendTenantReply — status guard', () => {
  beforeEach(() => { mockGetDb.mockReset(); });

  test.each(['resolved', 'completed', 'cancelled', 'rejected'])('rejects a reply on a %s request', async (status) => {
    const requests = { r1: { request_id: 'r1', user_id: 't1', status, __collection: 'maintenance_requests' } };
    mockGetDb.mockReturnValue(makeDb({ requests }));
    const req = { user: { user_id: 't1', _id: 'mongo1' }, params: { requestId: 'r1' }, body: { message: 'still broken' } };
    const res = response();
    await sendTenantReply(req, res);
    expect(res.statusCode).toBe(400);
  });

  test.each(['pending', 'viewed', 'in_progress'])('allows a reply on a %s (still-open) request', async (status) => {
    const requests = { r1: { request_id: 'r1', user_id: 't1', status, __collection: 'maintenance_requests' } };
    mockGetDb.mockReturnValue(makeDb({ requests }));
    const req = { user: { user_id: 't1', _id: 'mongo1' }, params: { requestId: 'r1' }, body: { message: 'any update?' } };
    const res = response();
    await sendTenantReply(req, res);
    expect(res.statusCode).toBe(201);
  });

  test('a tenant cannot reply to another tenant\'s request', async () => {
    const requests = { r1: { request_id: 'r1', user_id: 't2', status: 'pending', __collection: 'maintenance_requests' } };
    mockGetDb.mockReturnValue(makeDb({ requests }));
    const req = { user: { user_id: 't1', _id: 'mongo1' }, params: { requestId: 'r1' }, body: { message: 'hi' } };
    const res = response();
    await sendTenantReply(req, res);
    expect(res.statusCode).toBe(404);
  });
});

describe('maintenance.controller confirmMaintenanceResolved', () => {
  beforeEach(() => { mockGetDb.mockReset(); });

  test('a resolved request can be confirmed, becomes completed with tenant_confirmed_resolved=true', async () => {
    const requests = { r1: { request_id: 'r1', user_id: 't1', status: 'resolved', __collection: 'maintenance_requests' } };
    mockGetDb.mockReturnValue(makeDb({ requests }));
    const req = { user: { user_id: 't1', _id: 'mongo1' }, params: { requestId: 'r1' } };
    const res = response();
    await confirmMaintenanceResolved(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('completed');
    expect(res.body.tenant_confirmed_resolved).toBe(true);
  });

  test.each(['pending', 'viewed', 'in_progress', 'completed', 'cancelled', 'rejected'])('a %s request cannot be confirmed (only resolved can)', async (status) => {
    const requests = { r1: { request_id: 'r1', user_id: 't1', status, __collection: 'maintenance_requests' } };
    mockGetDb.mockReturnValue(makeDb({ requests }));
    const req = { user: { user_id: 't1', _id: 'mongo1' }, params: { requestId: 'r1' } };
    const res = response();
    await confirmMaintenanceResolved(req, res);
    expect(res.statusCode).toBe(400);
  });

  test('a tenant cannot confirm another tenant\'s request', async () => {
    const requests = { r1: { request_id: 'r1', user_id: 't2', status: 'resolved', __collection: 'maintenance_requests' } };
    mockGetDb.mockReturnValue(makeDb({ requests }));
    const req = { user: { user_id: 't1', _id: 'mongo1' }, params: { requestId: 'r1' } };
    const res = response();
    await confirmMaintenanceResolved(req, res);
    expect(res.statusCode).toBe(404);
  });

  test('a nonexistent request returns 404, not a crash', async () => {
    mockGetDb.mockReturnValue(makeDb({ requests: {} }));
    const req = { user: { user_id: 't1', _id: 'mongo1' }, params: { requestId: 'ghost' } };
    const res = response();
    await confirmMaintenanceResolved(req, res);
    expect(res.statusCode).toBe(404);
  });
});
