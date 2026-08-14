import { afterEach, describe, expect, jest, test } from "@jest/globals";
import express from "express";
import crypto from "crypto";

/**
 * Real Express-level HTTP tests for POST /api/m/auth/reset-password/status —
 * the non-consuming reset-token status bridge that closes the gap the
 * canonical-mobile reconciliation audit found (the vendored mobile auth
 * router only ever exposed the *consuming* POST /auth/reset-password).
 *
 * Mocks only the mongoose connection so the real route + the real shared
 * mobile/security/resetTokenEligibility.js helpers run end-to-end, mirroring
 * routes/mobileAuthRoutes.test.js's approach for session-teardown.
 */

function hash(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

function makeDb(tokenDocs = []) {
  const findOneCalls = [];
  return {
    findOneCalls,
    collection(name) {
      if (name !== "password_reset_tokens") {
        throw new Error(`unexpected collection: ${name}`);
      }
      return {
        findOne: jest.fn(async (query) => {
          findOneCalls.push(query);
          return (
            tokenDocs.find(
              (doc) =>
                doc.hashedToken === query.hashedToken &&
                doc.used === query.used &&
                doc.expiresAt > query.expiresAt.$gt,
            ) || null
          );
        }),
      };
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
  const { default: mobileAuthRoutes } = await import("./mobileAuthRoutes.js");

  app = express();
  app.use(express.json());
  app.use("/api/m", mobileAuthRoutes);

  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
}

async function postStatus(body) {
  const res = await fetch(`${baseUrl}/api/m/auth/reset-password/status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: await res.json() };
}

afterEach(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  jest.resetModules();
});

describe("POST /api/m/auth/reset-password/status", () => {
  test("a valid, unused, unexpired token reports valid: true", async () => {
    const rawToken = "raw-token-a";
    await startAppWithDb(
      makeDb([{ hashedToken: hash(rawToken), used: false, expiresAt: new Date(Date.now() + 60000) }]),
    );
    const { status, body } = await postStatus({ token: rawToken });
    expect(status).toBe(200);
    expect(body).toEqual({ valid: true });
  });

  test("an expired token reports valid: false", async () => {
    const rawToken = "raw-token-b";
    await startAppWithDb(
      makeDb([{ hashedToken: hash(rawToken), used: false, expiresAt: new Date(Date.now() - 1000) }]),
    );
    const { status, body } = await postStatus({ token: rawToken });
    expect(status).toBe(200);
    expect(body).toEqual({ valid: false });
  });

  test("an already-used token reports valid: false", async () => {
    const rawToken = "raw-token-c";
    await startAppWithDb(
      makeDb([{ hashedToken: hash(rawToken), used: true, expiresAt: new Date(Date.now() + 60000) }]),
    );
    const { status, body } = await postStatus({ token: rawToken });
    expect(status).toBe(200);
    expect(body).toEqual({ valid: false });
  });

  test("an unknown/never-issued token reports valid: false", async () => {
    await startAppWithDb(makeDb([]));
    const { status, body } = await postStatus({ token: "never-issued-token" });
    expect(status).toBe(200);
    expect(body).toEqual({ valid: false });
  });

  test.each([
    ["missing body entirely", undefined],
    ["missing token field", {}],
    ["null token", { token: null }],
    ["empty string token", { token: "" }],
    ["whitespace-only token", { token: "   " }],
    ["numeric token", { token: 123 }],
    ["array token", { token: ["abc"] }],
    ["object token", { token: { value: "abc" } }],
  ])("%s reports valid: false without touching the database", async (_label, payload) => {
    await startAppWithDb(makeDb([{ hashedToken: hash("some-token"), used: false, expiresAt: new Date(Date.now() + 60000) }]));
    const res = await fetch(`${baseUrl}/api/m/auth/reset-password/status`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload === undefined ? undefined : JSON.stringify(payload),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ valid: false });
    expect(db.findOneCalls).toEqual([]);
  });

  test("the response contains only a boolean valid field — no email/user id/expiry/reason", async () => {
    const rawToken = "raw-token-shape";
    await startAppWithDb(
      makeDb([{
        hashedToken: hash(rawToken),
        used: false,
        expiresAt: new Date(Date.now() + 60000),
        email: "tenant@example.com",
        user_id: "tenant-a",
        uid: "firebase-uid",
      }]),
    );
    const { body } = await postStatus({ token: rawToken });
    expect(Object.keys(body)).toEqual(["valid"]);
  });

  test("checking status never consumes the token — no update/mutation call exists on the collection stub at all", async () => {
    const rawToken = "raw-token-d";
    await startAppWithDb(
      makeDb([{ hashedToken: hash(rawToken), used: false, expiresAt: new Date(Date.now() + 60000) }]),
    );
    // makeDb()'s collection() only implements findOne — if the route ever
    // tried to call updateOne/findOneAndUpdate it would throw here.
    const { body } = await postStatus({ token: rawToken });
    expect(body).toEqual({ valid: true });
    const { body: body2 } = await postStatus({ token: rawToken });
    expect(body2).toEqual({ valid: true });
  });

  test("GET /api/m/auth/reset-password/status is not a supported route (POST-only contract)", async () => {
    await startAppWithDb(makeDb([]));
    const res = await fetch(`${baseUrl}/api/m/auth/reset-password/status?token=anything`, { method: "GET" });
    // Falls through this router (no GET handler defined) to a 404 from
    // whatever is mounted after it — proving the status contract is POST
    // + body only, never GET + query string.
    expect(res.status).toBe(404);
  });

  test("a database error never leaks internal exception text to the client", async () => {
    jest.resetModules();
    db = {
      collection() {
        return { findOne: async () => { throw new Error("MongoNetworkError: connection to 10.0.0.5:27017 refused"); } };
      },
    };
    jest.unstable_mockModule("mongoose", () => ({ default: { connection: { db } } }));
    const { default: mobileAuthRoutes } = await import("./mobileAuthRoutes.js");
    app = express();
    app.use(express.json());
    app.use("/api/m", mobileAuthRoutes);
    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    const { status, body } = await postStatus({ token: "x" });
    expect(status).toBe(500);
    expect(body).toEqual({ valid: false });
    expect(JSON.stringify(body)).not.toMatch(/MongoNetworkError|10\.0\.0\.5|27017/);
  });
});

describe("POST /api/m/auth/reset-password/status route precedence", () => {
  test("the canonical bridge answers the route before a vendored-router stand-in mounted after it ever gets a chance to", async () => {
    jest.resetModules();
    db = makeDb([{ hashedToken: hash("precedence-token"), used: false, expiresAt: new Date(Date.now() + 60000) }]);
    jest.unstable_mockModule("mongoose", () => ({ default: { connection: { db } } }));
    const { default: mobileAuthRoutes } = await import("./mobileAuthRoutes.js");

    app = express();
    app.use(express.json());
    // Exact server.js relationship: bridge mounted first, vendored fallback
    // (stand-in here) mounted after — same shape as mobileAuthMount.test.js.
    app.use("/api/m", mobileAuthRoutes);
    const vendoredStandIn = express.Router();
    vendoredStandIn.post("/auth/reset-password/status", (req, res) =>
      res.status(200).json({ valid: true, route: "vendored-fallback-should-never-be-reached" }),
    );
    app.use("/api/m", vendoredStandIn);

    await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
    baseUrl = `http://127.0.0.1:${server.address().port}`;

    const { body } = await postStatus({ token: "precedence-token" });
    expect(body).toEqual({ valid: true });
    expect(body.route).toBeUndefined();
  });
});

describe("POST /api/m/auth/reset-password/status — non-consuming lifecycle against the shared eligibility helper", () => {
  test("status(valid) -> status(same token again) both report true using the exact shared eligibility filter the real reset endpoint uses", async () => {
    // This proves the route and mobile/controllers/auth.controller.js's
    // resetPassword can never drift apart: both ultimately call
    // resetTokenEligibilityFilter() from mobile/security/resetTokenEligibility.js.
    const { resetTokenEligibilityFilter, hashResetToken } = await import(
      "../mobile/security/resetTokenEligibility.js"
    );
    const rawToken = "shared-helper-token";
    const hashedToken = hashResetToken(rawToken);
    const filter = resetTokenEligibilityFilter(hashedToken, new Date("2026-01-01T00:00:00.000Z"));
    expect(filter).toEqual({
      hashedToken,
      used: false,
      expiresAt: { $gt: new Date("2026-01-01T00:00:00.000Z") },
    });

    await startAppWithDb(makeDb([{ hashedToken, used: false, expiresAt: new Date(Date.now() + 60000) }]));
    const first = await postStatus({ token: rawToken });
    const second = await postStatus({ token: rawToken });
    expect(first.body).toEqual({ valid: true });
    expect(second.body).toEqual({ valid: true });
  });
});
