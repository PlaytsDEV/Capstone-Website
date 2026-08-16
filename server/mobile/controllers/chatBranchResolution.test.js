// Regression coverage for chat.controller.js's resolveTenantContext(): it
// previously only checked bedhistories then a narrow reservation status
// list, missing the roomoccupancyhistories and contracts tiers that
// resolveRequesterBranchCode() (announcement.controller.js, already trusted
// by user.controller.js) covers. A tenant whose branch was only resolvable
// via their Contract got "No active tenant." starting a support chat even
// though the rest of the app (e.g. the Contract screen) already knew their
// branch. Mirrors the jest.mock pattern already used for this exact class of
// bug in branchConsistency.test.js.

const mockGetDb = jest.fn();
jest.mock('../config/database.js', () => ({ getDb: (...args) => mockGetDb(...args) }));
jest.mock('uuid', () => ({ v4: () => 'test-uuid-0000-0000-0000-000000000000' }));
// chat.controller.js -> announcement.controller.js -> pushService.js -> firebase-admin (ESM).
jest.mock('../services/pushService.js', () => ({ notifyNewAnnouncement: jest.fn() }));

const { ObjectId } = require('mongodb');
const { startConversation } = require('./chat.controller.js');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function makeDb({
  occupancyDoc = null,
  bedHistoryDoc = null,
  reservationDoc = null,
  contractDoc = null,
  room = null,
  conversations = [],
} = {}) {
  const conversationStore = [...conversations];
  return {
    collection(name) {
      if (name === 'roomoccupancyhistories') return { findOne: async () => occupancyDoc };
      if (name === 'bedhistories') return { findOne: async () => bedHistoryDoc };
      if (name === 'reservations') return { findOne: async () => reservationDoc };
      if (name === 'contracts') return { findOne: async () => contractDoc };
      if (name === 'rooms') return { findOne: async () => room };
      if (name === 'chat_conversations') {
        return {
          findOne: async () => conversationStore.find((c) => c.status !== 'closed') || null,
          insertOne: async (doc) => {
            const record = { ...doc, _id: new ObjectId() };
            conversationStore.push(record);
            return { insertedId: record._id };
          },
          updateOne: async () => ({ matchedCount: 1 }),
        };
      }
      throw new Error(`unexpected collection: ${name}`);
    },
  };
}

describe('chat.controller.js resolveTenantContext — shared branch resolver', () => {
  beforeEach(() => { mockGetDb.mockReset(); });

  test('A. resolves via the contracts tier — a case the old bedhistory/reservation-only lookup could not reach', async () => {
    const tenantId = new ObjectId();
    const db = makeDb({
      contractDoc: { tenantId, isCurrent: true, branch: 'gil-puyat' },
    });
    mockGetDb.mockReturnValue(db);

    const req = { user: { user_id: 't1', _id: tenantId, role: 'tenant' }, body: { category: 'general_inquiry' } };
    const res = response();
    await startConversation(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.conversation.branch).toBe('gil-puyat');
  });

  test('resolves via roomoccupancyhistories (a tier the old lookup skipped entirely)', async () => {
    const tenantId = new ObjectId();
    const db = makeDb({
      occupancyDoc: { tenantId, stayStatus: 'active', branch: 'guadalupe' },
    });
    mockGetDb.mockReturnValue(db);

    const req = { user: { user_id: 't1', _id: tenantId, role: 'tenant' }, body: { category: 'general_inquiry' } };
    const res = response();
    await startConversation(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.conversation.branch).toBe('guadalupe');
  });

  test('still resolves the previously-supported path: active bedhistory + room', async () => {
    const tenantId = new ObjectId();
    const roomId = new ObjectId();
    const db = makeDb({
      bedHistoryDoc: { tenantId, status: 'active', roomId, bedId: 'b1' },
      room: { _id: roomId, roomNumber: '101', branch: 'guadalupe' },
    });
    mockGetDb.mockReturnValue(db);

    const req = { user: { user_id: 't1', _id: tenantId, role: 'tenant' }, body: { category: 'general_inquiry' } };
    const res = response();
    await startConversation(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.conversation.branch).toBe('guadalupe');
    expect(res.body.conversation.roomNumber).toBe('101');
  });

  test('E. tenant with no resolvable branch anywhere gets a 400, never a guessed branch', async () => {
    const tenantId = new ObjectId();
    const db = makeDb({});
    mockGetDb.mockReturnValue(db);

    const req = { user: { user_id: 't1', _id: tenantId, role: 'tenant' }, body: { category: 'general_inquiry' } };
    const res = response();
    await startConversation(req, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.detail).toMatch(/no active tenant/i);
  });

  test('an admin/owner role is rejected as "No active tenant" (403), unaffected by the resolver change', async () => {
    const db = makeDb({});
    mockGetDb.mockReturnValue(db);

    const req = { user: { user_id: 'a1', _id: new ObjectId(), role: 'owner' }, body: { category: 'general_inquiry' } };
    const res = response();
    await startConversation(req, res);

    expect(res.statusCode).toBe(403);
  });
});
