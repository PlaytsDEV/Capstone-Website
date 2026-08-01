import { jest } from "@jest/globals";

const verifyIdToken = jest.fn();
const lean = jest.fn();
const select = jest.fn(() => ({ lean }));
const findOne = jest.fn(() => ({ select }));
const sendError = jest.fn((res, message, status, code) => res.status(status).json({ error: message, code }));

await jest.unstable_mockModule("../config/firebase.js", () => ({ getAuth: () => ({ verifyIdToken }) }));
await jest.unstable_mockModule("../models/index.js", () => ({
  User: { findOne },
  UserSession: { findValidOtpSession: jest.fn() },
}));
await jest.unstable_mockModule("../config/constants.js", () => ({ CACHE: { TOKEN_TTL_MS: 1000, MAX_TOKEN_ENTRIES: 10 } }));
await jest.unstable_mockModule("../utils/accountStatusCache.js", () => ({
  getCachedAccountStatus: () => undefined, setCachedAccountStatus: jest.fn(), invalidateAccountStatusCache: jest.fn(),
}));
await jest.unstable_mockModule("./errorHandler.js", () => ({ sendError }));

const { verifyToken } = await import("./auth.js");

function res() { return { statusCode: 200, body: null, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } }; }

describe("Firebase revocation-aware middleware behavior", () => {
  beforeEach(() => { jest.clearAllMocks(); lean.mockResolvedValue({ _id: "u1", accountStatus: "active", role: "owner", securityVersion: 0 }); });

  test("valid token is verified with checkRevoked=true and continues", async () => {
    verifyIdToken.mockResolvedValue({ uid: "f1" }); const response = res(); const next = jest.fn();
    await verifyToken({ headers: { authorization: "Bearer valid" }, originalUrl: "/api/private" }, response, next);
    expect(verifyIdToken).toHaveBeenCalledWith("valid", true); expect(next).toHaveBeenCalledTimes(1);
  });

  test.each(["auth/id-token-revoked", "auth/id-token-expired"])("%s fails closed", async (code) => {
    verifyIdToken.mockRejectedValue(Object.assign(new Error("provider rejection"), { code })); const response = res();
    await verifyToken({ headers: { authorization: "Bearer bad" }, originalUrl: "/api/private" }, response, jest.fn());
    expect(response.statusCode).toBe(401); expect(response.body).not.toEqual(expect.objectContaining({ token: expect.anything() }));
  });

  test("provider failure does not grant access", async () => {
    verifyIdToken.mockRejectedValue(new Error("network unavailable")); const next = jest.fn(); const response = res();
    await verifyToken({ headers: { authorization: "Bearer x" }, originalUrl: "/api/private" }, response, next);
    expect(next).not.toHaveBeenCalled(); expect(response.statusCode).toBe(401);
  });

  test("token authenticated before session invalidation is rejected", async () => {
    verifyIdToken.mockResolvedValue({ uid: "f1", auth_time: 100 });
    lean.mockResolvedValue({ _id: "u1", accountStatus: "active", role: "owner", securityVersion: 1, authInvalidatedAt: new Date(101000) });
    const response = res(); const next = jest.fn();
    await verifyToken({ headers: { authorization: "Bearer old" }, originalUrl: "/api/private" }, response, next);
    expect(response.statusCode).toBe(401); expect(response.body.code).toBe("SESSION_REVOKED"); expect(next).not.toHaveBeenCalled();
  });

  test.each([
    ["inactive", { isActive: false, accountStatus: "active" }, "ACCOUNT_ACCESS_RESTRICTED"],
    ["archived", { isArchived: true, accountStatus: "active" }, "ACCOUNT_ACCESS_RESTRICTED"],
    ["suspended", { accountStatus: "suspended" }, "ACCOUNT_SUSPENDED"],
    ["banned", { accountStatus: "banned" }, "ACCOUNT_BANNED"],
  ])("%s canonical account is rejected after valid Firebase verification", async (_label, fields, code) => {
    verifyIdToken.mockResolvedValue({ uid: "f1", auth_time: 200 });
    lean.mockResolvedValue({ _id: "u1", role: "owner", securityVersion: 0, ...fields }); const response = res(); const next = jest.fn();
    await verifyToken({ headers: { authorization: "Bearer valid" }, originalUrl: "/api/private" }, response, next);
    expect(response.statusCode).toBe(403); expect(response.body.code).toBe(code); expect(next).not.toHaveBeenCalled();
  });
});
