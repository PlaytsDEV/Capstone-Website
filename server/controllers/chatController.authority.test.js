import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const conversationFind = jest.fn();
const conversationFindOne = jest.fn();
const messageFind = jest.fn();
const messageUpdateMany = jest.fn();

await jest.unstable_mockModule("../models/index.js", () => ({
  ChatConversation: {
    find: conversationFind,
    findOne: conversationFindOne,
    findByIdAndUpdate: jest.fn(),
  },
  ChatMessage: {
    find: messageFind,
    updateMany: messageUpdateMany,
  },
  Reservation: {},
  User: {},
}));

await jest.unstable_mockModule("../utils/notificationService.js", () => ({
  notify: { general: jest.fn() },
}));

await jest.unstable_mockModule("../utils/socket.js", () => ({
  emitToChatAdmins: jest.fn(),
  emitToUser: jest.fn(),
}));

const { getAdminConversations, getAdminConversationMessages } = await import("./chatController.js");

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
});
