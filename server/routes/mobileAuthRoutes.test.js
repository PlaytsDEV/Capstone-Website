import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import express from "express";

/**
 * Real Express-level HTTP tests for POST /api/m/auth/session-teardown,
 * mocking only the mongoose connection so the real route + real
 * mobileSessionTeardownAuth resolver run end-to-end.
 */

function makeDb({ sessions = [], users = [] } = {}) {
  const sessionDeletes = [];
  const userUpdates = [];

  return {
    sessionDeletes,
    userUpdates,
    collection(name) {
      if (name === "user_sessions") {
        return {
          findOne: jest.fn(async (query) => {
            const gate = query.expires_at.$gt;
            return sessions.find((s) => s.session_token === query.session_token && s.expires_at > gate) || null;
          }),
          deleteOne: jest.fn(async (filter) => {
            sessionDeletes.push(filter);
            const before = sessions.length;
            sessions = sessions.filter((s) => String(s._id) !== String(filter._id));
            return { deletedCount: before - sessions.length };
          }),
        };
      }
      if (name === "users") {
        return {
          findOne: jest.fn(async (query) => users.find((u) => u.user_id === query.user_id) || null),
          updateOne: jest.fn(async (filter, update) => {
            userUpdates.push({ filter, update });
            const user = users.find((u) => u.user_id === filter.user_id);
            let matched = 0;
            if (user) {
              if ("push_token" in filter && user.push_token === filter.push_token) matched = 1;
              if ("push_tokens.token" in filter && (user.push_tokens || []).some((t) => t.token === filter["push_tokens.token"])) {
                matched = 1;
              }
            }
            return { matchedCount: matched, modifiedCount: matched };
          }),
        };
      }
      throw new Error(`unexpected collection: ${name}`);
    },
  };
}

let app;
let server;
let baseUrl;
let db;

async function startAppWithDb(seededDb) {
  jest.resetModules();
  db = seededDb;
  jest.unstable_mockModule("mongoose", () => ({ default: { connection: { db } } }));
  jest.unstable_mockModule("../controllers/passwordResetController.js", () => ({
    requestMobileTenantPasswordReset: jest.fn((_req, res) => res.status(202).json({ message: "accepted" })),
  }));
  const { default: mobileAuthRoutes } = await import("./mobileAuthRoutes.js");

  app = express();
  app.use(express.json());
  app.use("/api/m", mobileAuthRoutes);

  const sibling = express.Router();
  sibling.post("/auth/login", (req, res) => res.status(200).json({ ok: true, route: "vendored-auth-login" }));
  app.use("/api/m", sibling);

  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
}

afterEach(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  jest.resetModules();
});

describe("POST /api/m/auth/session-teardown", () => {
  test("valid session → 200 { status: 'ok' }, deletes exactly that one session row", async () => {
    await startAppWithDb(makeDb({
      sessions: [{ _id: "sess-a", session_token: "tok-a", user_id: "tenant-a", expires_at: new Date(Date.now() + 60000) }],
      users: [{ user_id: "tenant-a" }],
    }));
    const res = await fetch(`${baseUrl}/api/m/auth/session-teardown`, {
      method: "POST",
      headers: { Authorization: "Bearer tok-a", "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: "ok" });
    expect(db.sessionDeletes).toEqual([{ _id: "sess-a" }]);
  });

  test("expired session within grace period → 200, cleanup allowed (intended current behavior)", async () => {
    await startAppWithDb(makeDb({
      sessions: [{ _id: "sess-b", session_token: "tok-b", user_id: "tenant-b", expires_at: new Date(Date.now() - 2 * 60 * 1000) }],
      users: [{ user_id: "tenant-b" }],
    }));
    const res = await fetch(`${baseUrl}/api/m/auth/session-teardown`, {
      method: "POST",
      headers: { Authorization: "Bearer tok-b", "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    expect(db.sessionDeletes).toEqual([{ _id: "sess-b" }]);
  });

  test("already-missing/previously-torn-down session → 401, safe idempotent response, no deletion attempted", async () => {
    await startAppWithDb(makeDb({ sessions: [], users: [] }));
    const res = await fetch(`${baseUrl}/api/m/auth/session-teardown`, {
      method: "POST",
      headers: { Authorization: "Bearer already-gone", "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
    expect(db.sessionDeletes).toEqual([]);
  });

  test("random/guessed token → 401, cannot delete any session", async () => {
    await startAppWithDb(makeDb({
      sessions: [{ _id: "sess-real", session_token: "real-token", user_id: "tenant-real", expires_at: new Date(Date.now() + 60000) }],
      users: [{ user_id: "tenant-real" }],
    }));
    const res = await fetch(`${baseUrl}/api/m/auth/session-teardown`, {
      method: "POST",
      headers: { Authorization: "Bearer guessed-random-token", "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
    expect(db.sessionDeletes).toEqual([]);
  });

  test("missing Authorization header → 401, no database access for session lookup", async () => {
    await startAppWithDb(makeDb({ sessions: [], users: [] }));
    const res = await fetch(`${baseUrl}/api/m/auth/session-teardown`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  test("Tenant A's token can only delete Tenant A's own session — body userId for Tenant B is ignored", async () => {
    await startAppWithDb(makeDb({
      sessions: [
        { _id: "sess-A", session_token: "tok-A", user_id: "tenant-A", expires_at: new Date(Date.now() + 60000) },
        { _id: "sess-B", session_token: "tok-B", user_id: "tenant-B", expires_at: new Date(Date.now() + 60000) },
      ],
      users: [{ user_id: "tenant-A" }, { user_id: "tenant-B" }],
    }));
    const res = await fetch(`${baseUrl}/api/m/auth/session-teardown`, {
      method: "POST",
      headers: { Authorization: "Bearer tok-A", "Content-Type": "application/json" },
      body: JSON.stringify({ userId: "tenant-B", user_id: "tenant-B" }),
    });
    expect(res.status).toBe(200);
    // Only Tenant A's session was ever targeted for deletion — Tenant B's
    // session id never appears, regardless of what the body claimed.
    expect(db.sessionDeletes).toEqual([{ _id: "sess-A" }]);
  });

  test("push_token in body disables only that token on the resolved user's own record, scoped by user_id", async () => {
    await startAppWithDb(makeDb({
      sessions: [{ _id: "sess-a", session_token: "tok-a", user_id: "tenant-a", expires_at: new Date(Date.now() + 60000) }],
      users: [{ user_id: "tenant-a", push_token: "device-push-token-123" }],
    }));
    const res = await fetch(`${baseUrl}/api/m/auth/session-teardown`, {
      method: "POST",
      headers: { Authorization: "Bearer tok-a", "Content-Type": "application/json" },
      body: JSON.stringify({ push_token: "device-push-token-123" }),
    });
    expect(res.status).toBe(200);
    const pushTokenUpdate = db.userUpdates.find((u) => u.filter.push_token === "device-push-token-123");
    expect(pushTokenUpdate.filter.user_id).toBe("tenant-a");
    expect(pushTokenUpdate.update.$set.push_token).toBeNull();
  });

  test("does not shadow sibling /api/m/auth/login (per-route middleware only, never router-level)", async () => {
    await startAppWithDb(makeDb());
    const res = await fetch(`${baseUrl}/api/m/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, route: "vendored-auth-login" });
  });
});
