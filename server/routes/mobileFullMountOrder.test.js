import { afterEach, describe, expect, jest, test } from "@jest/globals";
import express from "express";

/**
 * Phase 4 cutover-readiness gap: the previous mount-order tests
 * (mobileAuthMount.test.js, mobileBillingRoutes.mount.test.js,
 * mobileDocumentRoutes.mount.test.js) only prove the canonical bridges don't
 * shadow /auth/* or each other. None of them exercise the full, real
 * server.js mount order together with the vendored router's OTHER domains
 * (rooms, maintenance, dashboard, announcements, chatbot, chat, faqs,
 * tickets) or the two bridges added during Phase 4 itself (notifications,
 * upload/firebase-storage). This test mounts EVERY /api/m router in the
 * exact server.js order and proves:
 *   1. every bridge still answers its own path (mobileTenantAuth 401s when
 *      unauthenticated — sanity check only, not a functional test)
 *   2. no bridge shadows a vendored-only stand-in path mounted after it
 */

jest.unstable_mockModule("../middleware/mobileTenantAuth.js", () => ({
  mobileTenantAuth: (req, res) => res.status(401).json({ detail: "Not authenticated" }),
}));
jest.unstable_mockModule("../services/tenantContractViewService.js", () => ({ toTenantContractView: jest.fn() }));
jest.unstable_mockModule("../services/contractPublicationService.js", () => ({ resolvePublishedFinalDocument: jest.fn() }));
jest.unstable_mockModule("../services/tenantContractSelectionService.js", () => ({ resolveTenantCanonicalContract: jest.fn() }));
jest.unstable_mockModule("../services/preparedContractDocumentService.js", () => ({
  resolveCurrentPreparedDocument: jest.fn(),
  selectCurrentPreparedDocument: jest.fn(),
}));
jest.unstable_mockModule("../utils/auditLogger.js", () => ({ default: { logModification: jest.fn(), log: jest.fn() } }));
jest.unstable_mockModule("../models/index.js", () => ({
  Bill: { find: jest.fn(), findOne: jest.fn(), findById: jest.fn() },
  Reservation: { findById: jest.fn() },
}));
jest.unstable_mockModule("../controllers/billing/_helpers.js", () => ({
  generateRentBillPdf: jest.fn(),
  formatBillReference: jest.fn(() => "LC-RB-TEST"),
  SERVER_ROOT: "/tmp",
  BILL_PDF_ROOT: "/tmp/uploads/bills",
}));
jest.unstable_mockModule("../config/paymongo.js", () => ({ createCheckoutSession: jest.fn(), getCheckoutSession: jest.fn() }));
jest.unstable_mockModule("../utils/billingPolicy.js", () => ({ getVisibleBillSnapshot: jest.fn((bill) => bill) }));
jest.unstable_mockModule("../utils/billSettlement.js", () => ({ settlePaymongoBill: jest.fn() }));
jest.unstable_mockModule("../utils/paymongoPaymentMethod.js", () => ({
  readPaidPayments: jest.fn(() => []),
  readPaymentMethod: jest.fn(() => ({ rawPaymentType: "online" })),
  normalizeCheckoutStatusForClient: jest.fn(() => "pending"),
  PAYMENT_METHOD_LABELS: {},
}));
jest.unstable_mockModule("../config/publicUrls.js", () => ({ getPublicUrlConfig: jest.fn(() => ({ publicApiUrl: "https://api.lilycrest.space" })) }));
jest.unstable_mockModule("../services/mobileBillingBridge.js", () => ({ toMobileBill: jest.fn((b) => b), isMobileEffectivelyPaid: jest.fn(() => false), toMobilePaymentMethodLabel: jest.fn(() => null) }));
jest.unstable_mockModule("../services/mobileDocumentBridge.js", () => ({ buildPolicyDocumentPdf: jest.fn(() => null), POLICY_DOCUMENT_IDS: [] }));
jest.unstable_mockModule("../services/mobileUserDocumentService.js", () => ({
  listUserDocuments: jest.fn(), uploadUserDocument: jest.fn(), getUserDocumentContent: jest.fn(), deleteUserDocument: jest.fn(),
}));
jest.unstable_mockModule("mongoose", () => ({ default: { connection: { db: {} } } }));
jest.unstable_mockModule("../services/mobileNotificationBridge.js", () => ({
  listUserNotifications: jest.fn(), markNotificationRead: jest.fn(), markAllNotificationsRead: jest.fn(),
}));
jest.unstable_mockModule("../config/firebase.js", () => ({
  default: { apps: [{}], storage: () => ({ bucket: jest.fn() }) },
  resolveFirebaseStorageBucket: () => "test-bucket",
}));

const { default: mobileContractRoutes } = await import("./mobileContractRoutes.js");
const { default: mobileBillingRoutes } = await import("./mobileBillingRoutes.js");
const { default: mobilePaymongoRoutes } = await import("./mobilePaymongoRoutes.js");
const { default: mobileDocumentRoutes } = await import("./mobileDocumentRoutes.js");
const { default: mobileAuthRoutes } = await import("./mobileAuthRoutes.js");
const { default: mobileNotificationRoutes } = await import("./mobileNotificationRoutes.js");
const { default: mobileUploadRoutes } = await import("./mobileUploadRoutes.js");

let server;
let baseUrl;

async function startApp() {
  const app = express();
  app.use(express.json());
  // Exact server.js order (see server.js lines ~282-306).
  app.use("/api/m", mobileContractRoutes);
  app.use("/api/m", mobileBillingRoutes);
  app.use("/api/m", mobilePaymongoRoutes);
  app.use("/api/m", mobileDocumentRoutes);
  app.use("/api/m", mobileAuthRoutes);
  app.use("/api/m", mobileNotificationRoutes);
  app.use("/api/m", mobileUploadRoutes);

  // Stand-in for the vendored router's OTHER domains (server/mobile), which
  // this test does not load for real (that requires a live Mongo/Firebase
  // shim setup exercised elsewhere) — only used here to prove mount order.
  const vendoredStandIn = express.Router();
  vendoredStandIn.post("/auth/login", (req, res) => res.status(200).json({ ok: true, route: "vendored-auth-login" }));
  vendoredStandIn.get("/rooms", (req, res) => res.status(200).json({ ok: true, route: "vendored-rooms" }));
  vendoredStandIn.get("/maintenance/me", (req, res) => res.status(200).json({ ok: true, route: "vendored-maintenance-me" }));
  vendoredStandIn.get("/dashboard/me", (req, res) => res.status(200).json({ ok: true, route: "vendored-dashboard-me" }));
  vendoredStandIn.get("/announcements", (req, res) => res.status(200).json({ ok: true, route: "vendored-announcements" }));
  vendoredStandIn.post("/chatbot/message", (req, res) => res.status(200).json({ ok: true, route: "vendored-chatbot-message" }));
  vendoredStandIn.get("/chat/me", (req, res) => res.status(200).json({ ok: true, route: "vendored-chat-me" }));
  vendoredStandIn.get("/faqs", (req, res) => res.status(200).json({ ok: true, route: "vendored-faqs" }));
  vendoredStandIn.get("/tickets/me", (req, res) => res.status(200).json({ ok: true, route: "vendored-tickets-me" }));
  vendoredStandIn.get("/users/me", (req, res) => res.status(200).json({ ok: true, route: "vendored-users-me" }));
  app.use("/api/m", vendoredStandIn);

  await new Promise((resolve) => { server = app.listen(0, "127.0.0.1", resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
}

afterEach(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
});

describe("full /api/m mount order — no bridge shadows a vendored-only domain", () => {
  test.each([
    ["POST", "/api/m/auth/login", "vendored-auth-login"],
    ["GET", "/api/m/rooms", "vendored-rooms"],
    ["GET", "/api/m/maintenance/me", "vendored-maintenance-me"],
    ["GET", "/api/m/dashboard/me", "vendored-dashboard-me"],
    ["GET", "/api/m/announcements", "vendored-announcements"],
    ["POST", "/api/m/chatbot/message", "vendored-chatbot-message"],
    ["GET", "/api/m/chat/me", "vendored-chat-me"],
    ["GET", "/api/m/faqs", "vendored-faqs"],
    ["GET", "/api/m/tickets/me", "vendored-tickets-me"],
    ["GET", "/api/m/users/me", "vendored-users-me"],
  ])("unauthenticated %s %s reaches the vendored stand-in, not a 401/404 from any canonical bridge", async (method, path, expectedRoute) => {
    await startApp();
    const res = await fetch(`${baseUrl}${path}`, { method, headers: { "Content-Type": "application/json" }, body: method === "POST" ? "{}" : undefined });
    expect(res.status).toBe(200);
    expect((await res.json()).route).toBe(expectedRoute);
  });

  test.each([
    ["GET", "/api/m/contracts/current"],
    ["GET", "/api/m/billing/history"],
    ["POST", "/api/m/paymongo/checkout"],
    ["GET", "/api/m/users/documents"],
    ["POST", "/api/m/auth/session-teardown"],
    ["GET", "/api/m/notifications"],
    ["POST", "/api/m/upload/firebase-storage"],
  ])("unauthenticated %s %s is correctly rejected by its own bridge's session auth (sanity check)", async (method, path) => {
    await startApp();
    const res = await fetch(`${baseUrl}${path}`, { method, headers: { "Content-Type": "application/json" }, body: method === "POST" ? "{}" : undefined });
    expect(res.status).toBe(401);
  });
});
