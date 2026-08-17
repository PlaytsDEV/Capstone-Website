const mockGetDb = jest.fn();
const mockEmitToChatAdmins = jest.fn();

jest.mock('../config/database.js', () => ({ getDb: (...args) => mockGetDb(...args) }));
jest.mock('./announcement.controller.js', () => ({
  resolveRequesterBranchCode: jest.fn(async () => 'gil-puyat'),
  normalizedBranchReference: (value) => String(value || '').trim().toLowerCase(),
}));
jest.mock('../utils/socket', () => ({
  emitToChatAdmins: (...args) => mockEmitToChatAdmins(...args),
}), { virtual: true });

const { ObjectId } = require('mongodb');
const { reopenConversation, sendMessage } = require('./chat.controller.js');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function applyConversationUpdate(conversation, update) {
  Object.assign(conversation, update.$set || {});
  for (const [field, increment] of Object.entries(update.$inc || {})) {
    conversation[field] = (conversation[field] || 0) + increment;
  }
  const historyUpdate = update.$push?.statusHistory;
  if (historyUpdate) {
    conversation.statusHistory = [
      ...(conversation.statusHistory || []),
      ...(historyUpdate.$each || [historyUpdate]),
    ].slice(historyUpdate.$slice || -25);
  }
}

function makeDb(conversation) {
  const messages = [];
  return {
    messages,
    collection(name) {
      if (name === 'bedhistories') return { findOne: async () => null };
      if (name === 'chat_conversations') {
        return {
          findOne: async ({ _id }) => (String(_id) === String(conversation._id) ? conversation : null),
          updateOne: async (_filter, update) => {
            applyConversationUpdate(conversation, update);
            return { matchedCount: 1 };
          },
        };
      }
      if (name === 'chat_messages') {
        return {
          insertOne: async (document) => {
            document._id = new ObjectId();
            messages.push(document);
            return { insertedId: document._id };
          },
        };
      }
      if (name === 'users') {
        return { find: () => ({ toArray: async () => [] }) };
      }
      throw new Error(`unexpected collection: ${name}`);
    },
  };
}

function closedConversation(tenantId, overrides = {}) {
  return {
    _id: new ObjectId(),
    tenantId,
    tenantUserId: 'tenant-firebase-id',
    tenantName: 'Ava Guest',
    branch: 'gil-puyat',
    status: 'closed',
    priority: 'normal',
    unreadAdminCount: 0,
    closedAt: new Date('2026-08-16T08:00:00Z'),
    closedBy: new ObjectId(),
    closingNote: 'Marked solved by admin.',
    statusHistory: [{ status: 'closed', note: 'Marked solved by admin.' }],
    ...overrides,
  };
}

function request(conversation, tenantId, body) {
  return {
    user: {
      _id: tenantId,
      user_id: 'tenant-firebase-id',
      role: 'tenant',
      branch: 'gil-puyat',
      name: 'Ava Guest',
    },
    params: { conversationId: String(conversation._id) },
    body,
  };
}

describe('mobile support chat persistent-concern lifecycle', () => {
  beforeEach(() => {
    mockGetDb.mockReset();
    mockEmitToChatAdmins.mockReset();
  });

  test('replying to a closed concern reopens the same thread and preserves its identity/history', async () => {
    const tenantId = new ObjectId();
    const conversation = closedConversation(tenantId);
    const db = makeDb(conversation);
    mockGetDb.mockReturnValue(db);
    const res = response();

    await sendMessage(
      request(conversation, tenantId, { message: 'The leak is still happening.' }),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.conversation.id).toBe(String(conversation._id));
    expect(res.body.conversation.status).toBe('open');
    expect(res.body.conversation.closedAt).toBeNull();
    expect(res.body.conversation.closedBy).toBeNull();
    expect(res.body.conversation.closingNote).toBe('');
    expect(res.body.conversation.statusHistory.at(-1)).toMatchObject({
      status: 'open',
      note: expect.stringMatching(/persists.*reopened/i),
    });
    expect(db.messages).toHaveLength(1);
    expect(db.messages[0].conversationId).toEqual(conversation._id);
    expect(mockEmitToChatAdmins).toHaveBeenCalledWith(
      'gil-puyat',
      'chat:conversation-updated',
      expect.objectContaining({ id: String(conversation._id), status: 'open' }),
    );
  });

  test('the explicit reopen endpoint reactivates a resolved concern without creating a message', async () => {
    const tenantId = new ObjectId();
    const conversation = closedConversation(tenantId, {
      status: 'resolved',
      closedAt: null,
      closedBy: null,
      closingNote: '',
    });
    const db = makeDb(conversation);
    mockGetDb.mockReturnValue(db);
    const res = response();

    await reopenConversation(
      request(conversation, tenantId, { note: 'The repair did not hold.' }),
      res,
    );

    expect(res.statusCode).toBe(200);
    expect(res.body.conversation).toMatchObject({
      id: String(conversation._id),
      status: 'open',
    });
    expect(res.body.conversation.statusHistory.at(-1)).toMatchObject({
      status: 'open',
      note: 'The repair did not hold.',
    });
    expect(db.messages).toHaveLength(0);
  });
});
