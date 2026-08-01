import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const findOneAndUpdate = jest.fn();
const deleteOne = jest.fn();
const createSession = jest.fn();
const sendLoginOtpEmail = jest.fn();
const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

await jest.unstable_mockModule("../models/index.js", () => ({
  User: {}, LoginLog: {}, Reservation: {}, Stay: {},
  UserSession: { findOneAndUpdate, deleteOne, createSession },
}));
await jest.unstable_mockModule("../config/email.js", () => ({ sendLoginOtpEmail }));
await jest.unstable_mockModule("../config/firebase.js", () => ({ getAuth: jest.fn() }));
await jest.unstable_mockModule("../middleware/logger.js", () => ({ default: logger }));
await jest.unstable_mockModule("../middleware/validation.js", () => ({
  sanitizeName: (v) => v, sanitizePhone: (v) => v, sanitizeText: (v) => v,
}));
await jest.unstable_mockModule("../utils/auditLogger.js", () => ({ default: {} }));
await jest.unstable_mockModule("../services/sessionInvalidationService.js", () => ({ invalidateUserSessions: jest.fn() }));
await jest.unstable_mockModule("../services/tenantProfileService.js", () => ({
  resolveTenantOccupancyDetails: jest.fn(), resolveTenantPersonalDetails: jest.fn(),
}));

const { storeOtpChallenge } = await import("./authController.js");

const user = { _id: "mongo-user-1", email: "controlled@example.test", firstName: "Test", lastName: "User" };
const req = { id: "request-1", headers: {}, ip: "127.0.0.1", connection: {} };

describe("web login OTP delivery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = "production";
    process.env.RESEND_API_KEY = "configured-for-mocked-test";
    process.env.RESEND_FROM_EMAIL = "auth@example.test";
    findOneAndUpdate.mockResolvedValue({ _id: "pending-1", otpExpiresAt: new Date() });
    deleteOne.mockResolvedValue({ deletedCount: 1 });
  });

  test("successful delivery keeps only a pending challenge and creates no authenticated session", async () => {
    sendLoginOtpEmail.mockResolvedValue({ success: true, messageId: "message-1" });
    await expect(storeOtpChallenge(user, req, "device-1")).resolves.toMatchObject({ _id: "pending-1" });
    expect(deleteOne).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });

  test.each(["authentication", "sender_rejection", "timeout", "rate_limit", "configuration"])(
    "deletes an unusable challenge after %s failure and returns only the generic error",
    async (category) => {
      sendLoginOtpEmail.mockResolvedValue({ success: false, category, code: "SANITIZED", statusCode: 503 });
      await expect(storeOtpChallenge(user, req, "device-1")).rejects.toMatchObject({
        code: "OTP_EMAIL_SEND_FAILED", statusCode: 503, message: "Failed to send OTP email",
      });
      expect(deleteOne).toHaveBeenCalledWith({ _id: "pending-1", isActive: false });
      expect(createSession).not.toHaveBeenCalled();
      expect(JSON.stringify(logger.error.mock.calls)).not.toMatch(/\b\d{6}\b|configured-for-mocked-test|secret-value/i);
    },
  );
});
