import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";
import express from "express";

/**
 * Real Express-level regression test for the Auth/Session Consolidation
 * phase's mount-order requirement: every canonical /api/m bridge (contracts,
 * billing, PayMongo, documents) is mounted BEFORE the vendored
 * mobile router (server.js) that owns /api/m/auth/*. None of those bridges
 * define an /auth/* path themselves, but since mobileTenantAuth is a real
 * per-route middleware (never router.use()), this proves — with a real HTTP
 * server, not source inspection — that public login/OTP endpoints are never
 * accidentally shadowed by an authenticated bridge router mounted ahead of
 * them, and that each bridge's own protected routes still correctly reject
 * an unauthenticated request.
 *
 * Mirrors the mount-order tests already established for the individual
 * bridges (routes/mobileBillingRoutes.mount.test.js, etc.), but exercises
 * ALL FIVE bridges together against a stand-in for the vendored mobile
 * router's public auth surface, matching the exact server.js mount order.
 */

jest.unstable_mockModule("../middleware/mobileTenantAuth.js", () => ({
  mobileTenantAuth: (req, res) => res.status(401).json({ detail: "Not authenticated" }),
}));
jest.unstable_mockModule("../services/tenantContractViewService.js", () => ({ toTenantContractView: jest.fn() }));
jest.unstable_mockModule("../services/contractPublicationService.js", () => ({ resolvePublishedFinalDocument: jest.fn() }));
jest.unstable_mockModule("../services/tenantContractSelectionService.js", () => ({
  resolveTenantCanonicalContract: jest.fn(),
  resolveTenantUpcomingContract: jest.fn(),
}));
jest.unstable_mockModule("../services/preparedContractDocumentService.js", () => ({
  resolveCurrentPreparedDocument: jest.fn(),
  selectCurrentPreparedDocument: jest.fn(),
}));
jest.unstable_mockModule("../utils/auditLogger.js", () => ({ default: { logModification: jest.fn() } }));
jest.unstable_mockModule("../models/index.js", () => ({
  Bill: { find: jest.fn(), findOne: jest.fn(), findById: jest.fn() },
  Reservation: { findById: jest.fn() },
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
jest.unstable_mockModule("../config/paymongo.js", () => ({ createCheckoutSession: jest.fn(), getCheckoutSession: jest.fn() }));
jest.unstable_mockModule("../utils/billingPolicy.js", () => ({
  getVisibleBillSnapshot: jest.fn((bill) => bill),
  getVisibleBillCharges: jest.fn((bill) => bill?.charges || {}),
}));
jest.unstable_mockModule("../utils/billSettlement.js", () => ({ settlePaymongoBill: jest.fn() }));
jest.unstable_mockModule("../utils/paymongoPaymentMethod.js", () => ({
  readPaidPayments: jest.fn(() => []),
  readPaymentMethod: jest.fn(() => ({ rawPaymentType: "online" })),
  normalizeCheckoutStatusForClient: jest.fn(() => "pending"),
  PAYMENT_METHOD_LABELS: {},
}));
jest.unstable_mockModule("../config/publicUrls.js", () => ({ getPublicUrlConfig: jest.fn(() => ({ publicApiUrl: "https://api.lilycrest.space" })) }));
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
jest.unstable_mockModule("../services/mobileDocumentBridge.js", () => ({ buildPolicyDocumentPdf: jest.fn(() => null), POLICY_DOCUMENT_IDS: [] }));
jest.unstable_mockModule("../services/mobileUserDocumentService.js", () => ({
  listUserDocuments: jest.fn(), uploadUserDocument: jest.fn(), getUserDocumentContent: jest.fn(), deleteUserDocument: jest.fn(),
}));

const { default: mobileContractRoutes } = await import("./mobileContractRoutes.js");
const { default: mobileBillingRoutes } = await import("./mobileBillingRoutes.js");
const { default: mobilePaymongoRoutes } = await import("./mobilePaymongoRoutes.js");
const { default: mobileDocumentRoutes } = await import("./mobileDocumentRoutes.js");

let server;
let baseUrl;

beforeEach(async () => {
  const app = express();
  app.use(express.json());
  // Exact server.js mount order: every canonical bridge before the
  // (stand-in) vendored mobile router that owns /api/m/auth/*.
  app.use("/api/m", mobileContractRoutes);
  app.use("/api/m", mobileBillingRoutes);
  app.use("/api/m", mobilePaymongoRoutes);
  app.use("/api/m", mobileDocumentRoutes);

  const vendoredAuthStandIn = express.Router();
  vendoredAuthStandIn.post("/auth/login", (req, res) => res.status(200).json({ ok: true, route: "vendored-auth-login" }));
  vendoredAuthStandIn.post("/auth/login/verify-otp", (req, res) => res.status(200).json({ ok: true, route: "vendored-auth-verify-otp" }));
  vendoredAuthStandIn.post("/auth/login/resend-otp", (req, res) => res.status(200).json({ ok: true, route: "vendored-auth-resend-otp" }));
  vendoredAuthStandIn.post("/auth/google", (req, res) => res.status(200).json({ ok: true, route: "vendored-auth-google" }));
  app.use("/api/m", vendoredAuthStandIn);

  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterEach(async () => {
  await new Promise((resolve) => server.close(resolve));
});

describe("no canonical /api/m bridge shadows the public mobile auth routes", () => {
  test.each([
    "/api/m/auth/login",
    "/api/m/auth/login/verify-otp",
    "/api/m/auth/login/resend-otp",
    "/api/m/auth/google",
  ])("unauthenticated POST %s reaches the vendored auth router, not a 401 from any bridge's mobileTenantAuth", async (path) => {
    const res = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  test.each([
    ["GET", "/api/m/contracts/current"],
    ["GET", "/api/m/billing/me"],
    ["POST", "/api/m/paymongo/checkout"],
    ["GET", "/api/m/users/documents"],
    ["GET", "/api/m/documents/house_rules"],
  ])("unauthenticated %s %s is correctly rejected by its own bridge's session auth (sanity check)", async (method, path) => {
    const res = await fetch(`${baseUrl}${path}`, { method, headers: { "Content-Type": "application/json" } });
    expect(res.status).toBe(401);
  });
});
