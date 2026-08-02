import crypto from "crypto";
import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const findOneAndUpdate = jest.fn();
const findOne = jest.fn();
const findPendingOtp = jest.fn();
const updateOne = jest.fn();
const updateMany = jest.fn();
const createSession = jest.fn();
const userFindOne = jest.fn();
const sendLoginOtpEmail = jest.fn();
const logEvent = jest.fn();
const auditLogger = {
  logError: jest.fn(),
  logLogin: jest.fn(),
};
const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

await jest.unstable_mockModule("../models/index.js", () => ({
  User: { findOne: userFindOne },
  LoginLog: { logEvent },
  Reservation: {},
  Stay: {},
  UserSession: {
    findOneAndUpdate,
    findOne,
    findPendingOtp,
    updateOne,
    updateMany,
    createSession,
  },
}));
await jest.unstable_mockModule("../config/email.js", () => ({ sendLoginOtpEmail }));
await jest.unstable_mockModule("../config/firebase.js", () => ({ getAuth: jest.fn() }));
await jest.unstable_mockModule("../middleware/logger.js", () => ({ default: logger }));
await jest.unstable_mockModule("../middleware/validation.js", () => ({
  sanitizeName: (v) => v,
  sanitizePhone: (v) => v,
  sanitizeText: (v) => v,
}));
await jest.unstable_mockModule("../utils/auditLogger.js", () => ({ default: auditLogger }));
await jest.unstable_mockModule("../services/sessionInvalidationService.js", () => ({ invalidateUserSessions: jest.fn() }));
await jest.unstable_mockModule("../services/tenantProfileService.js", () => ({
  resolveTenantOccupancyDetails: jest.fn(),
  resolveTenantPersonalDetails: jest.fn(),
}));

const {
  resendLoginOtp,
  storeOtpChallenge,
  verifyLoginOtp,
} = await import("./authController.js");

const user = {
  _id: "mongo-user-1",
  firebaseUid: "firebase-user-1",
  email: "controlled@example.test",
  firstName: "Test",
  lastName: "User",
  role: "tenant",
  securityVersion: 3,
};
const req = {
  id: "request-1",
  user: { uid: "firebase-user-1" },
  headers: { "x-device-id": "device-sensitive-1", "user-agent": "Test Agent" },
  ip: "127.0.0.1",
  connection: {},
  body: {},
};

const response = () => {
  const res = {
    statusCode: 200,
    body: null,
    status: jest.fn((statusCode) => {
      res.statusCode = statusCode;
      return res;
    }),
    json: jest.fn((body) => {
      res.body = body;
      return res;
    }),
  };
  return res;
};

const otpHash = (otp) =>
  crypto
    .createHash("sha256")
    .update(`${process.env.JWT_SECRET || "lilycrest"}:${otp}`)
    .digest("hex");

describe("web login OTP delivery", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = "test";
    findOneAndUpdate.mockResolvedValue({ _id: "pending-1", otpExpiresAt: new Date() });
    updateOne.mockResolvedValue({ modifiedCount: 1 });
    updateMany.mockResolvedValue({ modifiedCount: 0 });
    userFindOne.mockResolvedValue(user);
    createSession.mockResolvedValue({ sessionId: "private-session-id" });
  });

  test("provider acceptance precedes challenge persistence and no session exists yet", async () => {
    sendLoginOtpEmail.mockResolvedValue({ success: true, category: "accepted", messageId: "message-1" });

    await expect(storeOtpChallenge(user, req, "device-sensitive-1")).resolves.toMatchObject({ _id: "pending-1" });

    expect(sendLoginOtpEmail.mock.invocationCallOrder[0]).toBeLessThan(
      findOneAndUpdate.mock.invocationCallOrder[0],
    );
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        _id: { $ne: "pending-1" },
        isActive: false,
        otpHash: { $ne: null },
      }),
      { $set: { otpHash: null, otpExpiresAt: null, otpAttempts: 0 } },
    );
    expect(createSession).not.toHaveBeenCalled();
  });

  test.each(["development", "production"])(
    "invalid API key fails closed in %s without creating or replacing a challenge",
    async (environment) => {
      process.env.NODE_ENV = environment;
      sendLoginOtpEmail.mockResolvedValue({
        success: false,
        category: "invalid_api_key",
        code: "EMAIL_PROVIDER_AUTH_REJECTED",
        statusCode: 400,
      });

      await expect(storeOtpChallenge(user, req, "device-sensitive-1")).rejects.toMatchObject({
        code: "OTP_EMAIL_SEND_FAILED",
        statusCode: 503,
        message: "We could not send the verification code. Please try again later.",
      });
      expect(findOneAndUpdate).not.toHaveBeenCalled();
      expect(createSession).not.toHaveBeenCalled();
      const logs = JSON.stringify(logger.error.mock.calls);
      expect(logs).not.toContain(user.email);
      expect(logs).not.toContain("device-sensitive-1");
      expect(logs).not.toMatch(/\b\d{6}\b/);
    },
  );

  test.each([
    [{ success: false, category: "configuration", code: "EMAIL_PROVIDER_NOT_CONFIGURED" }, false],
    [new Error("network failure"), true],
  ])("missing configuration and thrown transport failures both fail closed", async (result, rejects) => {
    if (rejects) sendLoginOtpEmail.mockRejectedValue(result);
    else sendLoginOtpEmail.mockResolvedValue(result);

    await expect(storeOtpChallenge(user, req, "device-sensitive-1")).rejects.toMatchObject({
      code: "OTP_EMAIL_SEND_FAILED",
      statusCode: 503,
    });
    expect(findOneAndUpdate).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });
});

describe("web login OTP resend", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = "test";
    userFindOne.mockResolvedValue(user);
    findOneAndUpdate.mockResolvedValue({ _id: "pending-1" });
  });

  test("successful resend preserves cooldown checks and persists only after acceptance", async () => {
    findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });
    sendLoginOtpEmail.mockResolvedValue({ success: true, category: "accepted", messageId: "message-2" });
    const res = response();

    await resendLoginOtp(req, res, jest.fn());

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ cooldownSeconds: 60 });
    expect(sendLoginOtpEmail.mock.invocationCallOrder[0]).toBeLessThan(
      findOneAndUpdate.mock.invocationCallOrder[0],
    );
  });

  test("failed resend leaves the existing challenge untouched and returns the safe 503 error", async () => {
    const existing = { otpLastSentAt: new Date(Date.now() - 120_000) };
    findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(existing) });
    sendLoginOtpEmail.mockResolvedValue({ success: false, category: "invalid_api_key", statusCode: 400 });
    const res = response();
    const next = jest.fn();

    await resendLoginOtp(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({
      code: "OTP_EMAIL_SEND_FAILED",
      statusCode: 503,
    }));
    expect(findOneAndUpdate).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });

  test("resend during cooldown remains rate limited without contacting the provider", async () => {
    findOne.mockReturnValue({
      select: jest.fn().mockResolvedValue({ otpLastSentAt: new Date(Date.now() - 1_000) }),
    });
    const res = response();

    await resendLoginOtp(req, res, jest.fn());

    expect(res.statusCode).toBe(429);
    expect(res.body.code).toBe("OTP_RESEND_COOLDOWN");
    expect(sendLoginOtpEmail).not.toHaveBeenCalled();
  });
});

describe("web login OTP verification", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = "development";
    userFindOne.mockResolvedValue(user);
    updateOne.mockResolvedValue({ modifiedCount: 1 });
    updateMany.mockResolvedValue({ modifiedCount: 1 });
    createSession.mockResolvedValue({ sessionId: "private-session-id" });
  });

  test("the generated code is atomically consumed before a session is created", async () => {
    const pending = { _id: "pending-1", otpHash: otpHash("731946"), otpAttempts: 0 };
    findPendingOtp.mockResolvedValue(pending);
    findOneAndUpdate.mockResolvedValue({ ...pending, otpHash: null });
    const res = response();

    await verifyLoginOtp({ ...req, body: { otp: "731946" } }, res, jest.fn());

    expect(res.statusCode).toBe(200);
    expect(findOneAndUpdate.mock.invocationCallOrder[0]).toBeLessThan(
      createSession.mock.invocationCallOrder[0],
    );
    expect(res.body.sessionId).toBe("private-session-id");
  });

  test("incorrect and former master OTP values fail without creating a session", async () => {
    findPendingOtp.mockResolvedValue({ _id: "pending-1", otpHash: otpHash("731946"), otpAttempts: 0 });
    const res = response();

    await verifyLoginOtp({ ...req, body: { otp: "123456" } }, res, jest.fn());

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("OTP_INVALID");
    expect(updateOne).toHaveBeenCalledWith(expect.any(Object), { $inc: { otpAttempts: 1 } });
    expect(createSession).not.toHaveBeenCalled();
  });

  test("expired, consumed, and failed-delivery codes cannot create sessions", async () => {
    findPendingOtp.mockResolvedValue(null);
    const res = response();

    await verifyLoginOtp({ ...req, body: { otp: "731946" } }, res, jest.fn());

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("OTP_EXPIRED");
    expect(createSession).not.toHaveBeenCalled();
  });

  test("a consumed code cannot win a concurrent replay race", async () => {
    const pending = { _id: "pending-1", otpHash: otpHash("731946"), otpAttempts: 0 };
    findPendingOtp.mockResolvedValue(pending);
    findOneAndUpdate.mockResolvedValue(null);
    const res = response();

    await verifyLoginOtp({ ...req, body: { otp: "731946" } }, res, jest.fn());

    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("OTP_EXPIRED");
    expect(createSession).not.toHaveBeenCalled();
  });
});
