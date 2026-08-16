import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";

function fakeDb({ session = null, user = null } = {}) {
  return {
    collection: (name) => {
      if (name === "user_sessions") {
        return { findOne: jest.fn().mockResolvedValue(session) };
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

describe("mobileSessionTeardownAuth — narrow teardown-only resolver", () => {
  let mobileSessionTeardownAuth;

  beforeEach(() => {
    jest.resetModules();
  });

  afterEach(() => {
    jest.resetModules();
  });

  async function loadWithDb(db) {
    jest.unstable_mockModule("mongoose", () => ({ default: { connection: { db } } }));
    ({ mobileSessionTeardownAuth } = await import("./mobileSessionTeardownAuth.js"));
  }

  test("missing token → 401, never touches the database", async () => {
    const findOne = jest.fn();
    await loadWithDb({ collection: () => ({ findOne }) });
    const req = { headers: {}, cookies: {} };
    const res = response();
    const next = jest.fn();
    await mobileSessionTeardownAuth(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
    expect(findOne).not.toHaveBeenCalled();
  });

  test("random/forged/guessed token → 401, cannot resolve to any session (no arbitrary session deletion)", async () => {
    await loadWithDb(fakeDb({ session: null }));
    const req = { headers: { authorization: "Bearer totally-made-up" }, cookies: {} };
    const res = response();
    const next = jest.fn();
    await mobileSessionTeardownAuth(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(res.body.detail).toMatch(/Invalid or expired session/);
    expect(next).not.toHaveBeenCalled();
  });

  test("already-deleted/cleaned-up session token → 401, safe idempotent response, not a crash", async () => {
    await loadWithDb(fakeDb({ session: null }));
    const req = { headers: { authorization: "Bearer previously-torn-down" }, cookies: {} };
    const res = response();
    const next = jest.fn();
    await mobileSessionTeardownAuth(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("session for a since-deleted user → 401, not a 500/crash", async () => {
    await loadWithDb(fakeDb({
      session: { _id: "sess-1", user_id: "gone", expires_at: new Date(Date.now() + 60000) },
      user: null,
    }));
    const req = { headers: { authorization: "Bearer t" }, cookies: {} };
    const res = response();
    const next = jest.fn();
    await mobileSessionTeardownAuth(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("still-active, non-expired session → allowed, identity derived from the resolved session/user only", async () => {
    const user = { user_id: "tenant-a", _id: "mongo-a" };
    await loadWithDb(fakeDb({
      session: { _id: "sess-a", user_id: "tenant-a", expires_at: new Date(Date.now() + 60000) },
      user,
    }));
    const req = {
      headers: { authorization: "Bearer valid-token" },
      cookies: {},
      body: { userId: "attacker-supplied-id" },
    };
    const res = response();
    const next = jest.fn();
    await mobileSessionTeardownAuth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.mobileTeardownUser.user_id).toBe("tenant-a");
    expect(req.mobileTeardownSession._id).toBe("sess-a");
    // client-supplied identity in the body must never influence resolution
    expect(req.mobileTeardownUser.user_id).not.toBe("attacker-supplied-id");
  });

  test("expired-but-within-grace-period session → still allowed (intended cleanup-after-expiry behavior)", async () => {
    const user = { user_id: "tenant-b", _id: "mongo-b" };
    const findOne = jest.fn().mockImplementation((query) => {
      // Simulate a real Mongo query: only match if the expires_at gate
      // ($gt: now - grace) would actually admit this 2-minutes-expired doc.
      const gate = query.expires_at.$gt;
      const sessionExpiredAt = new Date(Date.now() - 2 * 60 * 1000);
      if (sessionExpiredAt > gate) {
        return Promise.resolve({ _id: "sess-b", user_id: "tenant-b", expires_at: sessionExpiredAt });
      }
      return Promise.resolve(null);
    });
    await loadWithDb({
      collection: (name) => {
        if (name === "user_sessions") return { findOne };
        if (name === "users") return { findOne: jest.fn().mockResolvedValue(user) };
        throw new Error(`unexpected collection: ${name}`);
      },
    });
    const req = { headers: { authorization: "Bearer expired-2-min-ago" }, cookies: {} };
    const res = response();
    const next = jest.fn();
    await mobileSessionTeardownAuth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.mobileTeardownUser.user_id).toBe("tenant-b");
  });

  test("session expired well past the grace period → 401 (grace window is bounded, not infinite)", async () => {
    const findOne = jest.fn().mockImplementation((query) => {
      const gate = query.expires_at.$gt;
      const sessionExpiredAt = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
      if (sessionExpiredAt > gate) {
        return Promise.resolve({ _id: "sess-c", user_id: "tenant-c", expires_at: sessionExpiredAt });
      }
      return Promise.resolve(null);
    });
    await loadWithDb({
      collection: (name) => {
        if (name === "user_sessions") return { findOne };
        if (name === "users") return { findOne: jest.fn() };
        throw new Error(`unexpected collection: ${name}`);
      },
    });
    const req = { headers: { authorization: "Bearer long-expired" }, cookies: {} };
    const res = response();
    const next = jest.fn();
    await mobileSessionTeardownAuth(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });

  test("cookie-based session_token is accepted when no Authorization header is present", async () => {
    const user = { user_id: "tenant-d", _id: "mongo-d" };
    await loadWithDb(fakeDb({
      session: { _id: "sess-d", user_id: "tenant-d", expires_at: new Date(Date.now() + 60000) },
      user,
    }));
    const req = { headers: {}, cookies: { session_token: "cookie-token" } };
    const res = response();
    const next = jest.fn();
    await mobileSessionTeardownAuth(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("db error → 401 Authentication error, not a 500/crash", async () => {
    await loadWithDb({
      collection: () => ({ findOne: jest.fn().mockRejectedValue(new Error("boom")) }),
    });
    const req = { headers: { authorization: "Bearer t" }, cookies: {} };
    const res = response();
    const next = jest.fn();
    await mobileSessionTeardownAuth(req, res, next);
    expect(res.statusCode).toBe(401);
    expect(next).not.toHaveBeenCalled();
  });
});
