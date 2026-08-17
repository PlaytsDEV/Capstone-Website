import { afterAll, beforeEach, describe, expect, jest, test } from "@jest/globals";
import express from "express";
import http from "http";

let authoritativeUser;
let tokenClaims;

const verifyIdToken = jest.fn(async () => tokenClaims);
const controllerCalls = jest.fn();
const userFindOne = jest.fn(() => ({
  select: () => ({
    lean: async () => authoritativeUser,
  }),
}));

await jest.unstable_mockModule("../config/firebase.js", () => ({
  getAuth: () => ({ verifyIdToken }),
}));

await jest.unstable_mockModule("../models/index.js", () => ({
  INQUIRY_BRANCHES: ["gil-puyat", "guadalupe", "general"],
  User: { findOne: userFindOne },
  UserSession: {
    findValidSession: jest.fn(async () => ({
      assuranceMethod: ["branch_admin", "owner"].includes(authoritativeUser?.role)
        ? "admin_password"
        : "login_otp",
      otpVerifiedAt: ["branch_admin", "owner"].includes(authoritativeUser?.role)
        ? null
        : new Date(),
      securityVersion: authoritativeUser?.securityVersion || 0,
      save: jest.fn(async () => {}),
    })),
  },
}));

const controller = (req, res) => {
  controllerCalls(req.method, req.path, req.authUser, req.branchFilter);
  res.json({ ok: true, branchFilter: req.branchFilter ?? null });
};

await jest.unstable_mockModule("../controllers/chatController.js", () => ({
  getAdminConversations: controller,
  getAdminConversationMessages: controller,
  sendAdminMessage: controller,
  markAdminConversationRead: controller,
  assignAdminConversation: controller,
  updateAdminConversationStatus: controller,
  updateAdminConversationPriority: controller,
  closeAdminConversation: controller,
  broadcastTyping: controller,
  startConversation: controller,
  getMyConversations: controller,
  getConversationMessages: controller,
  sendTenantMessage: controller,
  reopenTenantConversation: controller,
}));

const chatRoutes = (await import("./chatRoutes.js")).default;
const app = express();
app.use(express.json());
app.use("/chat", chatRoutes);
const server = http.createServer(app);
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address();

const ADMIN_ROUTES = [
  ["GET", "/chat/admin/conversations"],
  ["GET", "/chat/admin/conversations/507f1f77bcf86cd799439011/messages"],
  ["POST", "/chat/admin/conversations/507f1f77bcf86cd799439011/messages"],
  ["PATCH", "/chat/admin/conversations/507f1f77bcf86cd799439011/read"],
  ["PATCH", "/chat/admin/conversations/507f1f77bcf86cd799439011/assign"],
  ["PATCH", "/chat/admin/conversations/507f1f77bcf86cd799439011/status"],
  ["PATCH", "/chat/admin/conversations/507f1f77bcf86cd799439011/priority"],
  ["PATCH", "/chat/admin/conversations/507f1f77bcf86cd799439011/close"],
];

async function call(method, path) {
  const response = await fetch(`http://127.0.0.1:${port}${path}`, {
    method,
    headers: {
      authorization: "Bearer test-token",
      "content-type": "application/json",
      "x-device-id": "device-1",
      "x-session-id": "session-1",
    },
    body: method === "GET" ? undefined : "{}",
  });
  return { status: response.status, body: await response.json() };
}

describe("web admin chat database authority", () => {
  beforeEach(() => {
    controllerCalls.mockClear();
    tokenClaims = { uid: "firebase-user" };
    authoritativeUser = {
      _id: "507f1f77bcf86cd799439012",
      firebaseUid: "firebase-user",
      role: "tenant",
      permissions: [],
      branch: "gil-puyat",
      accountStatus: "active",
      securityVersion: 0,
    };
  });

  test.each([
    ["stale owner", { role: "owner", owner: true, permissions: ["manageUsers"] }],
    ["stale branch admin", { role: "branch_admin", branch_admin: true, permissions: ["manageUsers"] }],
  ])("a downgraded tenant with %s claims is denied on every admin route", async (_label, staleClaims) => {
    tokenClaims = { uid: "firebase-user", ...staleClaims };
    for (const [method, path] of ADMIN_ROUTES) {
      const result = await call(method, path);
      expect(result.status).toBe(403);
    }
    expect(controllerCalls).not.toHaveBeenCalled();
  });

  test("a branch admin requires manageUsers and receives only the database branch", async () => {
    authoritativeUser = { ...authoritativeUser, role: "branch_admin", permissions: ["manageUsers"], branch: "gil-puyat" };
    tokenClaims = { uid: "firebase-user", role: "tenant", branch: "guadalupe" };
    const result = await call("GET", "/chat/admin/conversations?branch=guadalupe");
    expect(result.status).toBe(200);
    expect(result.body.branchFilter).toBe("gil-puyat");
    expect(controllerCalls).toHaveBeenCalledTimes(1);

    const action = await call("POST", "/chat/admin/conversations/507f1f77bcf86cd799439011/messages");
    expect(action.status).toBe(200);
    expect(action.body.branchFilter).toBe("gil-puyat");
    expect(controllerCalls).toHaveBeenCalledTimes(2);
  });

  test("a branch admin without manageUsers is denied before the controller", async () => {
    authoritativeUser = { ...authoritativeUser, role: "branch_admin", permissions: [], branch: "gil-puyat" };
    const result = await call("GET", "/chat/admin/conversations");
    expect(result.status).toBe(403);
    expect(controllerCalls).not.toHaveBeenCalled();
  });

  test("an authoritative owner is allowed even when token claims say tenant", async () => {
    authoritativeUser = { ...authoritativeUser, role: "owner", permissions: [] };
    tokenClaims = { uid: "firebase-user", role: "tenant" };
    const result = await call("GET", "/chat/admin/conversations");
    expect(result.status).toBe(200);
    expect(result.body.branchFilter).toBeNull();
    expect(controllerCalls).toHaveBeenCalledTimes(1);
  });

  test("stale privileged claims cannot replace a missing MongoDB identity", async () => {
    authoritativeUser = null;
    tokenClaims = { uid: "firebase-user", role: "owner", owner: true, permissions: ["manageUsers"] };
    const result = await call("GET", "/chat/admin/conversations");
    expect(result.status).toBe(401);
    expect(result.body.error.code).toBe("AUTHENTICATION_FAILED");
    expect(controllerCalls).not.toHaveBeenCalled();
  });

  test("an authenticated tenant can reach the canonical reopen lifecycle route", async () => {
    const result = await call(
      "PATCH",
      "/chat/507f1f77bcf86cd799439011/reopen",
    );
    expect(result.status).toBe(200);
    expect(controllerCalls).toHaveBeenCalledWith(
      "PATCH",
      "/507f1f77bcf86cd799439011/reopen",
      expect.objectContaining({ role: "tenant" }),
      undefined,
    );
  });
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});
