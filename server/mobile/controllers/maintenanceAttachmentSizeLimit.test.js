/**
 * Canonical-mobile reconciliation audit — Gap B: this controller previously
 * only capped attachment COUNT (MAX_TENANT_ATTACHMENTS), never checked byte
 * size at all, letting a client reference an upload larger than the mobile
 * app's intended 5MB ceiling. Covers both entry points attachments can come
 * through: createMaintenance and sendTenantReply, using both a Firebase
 * Storage-verified size (storagePath present — the trustworthy path) and
 * the client-reported-size fallback (no storagePath).
 */

const mockGetDb = jest.fn();
const mockGetMetadata = jest.fn();
const mockBucketFile = jest.fn(() => ({ getMetadata: mockGetMetadata }));
const mockBucket = jest.fn(() => ({ file: mockBucketFile }));

jest.mock('../config/database.js', () => ({ getDb: (...args) => mockGetDb(...args) }));
jest.mock('../services/pushService.js', () => ({ notifyMaintenanceStatusChange: jest.fn() }));
jest.mock('uuid', () => ({ v4: () => 'test-uuid-0000-0000-0000-000000000000' }));
jest.mock('../config/firebase.js', () => ({
  admin: { apps: [{}], storage: () => ({ bucket: (...args) => mockBucket(...args) }) },
  resolveFirebaseStorageBucket: () => 'test-bucket',
}));

const { createMaintenance, sendTenantReply } = require('./maintenance.controller.js');

const FIVE_MB = 5 * 1024 * 1024;

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function makeDb({ requests = {} } = {}) {
  const inserted = [];
  const updates = [];
  return {
    inserted,
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
            return request;
          },
          async updateOne(filter, update) {
            const request = requests[filter.request_id];
            if (request) { Object.assign(request, update.$set); updates.push({ filter, update }); }
            return { matchedCount: request ? 1 : 0 };
          },
          async insertOne(doc) {
            inserted.push(doc);
            requests[doc.request_id] = { ...doc, __collection: 'maintenance_requests' };
          },
        };
      }
      throw new Error(`unexpected collection: ${name}`);
    },
  };
}

beforeEach(() => {
  mockGetDb.mockReset();
  mockGetMetadata.mockReset();
  mockBucketFile.mockClear();
  mockBucket.mockClear();
});

describe('createMaintenance — 5MB attachment enforcement', () => {
  test('a storagePath-verified attachment under 5MB is accepted, using the real Firebase Storage size (not the client-echoed one)', async () => {
    mockGetDb.mockReturnValue(makeDb());
    mockGetMetadata.mockResolvedValue([{ size: String(FIVE_MB - 1024) }]);
    const req = {
      user: { user_id: 't1', _id: 'mongo1' },
      body: {
        request_type: 'plumbing',
        description: 'a valid description here',
        attachments: [{ downloadUrl: 'https://x/a.png', mimeType: 'image/png', storagePath: 'tenant-uploads/t1/a.png', size: 1 }],
      },
    };
    const res = response();
    await createMaintenance(req, res);
    expect(res.statusCode).toBe(201);
    expect(mockBucketFile).toHaveBeenCalledWith('tenant-uploads/t1/a.png');
  });

  test('a storagePath-verified attachment exactly at 5MB is accepted (inclusive boundary)', async () => {
    mockGetDb.mockReturnValue(makeDb());
    mockGetMetadata.mockResolvedValue([{ size: String(FIVE_MB) }]);
    const req = {
      user: { user_id: 't1', _id: 'mongo1' },
      body: {
        request_type: 'plumbing',
        description: 'a valid description here',
        attachments: [{ downloadUrl: 'https://x/a.png', mimeType: 'image/png', storagePath: 'tenant-uploads/t1/a.png' }],
      },
    };
    const res = response();
    await createMaintenance(req, res);
    expect(res.statusCode).toBe(201);
  });

  test('a storagePath-verified attachment over 5MB is rejected, and the maintenance request is never created (no partial record)', async () => {
    const db = makeDb();
    mockGetDb.mockReturnValue(db);
    mockGetMetadata.mockResolvedValue([{ size: String(FIVE_MB + 1) }]);
    const req = {
      user: { user_id: 't1', _id: 'mongo1' },
      body: {
        request_type: 'plumbing',
        description: 'a valid description here',
        // Client claims a tiny size — must be ignored in favor of the real,
        // Firebase-Storage-verified size above.
        attachments: [{ downloadUrl: 'https://x/a.png', mimeType: 'image/png', storagePath: 'tenant-uploads/t1/a.png', size: 1 }],
      },
    };
    const res = response();
    await createMaintenance(req, res);
    expect(res.statusCode).toBe(400);
    expect(db.inserted).toEqual([]);
  });

  test('a PDF attachment over 5MB is rejected — the ceiling applies regardless of MIME type', async () => {
    const db = makeDb();
    mockGetDb.mockReturnValue(db);
    mockGetMetadata.mockResolvedValue([{ size: String(FIVE_MB + 2048) }]);
    const req = {
      user: { user_id: 't1', _id: 'mongo1' },
      body: {
        request_type: 'plumbing',
        description: 'a valid description here',
        attachments: [{ downloadUrl: 'https://x/report.pdf', mimeType: 'application/pdf', storagePath: 'tenant-uploads/t1/report.pdf' }],
      },
    };
    const res = response();
    await createMaintenance(req, res);
    expect(res.statusCode).toBe(400);
    expect(db.inserted).toEqual([]);
  });

  test('no storagePath: falls back to the client-reported size — under 5MB is accepted', async () => {
    mockGetDb.mockReturnValue(makeDb());
    const req = {
      user: { user_id: 't1', _id: 'mongo1' },
      body: {
        request_type: 'plumbing',
        description: 'a valid description here',
        attachments: [{ downloadUrl: 'https://external.example/a.png', mimeType: 'image/png', size: FIVE_MB - 1 }],
      },
    };
    const res = response();
    await createMaintenance(req, res);
    expect(res.statusCode).toBe(201);
    expect(mockGetMetadata).not.toHaveBeenCalled();
  });

  test('no storagePath: falls back to the client-reported size — over 5MB is rejected, no partial record', async () => {
    const db = makeDb();
    mockGetDb.mockReturnValue(db);
    const req = {
      user: { user_id: 't1', _id: 'mongo1' },
      body: {
        request_type: 'plumbing',
        description: 'a valid description here',
        attachments: [{ downloadUrl: 'https://external.example/a.png', mimeType: 'image/png', size: FIVE_MB + 1 }],
      },
    };
    const res = response();
    await createMaintenance(req, res);
    expect(res.statusCode).toBe(400);
    expect(db.inserted).toEqual([]);
  });

  test('no storagePath and no size at all: rejected outright (unverifiable, fail closed), not silently accepted', async () => {
    const db = makeDb();
    mockGetDb.mockReturnValue(db);
    const req = {
      user: { user_id: 't1', _id: 'mongo1' },
      body: {
        request_type: 'plumbing',
        description: 'a valid description here',
        attachments: [{ downloadUrl: 'https://external.example/a.png', mimeType: 'image/png' }],
      },
    };
    const res = response();
    await createMaintenance(req, res);
    expect(res.statusCode).toBe(400);
    expect(db.inserted).toEqual([]);
  });

  test('Firebase Storage lookup failure (object missing/unreadable) falls back to client-reported size rather than 500ing', async () => {
    mockGetDb.mockReturnValue(makeDb());
    mockGetMetadata.mockRejectedValue(new Error('object not found'));
    const req = {
      user: { user_id: 't1', _id: 'mongo1' },
      body: {
        request_type: 'plumbing',
        description: 'a valid description here',
        attachments: [{ downloadUrl: 'https://x/a.png', mimeType: 'image/png', storagePath: 'tenant-uploads/t1/a.png', size: 1024 }],
      },
    };
    const res = response();
    await createMaintenance(req, res);
    expect(res.statusCode).toBe(201);
  });
});

describe('sendTenantReply — 5MB attachment enforcement', () => {
  function seededDb(status = 'pending') {
    const requests = { r1: { request_id: 'r1', user_id: 't1', status, __collection: 'maintenance_requests' } };
    return makeDb({ requests });
  }

  test('a reply attachment over 5MB (Firebase-verified) is rejected, and the request thread is never updated', async () => {
    const db = seededDb();
    mockGetDb.mockReturnValue(db);
    mockGetMetadata.mockResolvedValue([{ size: String(FIVE_MB + 1) }]);
    const req = {
      user: { user_id: 't1', _id: 'mongo1' },
      params: { requestId: 'r1' },
      body: { message: '', attachments: [{ downloadUrl: 'https://x/a.png', mimeType: 'image/png', storagePath: 'tenant-uploads/t1/a.png' }] },
    };
    const res = response();
    await sendTenantReply(req, res);
    expect(res.statusCode).toBe(400);
    expect(db.updates).toEqual([]);
  });

  test('a reply attachment under 5MB (Firebase-verified) is accepted', async () => {
    const db = seededDb();
    mockGetDb.mockReturnValue(db);
    mockGetMetadata.mockResolvedValue([{ size: String(FIVE_MB - 1) }]);
    const req = {
      user: { user_id: 't1', _id: 'mongo1' },
      params: { requestId: 'r1' },
      body: { message: '', attachments: [{ downloadUrl: 'https://x/a.png', mimeType: 'image/png', storagePath: 'tenant-uploads/t1/a.png' }] },
    };
    const res = response();
    await sendTenantReply(req, res);
    expect(res.statusCode).toBe(201);
  });

  test('a reply with an unverifiable attachment (no storagePath, no size) is rejected, fail closed', async () => {
    const db = seededDb();
    mockGetDb.mockReturnValue(db);
    const req = {
      user: { user_id: 't1', _id: 'mongo1' },
      params: { requestId: 'r1' },
      body: { message: '', attachments: [{ downloadUrl: 'https://external.example/a.png', mimeType: 'image/png' }] },
    };
    const res = response();
    await sendTenantReply(req, res);
    expect(res.statusCode).toBe(400);
    expect(db.updates).toEqual([]);
  });

  test('a text-only reply with no attachments is unaffected by the size check', async () => {
    const db = seededDb();
    mockGetDb.mockReturnValue(db);
    const req = { user: { user_id: 't1', _id: 'mongo1' }, params: { requestId: 'r1' }, body: { message: 'still broken' } };
    const res = response();
    await sendTenantReply(req, res);
    expect(res.statusCode).toBe(201);
    expect(mockGetMetadata).not.toHaveBeenCalled();
  });
});
