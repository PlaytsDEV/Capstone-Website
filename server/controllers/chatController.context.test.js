import { beforeEach, describe, expect, jest, test } from "@jest/globals";

// Regression coverage for support-conversation "business context" (task:
// a conversation started about a specific Contract should reuse/reopen the
// existing thread about that SAME contract instead of spawning
// "Contract Concern #2", and must never trust a client-supplied
// entityId without verifying the tenant actually owns that record).

const conversationFindOne = jest.fn();
const conversationCreate = jest.fn();
const userFind = jest.fn();
const userFindById = jest.fn();
const reservationFindOne = jest.fn();
const contractExists = jest.fn();

await jest.unstable_mockModule("../models/index.js", () => ({
  ChatConversation: {
    findOne: conversationFindOne,
    create: conversationCreate,
    aggregate: jest.fn(async () => []),
  },
  ChatMessage: {},
  Contract: { exists: contractExists },
  Reservation: { findOne: reservationFindOne },
  User: {
    findById: userFindById,
    find: userFind,
  },
}));

await jest.unstable_mockModule("../utils/notificationService.js", () => ({
  notify: { general: jest.fn(), supportReply: jest.fn() },
}));

await jest.unstable_mockModule("../utils/socket.js", () => ({
  emitToChatAdmins: jest.fn(),
  emitToUser: jest.fn(),
}));

const { startConversation } = await import("./chatController.js");

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

const TENANT_ID = "507f1f77bcf86cd799439011";
const CONTRACT_ID = "507f1f77bcf86cd799439099";

function tenantRequest(body = {}) {
  return {
    authUser: { _id: TENANT_ID, role: "tenant" },
    body,
    params: {},
    query: {},
  };
}

describe("startConversation — contract context", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    userFindById.mockReturnValue({ lean: async () => ({ _id: TENANT_ID, branch: "gil-puyat" }) });
    reservationFindOne.mockReturnValue({
      sort: () => ({
        populate: () => ({
          lean: async () => ({
            roomId: { branch: "gil-puyat", roomNumber: "204" },
          }),
        }),
      }),
    });
    userFind.mockReturnValue({ select: () => ({ lean: async () => [] }) });
  });

  test("a client-supplied contractId the tenant does not own is silently dropped, not trusted", async () => {
    contractExists.mockResolvedValue(null); // tenant does not own this contract
    conversationFindOne.mockReturnValue({ sort: () => Promise.resolve(null) });
    conversationCreate.mockResolvedValue({
      _id: "conv-1",
      tenantId: TENANT_ID,
      toObject() { return this; },
    });

    const req = tenantRequest({
      category: "general_inquiry",
      context: { entityType: "contract", entityId: CONTRACT_ID },
    });
    await startConversation(req, response());

    expect(contractExists).toHaveBeenCalledWith({ _id: CONTRACT_ID, tenantId: TENANT_ID });
    const createArgs = conversationCreate.mock.calls[0][0];
    expect(createArgs.context).toBeUndefined();
  });

  test("a verified contract owner reuses the existing open conversation about that SAME contract", async () => {
    contractExists.mockResolvedValue({ _id: CONTRACT_ID });
    const existing = {
      _id: "conv-existing",
      tenantId: TENANT_ID,
      category: "billing_concern",
      priority: "normal",
      save: jest.fn(async () => {}),
      toObject() { return this; },
    };
    conversationFindOne.mockReturnValue({ sort: () => Promise.resolve(existing) });

    const req = tenantRequest({
      context: { entityType: "contract", entityId: CONTRACT_ID },
    });
    await startConversation(req, response());

    expect(conversationFindOne).toHaveBeenCalledWith(
      expect.objectContaining({
        "context.entityType": "contract",
        "context.entityId": CONTRACT_ID,
      }),
    );
    expect(conversationCreate).not.toHaveBeenCalled();
    expect(existing.save).toHaveBeenCalled();
  });

  test("a contextless request never reuses an existing contract-specific conversation", async () => {
    conversationFindOne.mockReturnValue({ sort: () => Promise.resolve(null) });
    conversationCreate.mockResolvedValue({
      _id: "conv-new",
      tenantId: TENANT_ID,
      toObject() { return this; },
    });

    const req = tenantRequest({ category: "general_inquiry" });
    await startConversation(req, response());

    const filter = conversationFindOne.mock.calls[0][0];
    expect(filter.$or).toEqual(
      expect.arrayContaining([
        { "context.entityType": "" },
        { "context.entityType": { $exists: false } },
      ]),
    );
  });
});
