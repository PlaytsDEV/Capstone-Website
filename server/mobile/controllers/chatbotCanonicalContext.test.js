const fs = require('fs');
const path = require('path');
const { ObjectId } = require('mongoose').Types;

const mockGetDb = jest.fn();
const mockSendGeminiMessage = jest.fn();
const mockResolveTenantAIContext = jest.fn();

jest.mock('../config/database.js', () => ({ getDb: (...args) => mockGetDb(...args) }));
jest.mock('../services/gemini.service.js', () => ({
  sendGeminiMessage: (...args) => mockSendGeminiMessage(...args),
  liveChatQueue: new Map(),
  chatSessions: new Map(),
}));
jest.mock('../services/pushService.js', () => ({
  notifyAdminChatAccepted: jest.fn(),
  notifyChatbotReply: jest.fn(),
}));
jest.mock('../services/tenantContextResolver.js', () => ({
  resolveTenantAIContext: (...args) => mockResolveTenantAIContext(...args),
}));

const { __test, requestAdmin, sendMessage } = require('./chatbot.controller.js');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

const activeContext = {
  tenantName: 'Ava Guest',
  tenantEmail: 'ava@example.com',
  branch: 'Gil Puyat',
  branchRaw: 'gil-puyat',
  branchSource: 'stay',
  roomNumber: 'GP-202',
  bedPosition: 'A-L',
  tenancy: {
    status: 'active',
    isCurrentResident: true,
    occupancyStartedAt: new Date('2026-08-13T00:00:00Z'),
    // A stale reservation date must not become a reminder once occupancy wins.
    scheduledMoveInDate: new Date('2026-08-13T00:00:00Z'),
  },
  currentBill: {
    billingPeriod: 'August 2026',
    status: 'unpaid',
    statusLabel: 'Unpaid',
    totalAmount: 7200,
    remainingAmount: 7200,
    dueDate: new Date('2026-08-23T00:00:00Z'),
    utilityReleased: true,
  },
  contract: {
    status: 'generated',
    displayStatus: 'Prepared Contract Available',
    tenantDocument: { available: true, label: 'Prepared Contract', version: 2 },
  },
  inquiries: [{ category: 'maintenance_concern', status: 'resolved' }],
  recentAnnouncements: [{ title: 'Gil Notice', content: 'Authorized notice.' }],
};

describe('vendored mobile Lily canonical context', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDb.mockReturnValue({ collection: jest.fn() });
    mockResolveTenantAIContext.mockResolvedValue(activeContext);
    mockSendGeminiMessage.mockResolvedValue({ text: 'Your canonical current bill is released.' });
  });

  test('active occupancy suppresses stale move-in reminder wording in the AI prompt', () => {
    const lines = __test.buildTenantContextLines(activeContext, {});
    const prompt = lines.join('\n');

    expect(prompt).toMatch(/active resident/i);
    expect(prompt).toMatch(/move-in completed/i);
    expect(prompt).toMatch(/utilities released/i);
    expect(prompt).toMatch(/maintenance_concern: resolved/i);
    expect(prompt).toMatch(/Gil Notice/);
    expect(prompt).not.toMatch(/scheduled move-in date/i);
    expect(prompt).not.toMatch(/prepare documents|prepare deposits/i);
  });

  test('the live mobile endpoint resolves one canonical snapshot instead of querying legacy collections', async () => {
    const tenantId = new ObjectId();
    const db = { collection: jest.fn() };
    mockGetDb.mockReturnValue(db);
    const req = {
      user: {
        _id: tenantId,
        user_id: 'tenant-firebase-id',
        role: 'tenant',
        name: 'Ava Guest',
        email: 'ava@example.com',
      },
      body: { message: 'Is my utility released?', session_id: 'canonical-session' },
    };
    const res = response();

    await sendMessage(req, res);

    expect(res.statusCode).toBe(200);
    expect(mockResolveTenantAIContext).toHaveBeenCalledWith(
      expect.any(ObjectId),
      req.user,
      { db },
    );
    expect(mockSendGeminiMessage).toHaveBeenCalledWith(
      'canonical-session',
      expect.stringMatching(/Canonical current bill.*utilities released/is),
    );
    expect(db.collection).not.toHaveBeenCalled();
  });

  test('source contains no legacy billing/ticket/reservation context query or shadow chat collection', () => {
    const source = fs.readFileSync(path.join(__dirname, 'chatbot.controller.js'), 'utf8');
    const handler = source.split('async function sendMessage(req, res) {')[1]
      ?.split('\nasync function requestAdmin')[0] || '';

    expect(handler).toContain('resolveTenantAIContext');
    expect(handler).not.toMatch(/collection\(['"]billing['"]\)/);
    expect(handler).not.toMatch(/collection\(['"]tickets['"]\)/);
    expect(handler).not.toMatch(/collection\(['"]reservations['"]\)/);
    expect(source).toContain("collection('chat_conversations')");
    expect(source).not.toContain("collection('chatconversations')");
  });

  test('Lily escalation reuses and reopens the tenant shared inquiry instead of creating a second ticket', async () => {
    const tenantId = new ObjectId();
    const conversationId = new ObjectId();
    const conversationUpdate = jest.fn(async () => ({ matchedCount: 1 }));
    const conversationInsert = jest.fn();
    const conversationFind = jest.fn(async (filter) => {
      if (filter.mobileSessionId) return null;
      return {
        _id: conversationId,
        tenantId,
        branch: 'gil-puyat',
        status: 'resolved',
      };
    });
    const collections = {
      users: {
        findOne: jest.fn(async () => ({
          _id: tenantId,
          user_id: 'tenant-firebase-id',
          name: 'Ava Guest',
          email: 'ava@example.com',
        })),
      },
      live_chat_requests: { insertOne: jest.fn(async () => ({ insertedId: new ObjectId() })) },
      chat_conversations: {
        findOne: conversationFind,
        updateOne: conversationUpdate,
        insertOne: conversationInsert,
      },
      chat_messages: { insertMany: jest.fn() },
    };
    const db = { collection: jest.fn((name) => collections[name]) };
    mockGetDb.mockReturnValue(db);
    const req = {
      user: {
        _id: tenantId,
        user_id: 'tenant-firebase-id',
        role: 'tenant',
        name: 'Ava Guest',
        email: 'ava@example.com',
      },
      body: {
        session_id: 'persistent-concern-session',
        reason: 'The repair issue persists.',
      },
    };
    const res = response();

    await requestAdmin(req, res);

    expect(res.statusCode).toBe(200);
    expect(conversationInsert).not.toHaveBeenCalled();
    expect(conversationUpdate).toHaveBeenCalledWith(
      { _id: conversationId },
      expect.objectContaining({
        $set: expect.objectContaining({
          status: 'open',
          closedAt: null,
          closedBy: null,
          closingNote: '',
        }),
        $push: expect.objectContaining({
          statusHistory: expect.objectContaining({
            $each: [expect.objectContaining({ status: 'open' })],
          }),
        }),
      }),
    );
  });
});
