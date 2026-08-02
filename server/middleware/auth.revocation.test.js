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

const { verifyToken, verifyOnboardingToken, verifyAdmin, verifyOwner, verifyResourceOwnership } = await import("./auth.js");

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

  test("valid privileged claims cannot authorize a missing database identity", async () => {
    verifyIdToken.mockResolvedValue({ uid: "deleted", owner: true, branch_admin: true, permissions: ["manageUsers"] });
    lean.mockResolvedValue(null);
    const request = { headers: { authorization: "Bearer old-owner" }, originalUrl: "/api/users" };
    const response = res();
    const protectedController = jest.fn();

    await verifyToken(request, response, protectedController);

    expect(response.statusCode).toBe(401);
    expect(response.body).toEqual({ error: "Authentication failed.", code: "AUTHENTICATION_FAILED" });
    expect(request.user).toBeUndefined();
    expect(request.authUser).toBeUndefined();
    expect(protectedController).not.toHaveBeenCalled();

    const adminNext = jest.fn();
    const ownerNext = jest.fn();
    await verifyAdmin(request, res(), adminNext);
    await verifyOwner(request, res(), ownerNext);
    expect(adminNext).not.toHaveBeenCalled();
    expect(ownerNext).not.toHaveBeenCalled();
  });

  test("Firebase-only identity is isolated to onboarding middleware", async () => {
    verifyIdToken.mockResolvedValue({ uid: "new-user", email: "new@example.test" });
    lean.mockResolvedValue(null);
    const onboardingRequest = { headers: { authorization: "Bearer new" } };
    const onboardingNext = jest.fn();
    await verifyOnboardingToken(onboardingRequest, res(), onboardingNext);
    expect(onboardingNext).toHaveBeenCalledTimes(1);
    expect(onboardingRequest.onboardingIdentity).toBe(true);
    expect(onboardingRequest.authUser).toBeUndefined();

    const protectedNext = jest.fn();
    const response = res();
    await verifyToken({ headers: { authorization: "Bearer new" }, originalUrl: "/api/private" }, response, protectedNext);
    expect(response.statusCode).toBe(401);
    expect(protectedNext).not.toHaveBeenCalled();
  });

  test("stale privileged claims do not bypass resource ownership", () => {
    const response = res();
    const next = jest.fn();
    verifyResourceOwnership("tenantId")({
      user: { uid: "f1", owner: true, branch_admin: true },
      authUser: { _id: "u1", firebaseUid: "f1", role: "tenant" },
      params: { tenantId: "u2" }, query: {}, body: {},
    }, response, next);
    expect(response.statusCode).toBe(403);
    expect(response.body.code).toBe("IDOR_ACCESS_DENIED");
    expect(next).not.toHaveBeenCalled();
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
