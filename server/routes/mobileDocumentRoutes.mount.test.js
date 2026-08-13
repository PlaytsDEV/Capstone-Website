import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import express from "express";

/**
 * Real Express-level regression test (not source inspection) for the mount-
 * order hazard flagged during the billing consolidation phase: a router-level
 * `router.use(fn)` runs for EVERY request that reaches the router, even ones
 * that don't match any route defined in it — so if mobileTenantAuth were
 * attached via `router.use(mobileTenantAuth)` instead of per-route, an
 * unauthenticated request to an unrelated /api/m/* path (mounted by a
 * sibling router AFTER this one in server.js) would be wrongly rejected with
 * 401 before ever reaching its real handler.
 *
 * See routes/mobileBillingRoutes.mount.test.js for the original version of
 * this test against the billing bridge.
 */

jest.unstable_mockModule("../middleware/mobileTenantAuth.js", () => ({
  mobileTenantAuth: (req, res) => res.status(401).json({ detail: "Not authenticated" }),
}));
jest.unstable_mockModule("../services/mobileDocumentBridge.js", () => ({
  buildPolicyDocumentPdf: jest.fn(() => null),
  POLICY_DOCUMENT_IDS: [],
}));
jest.unstable_mockModule("../services/mobileUserDocumentService.js", () => ({
  listUserDocuments: jest.fn(),
  uploadUserDocument: jest.fn(),
  getUserDocumentContent: jest.fn(),
  deleteUserDocument: jest.fn(),
}));

const { default: mobileDocumentRoutes } = await import("./mobileDocumentRoutes.js");

let server;
let baseUrl;

beforeEach(async () => {
  const app = express();
  app.use(express.json());
  // Mirror server.js mount order: the document bridge mounted BEFORE the
  // (stand-in) vendored mobile router.
  app.use("/api/m", mobileDocumentRoutes);

  const sibling = express.Router();
  sibling.post("/auth/login", (req, res) => res.status(200).json({ ok: true, route: "sibling-auth-login" }));
  sibling.get("/rooms", (req, res) => res.status(200).json({ ok: true, route: "sibling-rooms" }));
  sibling.get("/contracts/current", (req, res) => res.status(200).json({ ok: true, route: "sibling-contracts-current" }));
  app.use("/api/m", sibling);

  await new Promise((resolve) => {
    server = app.listen(0, "127.0.0.1", resolve);
  });
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe("mobile document router mounting does not swallow unrelated /api/m/* requests", () => {
  test("an unauthenticated POST /api/m/auth/login still reaches the sibling router, not a 401 from the document bridge", async () => {
    const res = await fetch(`${baseUrl}/api/m/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "a@b.com", password: "x" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, route: "sibling-auth-login" });
  });

  test("an unauthenticated GET /api/m/rooms still reaches the sibling router", async () => {
    const res = await fetch(`${baseUrl}/api/m/rooms`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, route: "sibling-rooms" });
  });

  test("an unauthenticated GET /api/m/contracts/current still reaches the sibling router (contracts stay canonical)", async () => {
    const res = await fetch(`${baseUrl}/api/m/contracts/current`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, route: "sibling-contracts-current" });
  });

  test("an unauthenticated GET /api/m/documents/house_rules IS rejected by the document bridge itself (sanity check)", async () => {
    const res = await fetch(`${baseUrl}/api/m/documents/house_rules`);
    expect(res.status).toBe(401);
  });

  test("an unauthenticated GET /api/m/users/documents IS rejected by the document bridge itself (sanity check)", async () => {
    const res = await fetch(`${baseUrl}/api/m/users/documents`);
    expect(res.status).toBe(401);
  });
});
