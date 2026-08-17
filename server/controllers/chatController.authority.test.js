import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const conversationFind = jest.fn();
const conversationFindOne = jest.fn();
const conversationFindById = jest.fn();
const conversationFindByIdAndUpdate = jest.fn();
const messageFind = jest.fn();
const messageUpdateMany = jest.fn();
const messageCreate = jest.fn();
const reservationFindOne = jest.fn();
const userFindById = jest.fn();
const userFind = jest.fn();
const notifyAdminReply = jest.fn();

await jest.unstable_mockModule("../models/index.js", () => ({
  ChatConversation: {
    find: conversationFind,
    findOne: conversationFindOne,
    findById: conversationFindById,
    findByIdAndUpdate: conversationFindByIdAndUpdate,
  },
  ChatMessage: {
    create: messageCreate,
    find: messageFind,
    updateMany: messageUpdateMany,
  },
  Reservation: { findOne: reservationFindOne },
  User: { findById: userFindById, find: userFind },
}));

await jest.unstable_mockModule("../utils/notificationService.js", () => ({
  notify: { general: jest.fn(), adminReply: notifyAdminReply },
}));

await jest.unstable_mockModule("../utils/socket.js", () => ({
  emitToChatAdmins: jest.fn(),
  emitToUser: jest.fn(),
}));

const {
  getAdminConversations,
  getAdminConversationMessages,
  sendAdminMessage,
  sendTenantMessage,
} = await import("./chatController.js");

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

function adminRequest(overrides = {}) {
  return {
    authUser: {
      _id: "507f1f77bcf86cd799439012",
      role: "branch_admin",
      permissions: ["manageUsers"],
      branch: "gil-puyat",
    },
    branchFilter: "gil-puyat",
    query: {},
    params: {},
    ...overrides,
  };
}

describe("chat controller authoritative branch scope", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("branch-admin list ignores a spoofed client branch and queries its trusted branch", async () => {
    const lean = jest.fn(async () => []);
    const limit = jest.fn(() => ({ lean }));
    const sort = jest.fn(() => ({ limit }));
    const populate = jest.fn(() => ({ sort }));
    conversationFind.mockReturnValue({ populate, sort });

    const req = adminRequest({ query: { branch: "guadalupe" } });
    const res = response();
    await getAdminConversations(req, res);

    expect(res.statusCode).toBe(200);
    expect(conversationFind).toHaveBeenCalledWith({ branch: "gil-puyat" });
  });

  test("a cross-branch private-history target is hidden by the scoped resource query", async () => {
    conversationFindOne.mockResolvedValue(null);
    const req = adminRequest({ params: { conversationId: "507f1f77bcf86cd799439011" } });
    const res = response();
    await getAdminConversationMessages(req, res);

    expect(conversationFindOne).toHaveBeenCalledWith({
      _id: expect.any(Object),
      branch: "gil-puyat",
    });
    expect(res.statusCode).toBe(404);
    expect(res.body.code).toBe("CONVERSATION_NOT_FOUND");
    expect(messageFind).not.toHaveBeenCalled();
    expect(messageUpdateMany).not.toHaveBeenCalled();
  });

  test("owner history access is global and does not require Firebase owner claims", async () => {
    const conversation = { _id: "507f1f77bcf86cd799439011", branch: "guadalupe" };
    conversationFindOne.mockResolvedValue(conversation);
    messageUpdateMany.mockResolvedValue({});
    const lean = jest.fn(async () => []);
    const sort = jest.fn(() => ({ lean }));
    const populate = jest.fn(() => ({ sort }));
    messageFind.mockReturnValue({ populate, sort: () => ({ lean }) });
    const req = adminRequest({
      authUser: { _id: "507f1f77bcf86cd799439012", role: "owner", permissions: [] },
      branchFilter: null,
      params: { conversationId: "507f1f77bcf86cd799439011" },
    });
    const res = response();
    await getAdminConversationMessages(req, res);

    expect(conversationFindOne).toHaveBeenCalledWith({ _id: expect.any(Object) });
    expect(res.statusCode).toBe(200);
  });

  test("admin reply notifies the conversation owner only after the ChatMessage is persisted", async () => {
    const conversationId = "507f1f77bcf86cd799439011";
    const tenantId = "507f1f77bcf86cd799439099";
    const messageId = "507f1f77bcf86cd799439014";
    const conversation = {
      _id: conversationId,
      tenantId,
      tenantName: "Ava Guest",
      branch: "gil-puyat",
      status: "open",
      priority: "normal",
      statusHistory: [],
    };
    const persistedMessage = {
      _id: messageId,
      conversationId,
      senderId: "507f1f77bcf86cd799439012",
      senderName: "Branch Admin",
      senderRole: "admin",
      message: "We are checking this now.",
      createdAt: new Date(),
    };

    conversationFindOne.mockResolvedValue(conversation);
    messageCreate.mockResolvedValue(persistedMessage);
    conversationFindByIdAndUpdate.mockResolvedValue({
      ...conversation,
      status: "waiting_tenant",
      unreadTenantCount: 1,
      lastMessage: persistedMessage.message,
    });
    notifyAdminReply.mockResolvedValue({});

    const req = adminRequest({
      params: { conversationId },
      body: { message: persistedMessage.message },
    });
    const res = response();
    await sendAdminMessage(req, res);

    expect(res.statusCode).toBe(200);
    expect(messageCreate).toHaveBeenCalledTimes(1);
    expect(notifyAdminReply).toHaveBeenCalledWith(
      tenantId,
      conversationId,
      messageId,
    );
    expect(messageCreate.mock.invocationCallOrder[0]).toBeLessThan(
      notifyAdminReply.mock.invocationCallOrder[0],
    );
  });

  test("a failed admin ChatMessage write never emits a tenant success notification", async () => {
    const conversationId = "507f1f77bcf86cd799439011";
    conversationFindOne.mockResolvedValue({
      _id: conversationId,
      tenantId: "507f1f77bcf86cd799439099",
      branch: "gil-puyat",
      status: "open",
    });
    messageCreate.mockRejectedValue(new Error("message persistence failed"));

    const res = response();
    await sendAdminMessage(
      adminRequest({
        params: { conversationId },
        body: { message: "This must not notify." },
      }),
      res,
    );

    expect(res.statusCode).toBe(500);
    expect(notifyAdminReply).not.toHaveBeenCalled();
  });

  test("tenant reply reopens a closed shared conversation and clears closure metadata", async () => {
    const tenantId = "507f1f77bcf86cd799439012";
    const conversationId = "507f1f77bcf86cd799439011";
    const tenant = {
      _id: tenantId,
      role: "tenant",
      tenantStatus: "active",
      branch: "gil-puyat",
      firstName: "Ava",
      lastName: "Guest",
      profileImage: "https://example.test/ava.jpg",
    };
    const conversation = {
      _id: conversationId,
      tenantId,
      tenantName: "Ava Guest",
      branch: "gil-puyat",
      priority: "normal",
      status: "closed",
      closedAt: new Date(),
      closedBy: "507f1f77bcf86cd799439013",
      closingNote: "Closed by admin.",
      statusHistory: [],
    };

    userFindById.mockReturnValue({ lean: async () => tenant });
    reservationFindOne.mockReturnValue({
      sort: () => ({ populate: () => ({ lean: async () => null }) }),
    });
    conversationFindById.mockResolvedValue(conversation);
    messageCreate.mockResolvedValue({
      _id: "507f1f77bcf86cd799439014",
      conversationId,
      senderId: tenantId,
      senderName: "Ava Guest",
      senderRole: "tenant",
      message: "The issue persists.",
      createdAt: new Date(),
    });
    conversationFindByIdAndUpdate.mockImplementation(async (_id, update) => ({
      ...conversation,
      ...update.$set,
      unreadAdminCount: 1,
      statusHistory: update.$push.statusHistory.$each,
    }));
    userFind.mockReturnValue({
      select: () => ({ lean: async () => [] }),
    });

    const req = {
      authUser: tenant,
      params: { conversationId },
      body: { message: "The issue persists." },
    };
    const res = response();
    await sendTenantMessage(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body.conversation).toMatchObject({
      id: conversationId,
      status: "open",
      closedAt: null,
      closedBy: null,
      closingNote: "",
    });
    expect(conversationFindByIdAndUpdate).toHaveBeenCalledWith(
      conversationId,
      expect.objectContaining({
        $set: expect.objectContaining({
          status: "open",
          closedAt: null,
          closedBy: null,
          closingNote: "",
        }),
        $push: expect.objectContaining({
          statusHistory: expect.objectContaining({
            $each: [expect.objectContaining({
              status: "open",
              note: expect.stringMatching(/persists.*reopened/i),
            })],
          }),
        }),
      }),
      { new: true },
    );
    expect(notifyAdminReply).not.toHaveBeenCalled();
  });
});
