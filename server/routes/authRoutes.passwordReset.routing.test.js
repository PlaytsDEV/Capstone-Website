import { jest } from "@jest/globals";
import express from "express";
import http from "http";

// Regression test for the production incident where POST
// /request-password-reset was registered twice in authRoutes.js — once
// (incorrectly, first) to the audit-only logPasswordReset handler, and once
// (correctly, but unreachable) to the real requestPasswordReset handler.
// Express dispatches to the first matching registration and stops once a
// handler sends a response, so the real Firebase-link-generation +
// Resend-template delivery handler never ran; the frontend still received a
// 200 and showed "Check your email" with no email ever sent.
//
// Mounting each controller as a bare function (as a previous, insufficient
// regression test for this bug did — see auth.passwordResetCooldown.test.js)
// cannot catch this class of bug: it never exercises registration order.
// This test imports and mounts the ACTUAL authRoutes.js router so a
// reintroduced duplicate registration fails this test immediately.

const pass = (_req, _res, next) => next();

const logPasswordReset = jest.fn((_req, res) => res.status(200).json({ handler: "logPasswordReset" }));
const requestPasswordReset = jest.fn((_req, res) => res.status(200).json({ handler: "requestPasswordReset" }));

await jest.unstable_mockModule("../middleware/auth.js", () => ({
  verifyToken: pass,
  verifyOnboardingToken: pass,
  verifyOwner: pass,
}));
await jest.unstable_mockModule("../middleware/rateLimiter.js", () => ({
  publicLimiter: pass,
  authLimiter: pass,
}));
await jest.unstable_mockModule("../middleware/validation.js", () => ({
  validateRegisterInput: {},
  validateProfileUpdateInput: {},
  createValidationMiddleware: () => pass,
}));
await jest.unstable_mockModule("../validation/validate.js", () => ({ validate: () => pass }));
await jest.unstable_mockModule("../validation/schemas.js", () => ({ setRoleSchema: {}, updateBranchSchema: {} }));
await jest.unstable_mockModule("../config/firebase.js", () => ({ getAuth: () => ({}) }));
await jest.unstable_mockModule("../utils/auditLogger.js", () => ({ default: { log: jest.fn() } }));
await jest.unstable_mockModule("../models/index.js", () => ({
  User: { findOne: jest.fn() },
  UserSession: {},
}));
await jest.unstable_mockModule("../services/sessionInvalidationService.js", () => ({
  invalidateUserSessions: jest.fn(),
}));
await jest.unstable_mockModule("../controllers/authController.js", () => ({
  register: pass,
  login: pass,
  verifyLoginOtp: pass,
  resendLoginOtp: pass,
  logout: pass,
  getProfile: pass,
  updateProfile: pass,
  updateBranch: pass,
  setRole: pass,
  logPasswordReset,
}));
await jest.unstable_mockModule("../controllers/emailVerificationController.js", () => ({
  clearEmailVerificationCapability: pass,
  exchangeEmailVerificationToken: pass,
  finalizeEmailVerification: pass,
  getEmailVerificationStatus: pass,
  reconcileAuthenticatedEmailVerification: pass,
  resendEmailVerification: pass,
  sendAuthenticatedEmailVerification: pass,
}));
await jest.unstable_mockModule("../utils/emailVerificationCookie.js", () => ({
  requireEmailVerificationCsrf: pass,
}));
await jest.unstable_mockModule("../controllers/passwordResetController.js", () => ({
  requestPasswordReset,
}));

const { default: authRoutes } = await import("./authRoutes.js");

describe("authRoutes.js — /request-password-reset routing", () => {
  let server;
  let baseUrl;

  beforeAll(async () => {
    const app = express();
    app.use(express.json());
    app.use("/api/auth", authRoutes);
    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("POST /request-password-reset dispatches to the real requestPasswordReset handler, not logPasswordReset", async () => {
    const response = await fetch(`${baseUrl}/api/auth/request-password-reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "tenant@example.test" }),
    });
    const body = await response.json();

    expect(body).toEqual({ handler: "requestPasswordReset" });
    expect(requestPasswordReset).toHaveBeenCalledTimes(1);
    expect(logPasswordReset).not.toHaveBeenCalled();
  });

  test("POST /log-password-reset is untouched and still dispatches to logPasswordReset", async () => {
    const response = await fetch(`${baseUrl}/api/auth/log-password-reset`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "tenant@example.test", success: true }),
    });
    const body = await response.json();

    expect(body).toEqual({ handler: "logPasswordReset" });
    expect(logPasswordReset).toHaveBeenCalledTimes(1);
    expect(requestPasswordReset).not.toHaveBeenCalled();
  });

  test("authRoutes.js registers /request-password-reset exactly once", () => {
    const matches = authRoutes.stack.filter(
      (layer) => layer.route?.path === "/request-password-reset" && layer.route.methods.post,
    );
    expect(matches).toHaveLength(1);
  });
});
