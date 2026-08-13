import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";

function fakeDb({ session = null, user = null, deleteMany = jest.fn().mockResolvedValue({}) } = {}) {
  return {
    collection: (name) => {
      if (name === "user_sessions") {
        return { findOne: jest.fn().mockResolvedValue(session), deleteMany };
      }
      if (name === "users") {
        return { findOne: jest.fn().mockResolvedValue(user) };
      }
      throw new Error(`unexpected collection: ${name}`);
    },
  };
}

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

describe("mobileTenantAuth — canonical mobile session authority", () => {
  let mobileTenantAuth;
  let deleteMany;

  beforeEach(async () => {
    jest.resetModules();
    deleteMany = jest.fn().mockResolvedValue({});
  });

  afterEach(() => {
    jest.resetModules();
  });

  async function loadWithDb(db) {
    jest.unstable_mockModule("mongoose", () => ({ default: { connection: { db } } }));
    ({ mobileTenantAuth } = await import("./mobileTenantAuth.js"));
  }

  test("no token → 401, never touches the database", async () => {
    const findOne = jest.fn();
    await loadWithDb({ collection: () => ({ findOne }) });
    const req = { headers: {}, cookies: {} };
    const res = response();
    const next = jest.fn();
    await mobileTenantAuth(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
    expect(findOne).not.toHaveBeenCalled();
  });

  test("token with no matching (or expired) session → 401 'Invalid or expired session'", async () => {
    await loadWithDb(fakeDb({ session: null }));
    const req = { headers: { authorization: "Bearer bad-token" }, cookies: {} };
    const res = response();
    const next = jest.fn();
    await mobileTenantAuth(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body.detail).toMatch(/Invalid or expired session/);
    expect(next).not.toHaveBeenCalled();
  });

  test("session for a deleted user (no matching users doc) → 401, not 500 or a crash", async () => {
    await loadWithDb(fakeDb({ session: { user_id: "tenant-gone", expires_at: new Date(Date.now() + 60000) }, user: null }));
    const req = { headers: { authorization: "Bearer valid-token" }, cookies: {} };
    const res = response();
    const next = jest.fn();
    await mobileTenantAuth(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("valid session for an active tenant → allowed, req.mobileTenant/req.user populated from the session, not from client input", async () => {
    const user = { user_id: "tenant-a", _id: "mongo-a", role: "tenant", email: "a@example.com", branch: "gil-puyat", securityVersion: 0 };
    await loadWithDb(fakeDb({ session: { user_id: "tenant-a", expires_at: new Date(Date.now() + 60000), security_version: 0 }, user }));
    const req = {
      headers: { authorization: "Bearer valid-token" },
      cookies: {},
      body: { userId: "attacker-supplied-id", user_id: "attacker-supplied-id", role: "admin" },
    };
    const res = response();
    const next = jest.fn();
    await mobileTenantAuth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.mobileTenant.user_id).toBe("tenant-a");
    expect(req.user).toEqual({ mongoId: "mongo-a", email: "a@example.com", role: "tenant", branch: "gil-puyat" });
    // client-supplied identity in the body must never override the resolved principal
    expect(req.mobileTenant.user_id).not.toBe("attacker-supplied-id");
    expect(req.user.role).not.toBe("admin");
  });

  test("applicant role is still accepted (existing behavior preserved)", async () => {
    const user = { user_id: "applicant-a", _id: "mongo-b", role: "applicant", securityVersion: 0 };
    await loadWithDb(fakeDb({ session: { user_id: "applicant-a", expires_at: new Date(Date.now() + 60000), security_version: 0 }, user }));
    const req = { headers: { authorization: "Bearer t" }, cookies: {} };
    const res = response();
    const next = jest.fn();
    await mobileTenantAuth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("non-tenant/applicant role → 403, session left alone", async () => {
    const user = { user_id: "admin-a", _id: "mongo-c", role: "admin", securityVersion: 0 };
    await loadWithDb(fakeDb({ session: { user_id: "admin-a", expires_at: new Date(Date.now() + 60000), security_version: 0 }, user, deleteMany }));
    const req = { headers: { authorization: "Bearer t" }, cookies: {} };
    const res = response();
    const next = jest.fn();
    await mobileTenantAuth(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(next).not.toHaveBeenCalled();
    expect(deleteMany).not.toHaveBeenCalled();
  });

  test.each([
    ["isActive === false", { isActive: false }],
    ["is_active === false", { is_active: false }],
    ["isArchived === true", { isArchived: true }],
    ["is_archived === true", { is_archived: true }],
    ["accountStatus === 'suspended'", { accountStatus: "suspended" }],
    ["account_status === 'disabled'", { account_status: "disabled" }],
  ])("disabled/restricted account (%s) → 403 with code ACCOUNT_INACTIVE, matching the standalone backend's wire contract, and clears sessions", async (_label, restriction) => {
    const user = { user_id: "tenant-b", _id: "mongo-d", role: "tenant", securityVersion: 0, ...restriction };
    await loadWithDb(fakeDb({ session: { user_id: "tenant-b", expires_at: new Date(Date.now() + 60000), security_version: 0 }, user, deleteMany }));
    const req = { headers: { authorization: "Bearer t" }, cookies: {} };
    const res = response();
    const next = jest.fn();
    await mobileTenantAuth(req, res, next);
    expect(res.statusCode).toBe(403);
    expect(res.body).toEqual({ code: "ACCOUNT_INACTIVE", detail: "Access denied. Your account is inactive. Please contact admin." });
    expect(next).not.toHaveBeenCalled();
    expect(deleteMany).toHaveBeenCalledWith({ user_id: "tenant-b" });
  });

  test("revoked session (securityVersion no longer matches the user's current version) → 401 SESSION_REVOKED, sessions cleared", async () => {
    const user = { user_id: "tenant-c", _id: "mongo-e", role: "tenant", securityVersion: 2 };
    await loadWithDb(fakeDb({ session: { user_id: "tenant-c", expires_at: new Date(Date.now() + 60000), security_version: 1 }, user, deleteMany }));
    const req = { headers: { authorization: "Bearer stale-token" }, cookies: {} };
    const res = response();
    const next = jest.fn();
    await mobileTenantAuth(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ code: "SESSION_REVOKED", detail: "Your session is no longer valid. Please sign in again." });
    expect(next).not.toHaveBeenCalled();
    expect(deleteMany).toHaveBeenCalledWith({ user_id: "tenant-c" });
  });

  test("a session issued before securityVersion existed (undefined on the session doc) is treated as version 0 — does not break pre-existing standalone-backend-issued sessions", async () => {
    const user = { user_id: "tenant-d", _id: "mongo-f", role: "tenant", securityVersion: 0 };
    await loadWithDb(fakeDb({ session: { user_id: "tenant-d", expires_at: new Date(Date.now() + 60000) /* no security_version field at all */ }, user }));
    const req = { headers: { authorization: "Bearer legacy-token" }, cookies: {} };
    const res = response();
    const next = jest.fn();
    await mobileTenantAuth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("cookie-based session_token is accepted when no Authorization header is present", async () => {
    const user = { user_id: "tenant-e", _id: "mongo-g", role: "tenant", securityVersion: 0 };
    await loadWithDb(fakeDb({ session: { user_id: "tenant-e", expires_at: new Date(Date.now() + 60000), security_version: 0 }, user }));
    const req = { headers: {}, cookies: { session_token: "cookie-token" } };
    const res = response();
    const next = jest.fn();
    await mobileTenantAuth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
