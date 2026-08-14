/**
 * Canonical-mobile reconciliation audit — Gap B, then a follow-up
 * trust-boundary audit on the fix itself:
 *
 * The controller previously only capped attachment COUNT
 * (MAX_TENANT_ATTACHMENTS), never checked byte size at all. A first pass at
 * fixing this verified size via Firebase Storage metadata when a
 * `storagePath` was present, but FELL BACK to the client-reported `size`
 * field whenever `storagePath` was absent — and normalizeAttachmentEntry
 * accepts a remote http(s) URI via many aliased fields (uri/url/downloadUrl/
 * href/src/...) with `storagePath` entirely optional. That meant a client
 * could submit `{ url: "https://example.invalid/huge.pdf", size: 100 }` and
 * have the claimed 100-byte size trusted for an object this backend never
 * touched and has no way to verify — a full trust-boundary bypass of the
 * "5MB max" rule.
 *
 * The rule enforced now: a `storagePath` (an object this backend's own
 * mobileUploadRoutes.js Firebase Storage bridge actually wrote) is REQUIRED.
 * Its real size is fetched from Firebase Storage's own metadata — a
 * provider-confirmed number the client cannot influence — and that is the
 * only number ever used for the security decision. No storagePath, or a
 * storage lookup that fails for any reason, is rejected outright. The
 * client-reported `size` field is never trusted for this decision (it may
 * still ride along on the normalized attachment purely for display).
 *
 * Covers both entry points attachments can come through — createMaintenance
 * and sendTenantReply — plus every accepted attachment shape
 * (uri/url/downloadUrl/bare-string) and an explicit spoof-attempt case
 * (real object >5MB, client claims 100 bytes).
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

describe('createMaintenance — 5MB attachment enforcement (trusted storagePath required)', () => {
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

  test('SPOOF ATTEMPT: real Firebase object is >5MB, client claims size: 100 bytes → rejected, using the verified size', async () => {
    const db = makeDb();
    mockGetDb.mockReturnValue(db);
    mockGetMetadata.mockResolvedValue([{ size: String(FIVE_MB + 500000) }]);
    const req = {
      user: { user_id: 't1', _id: 'mongo1' },
      body: {
        request_type: 'plumbing',
        description: 'a valid description here',
        attachments: [{ downloadUrl: 'https://x/a.png', mimeType: 'image/png', storagePath: 'tenant-uploads/t1/a.png', size: 100 }],
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

  test.each([
    ['uri', { uri: 'https://example.invalid/file.pdf', size: 100 }],
    ['url', { url: 'https://example.invalid/file.pdf', size: 100 }],
    ['downloadUrl', { downloadUrl: 'https://example.invalid/file.pdf', size: 100 }],
    ['bare string URL (no object at all)', 'https://example.invalid/file.pdf'],
    ['size only, no URI field the controller recognizes as a URI... included for completeness', { size: 100 }],
  ])('MISSING TRUSTED IDENTIFIER (%s): no storagePath, client size claim ignored → rejected outright, no partial record', async (_label, attachment) => {
    const db = makeDb();
    mockGetDb.mockReturnValue(db);
    const req = {
      user: { user_id: 't1', _id: 'mongo1' },
      body: {
        request_type: 'plumbing',
        description: 'a valid description here',
        attachments: [attachment],
      },
    };
    const res = response();
    await createMaintenance(req, res);
    // `{ size: 100 }` alone has no URI at all, so normalizeAttachmentEntry
    // drops it before it would ever reach the size check — attachments end
    // up empty and the request is either accepted (no attachments) or, for
    // every URI-bearing shape above, rejected by the size check itself.
    if (typeof attachment === 'object' && !attachment.uri && !attachment.url && !attachment.downloadUrl) {
      expect(res.statusCode).toBe(201);
      return;
    }
    expect(res.statusCode).toBe(400);
    expect(mockGetMetadata).not.toHaveBeenCalled();
    expect(db.inserted).toEqual([]);
  });

  test('Firebase Storage lookup failure (object missing/unreadable) is rejected, NOT trusted via client-reported size', async () => {
    const db = makeDb();
    mockGetDb.mockReturnValue(db);
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
    expect(res.statusCode).toBe(400);
    expect(db.inserted).toEqual([]);
  });
});

describe('sendTenantReply — 5MB attachment enforcement (trusted storagePath required)', () => {
  function seededDb(status = 'pending') {
    const requests = { r1: { request_id: 'r1', user_id: 't1', status, __collection: 'maintenance_requests' } };
    return makeDb({ requests });
  }

  test('reply + valid trusted attachment under 5MB → accepted', async () => {
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

  test('reply + oversized trusted attachment (Firebase-verified >5MB) → rejected, thread never updated', async () => {
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

  test('reply + no storagePath + fake small size → rejected, thread never updated', async () => {
    const db = seededDb();
    mockGetDb.mockReturnValue(db);
    const req = {
      user: { user_id: 't1', _id: 'mongo1' },
      params: { requestId: 'r1' },
      body: { message: '', attachments: [{ downloadUrl: 'https://external.example/a.png', mimeType: 'image/png', size: 100 }] },
    };
    const res = response();
    await sendTenantReply(req, res);
    expect(res.statusCode).toBe(400);
    expect(mockGetMetadata).not.toHaveBeenCalled();
    expect(db.updates).toEqual([]);
  });

  test('SPOOF ATTEMPT on a reply: real object >5MB, client claims 100 bytes → rejected', async () => {
    const db = seededDb();
    mockGetDb.mockReturnValue(db);
    mockGetMetadata.mockResolvedValue([{ size: String(FIVE_MB + 999) }]);
    const req = {
      user: { user_id: 't1', _id: 'mongo1' },
      params: { requestId: 'r1' },
      body: { message: '', attachments: [{ downloadUrl: 'https://x/a.png', mimeType: 'image/png', storagePath: 'tenant-uploads/t1/a.png', size: 100 }] },
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
