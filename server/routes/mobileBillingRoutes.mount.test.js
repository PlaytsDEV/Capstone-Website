import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import express from "express";

/**
 * Real Express-level regression test (not source inspection) for the exact
 * bug class this router is at risk of: a router-level `router.use(fn)` runs
 * for EVERY request that reaches the router, even ones that don't match any
 * route defined in it — so if mobileTenantAuth were attached via
 * `router.use(mobileTenantAuth)` instead of per-route, an unauthenticated
 * request to an unrelated /api/m/* path (e.g. /api/m/auth/login, mounted by
 * a sibling router AFTER this one in server.js) would be wrongly rejected
 * with 401 before ever reaching its real handler, because mobileTenantAuth
 * ends the response instead of calling next() on failure.
 *
 * This mounts the real mobileBillingRoutes + mobilePaymongoRoutes routers
 * (mocking only their DB/PayMongo dependencies) alongside a stand-in
 * "sibling" router the same way server.js mounts mobileRoutes after them,
 * starts a real HTTP server on an ephemeral port, and asserts an
 * unauthenticated request to a sibling-only path still reaches the sibling
 * handler.
 */

jest.unstable_mockModule("../models/index.js", () => ({
  Bill: { find: jest.fn(), findOne: jest.fn(), findById: jest.fn(), updateMany: jest.fn() },
  Reservation: { findById: jest.fn() },
}));
jest.unstable_mockModule("../middleware/mobileTenantAuth.js", () => ({
  mobileTenantAuth: (req, res) => res.status(401).json({ detail: "Not authenticated" }),
}));
jest.unstable_mockModule("../controllers/billing/_helpers.js", () => ({
  generateRentBillPdf: jest.fn(),
  generateCanonicalBillReceiptPdf: jest.fn(),
  formatBillReference: jest.fn(() => "LC-RB-TEST"),
  buildTenantUtilityBreakdown: jest.fn(() => null),
  SERVER_ROOT: "/tmp",
  BILL_PDF_ROOT: "/tmp/uploads/bills",
  isPathInsideBillingPdfRoot: jest.fn(() => true),
}));
jest.unstable_mockModule("../config/paymongo.js", () => ({
  createCheckoutSession: jest.fn(),
  getCheckoutSession: jest.fn(),
}));
jest.unstable_mockModule("../utils/billingPolicy.js", () => ({
  getVisibleBillSnapshot: jest.fn((bill) => bill),
  getVisibleBillCharges: jest.fn((bill) => bill?.charges || {}),
  getBillRemainingAmount: jest.fn((bill) => Number(bill?.remainingAmount || 0)),
}));
jest.unstable_mockModule("../utils/billSettlement.js", () => ({
  settlePaymongoBill: jest.fn(),
}));
jest.unstable_mockModule("../utils/paymongoPaymentMethod.js", () => ({
  readPaidPayments: jest.fn(() => []),
  readPaymentMethod: jest.fn(() => ({ rawPaymentType: "online" })),
  normalizeCheckoutStatusForClient: jest.fn(() => "pending"),
  PAYMENT_METHOD_LABELS: {},
}));
jest.unstable_mockModule("../config/publicUrls.js", () => ({
  getPublicUrlConfig: jest.fn(() => ({ publicApiUrl: "https://api.lilycrest.space" })),
}));
jest.unstable_mockModule("../utils/auditLogger.js", () => ({
  default: { log: jest.fn() },
}));
jest.unstable_mockModule("../services/mobileBillingBridge.js", () => ({
  toMobileBill: jest.fn((b) => b),
  isMobileEffectivelyPaid: jest.fn(() => false),
  toMobilePaymentMethodLabel: jest.fn(() => null),
  formatMobileElectricityBreakdown: jest.fn(() => null),
  formatMobileWaterBreakdown: jest.fn(() => null),
}));
jest.unstable_mockModule("../services/billing/currentBillResolver.js", () => ({
  NON_DRAFT_BILL_FILTER: { status: { $ne: "draft" }, isArchived: false },
  CURRENT_BILL_SORT: { billingCycleStart: -1, billingMonth: -1, createdAt: -1 },
  selectCurrentBillFromList: jest.fn((bills) => (Array.isArray(bills) ? bills[0] || null : null)),
}));

const { default: mobileBillingRoutes } = await import("./mobileBillingRoutes.js");
const { default: mobilePaymongoRoutes } = await import("./mobilePaymongoRoutes.js");

let server;
let baseUrl;

beforeEach(async () => {
  const app = express();
  app.use(express.json());
  // Mirror server.js mount order exactly: billing/paymongo bridges mounted
  // BEFORE the (stand-in) vendored mobile router.
  app.use("/api/m", mobileBillingRoutes);
  app.use("/api/m", mobilePaymongoRoutes);

  const sibling = express.Router();
  sibling.post("/auth/login", (req, res) => res.status(200).json({ ok: true, route: "sibling-auth-login" }));
  sibling.get("/rooms", (req, res) => res.status(200).json({ ok: true, route: "sibling-rooms" }));
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

describe("mobile billing/paymongo router mounting does not swallow unrelated /api/m/* requests", () => {
  test("an unauthenticated POST /api/m/auth/login still reaches the sibling router, not a 401 from the billing bridge", async () => {
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

  test("an unauthenticated GET /api/m/billing/me IS rejected by the billing bridge itself (sanity check)", async () => {
    const res = await fetch(`${baseUrl}/api/m/billing/me`);
    expect(res.status).toBe(401);
  });

  test("an unauthenticated POST /api/m/paymongo/checkout IS rejected by the paymongo bridge itself (sanity check)", async () => {
    const res = await fetch(`${baseUrl}/api/m/paymongo/checkout`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ billingId: "507f1f77bcf86cd799439011" }),
    });
    expect(res.status).toBe(401);
  });

  test("an unauthenticated POST /api/m/paymongo/checkout-batch is rejected by the paymongo bridge itself", async () => {
    const res = await fetch(`${baseUrl}/api/m/paymongo/checkout-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ billIds: ["507f1f77bcf86cd799439011"] }),
    });
    expect(res.status).toBe(401);
  });
});
