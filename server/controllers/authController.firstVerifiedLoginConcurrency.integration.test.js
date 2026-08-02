import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { MongoMemoryReplSet } from "mongodb-memory-server";

const sendLoginOtpEmail = jest.fn();
const auditLogLogin = jest.fn();
const auditLogError = jest.fn();

await jest.unstable_mockModule("../config/email.js", () => ({ sendLoginOtpEmail }));
await jest.unstable_mockModule("../config/firebase.js", () => ({ getAuth: jest.fn() }));
await jest.unstable_mockModule("../middleware/logger.js", () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
await jest.unstable_mockModule("../utils/auditLogger.js", () => ({
  default: {
    log: jest.fn(),
    logLogin: auditLogLogin,
    logLogout: jest.fn(),
    logRegistration: jest.fn(),
    logError: auditLogError,
  },
}));
await jest.unstable_mockModule("../services/sessionInvalidationService.js", () => ({
  invalidateUserSessions: jest.fn(),
}));
await jest.unstable_mockModule("../services/tenantProfileService.js", () => ({
  resolveTenantOccupancyDetails: jest.fn(),
  resolveTenantPersonalDetails: jest.fn(),
}));

const { login, storeOtpChallenge, verifyLoginOtp } = await import("./authController.js");
const { User, UserSession } = await import("../models/index.js");
const {
  claimFirstVerifiedLoginSession,
  cleanupFailedFirstVerifiedLoginSession,
} = await import("../services/firstVerifiedLoginService.js");

const response = () => ({
  statusCode: 200,
  body: null,
  cookie: jest.fn(),
  clearCookie: jest.fn(),
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const loginRequest = (user, requestId) => ({
  id: requestId,
  query: {},
  headers: {
    "x-device-id": "concurrent-device",
    "x-device-name": "Concurrency test",
    "user-agent": "first-login-concurrency-test",
  },
  ip: "127.0.0.1",
  connection: {},
  user: {
    uid: user.firebaseUid,
    email: user.email,
    email_verified: true,
    firebase: { sign_in_provider: "password" },
  },
});

describe("first-login controller concurrency", () => {
  let mongo;

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri(), { dbName: "first_login_controller_concurrency" });
    await Promise.all([User.syncIndexes(), UserSession.syncIndexes()]);
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    sendLoginOtpEmail.mockResolvedValue({ success: true, category: "accepted" });
    await Promise.all([User.deleteMany({}), UserSession.deleteMany({})]);
  });

  test("one concurrent request claims the exemption and the loser executes normal OTP delivery", async () => {
    const user = await User.create({
      firebaseUid: `firebase-${new mongoose.Types.ObjectId()}`,
      email: `concurrent-${new mongoose.Types.ObjectId()}@example.test`,
      username: `concurrent_${new mongoose.Types.ObjectId().toString().slice(-8)}`,
      firstName: "Concurrent",
      lastName: "Applicant",
      role: "applicant",
      isEmailVerified: true,
      onboardingStatus: "profile_complete",
      initialEmailVerifiedLoginEligibleAt: new Date(),
    });
    const responses = [response(), response()];
    const next = [jest.fn(), jest.fn()];

    await Promise.all([
      login(loginRequest(user, "request-a"), responses[0], next[0]),
      login(loginRequest(user, "request-b"), responses[1], next[1]),
    ]);

    expect(next[0]).not.toHaveBeenCalled();
    expect(next[1]).not.toHaveBeenCalled();
    expect(responses.filter((item) => item.body?.message === "Login successful")).toHaveLength(1);
    expect(responses.filter((item) => item.body?.code === "OTP_REQUIRED")).toHaveLength(1);
    expect(sendLoginOtpEmail).toHaveBeenCalledTimes(1);
    expect(await UserSession.countDocuments({
      userId: user._id,
      assuranceMethod: "first_verified_login",
    })).toBe(1);
    expect(await UserSession.countDocuments({
      userId: user._id,
      isActive: false,
      otpHash: { $ne: null },
    })).toBe(1);
  });

  test("A cleanup after B completes OTP cannot restore the exemption or affect Session B", async () => {
    const user = await User.create({
      firebaseUid: `firebase-${new mongoose.Types.ObjectId()}`,
      email: `cookie-race-${new mongoose.Types.ObjectId()}@example.test`,
      username: `cookie_${new mongoose.Types.ObjectId().toString().slice(-8)}`,
      firstName: "Cookie",
      lastName: "Race",
      role: "applicant",
      isEmailVerified: true,
      onboardingStatus: "profile_complete",
      initialEmailVerifiedLoginEligibleAt: new Date(),
    });
    const requestA = loginRequest(user, "request-a");
    requestA.headers["x-device-id"] = "first-login-device";
    const claimA = await claimFirstVerifiedLoginSession({
      userId: user._id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      expectedSecurityVersion: user.securityVersion,
      req: requestA,
      deviceId: "first-login-device",
      durationMs: 60_000,
    });
    expect(claimA.claimed).toBe(true);

    const requestB = loginRequest(user, "request-b");
    requestB.headers["x-device-id"] = "otp-device";
    await storeOtpChallenge(user, requestB, "otp-device");
    const deliveredOtp = sendLoginOtpEmail.mock.calls.at(-1)[0].otp;
    const pendingB = await UserSession.findPendingOtp(user._id, "otp-device", "login");
    const otpResponse = response();
    const otpNext = jest.fn();
    await verifyLoginOtp(
      { ...requestB, body: { otp: deliveredOtp } },
      otpResponse,
      otpNext,
    );
    expect(otpNext).not.toHaveBeenCalled();
    expect(otpResponse.body?.message).toBe("OTP verified");
    const sessionB = await UserSession.findOne({
      userId: user._id,
      deviceId: "otp-device",
      assuranceMethod: "login_otp",
      isActive: true,
    });
    expect(sessionB).not.toBeNull();

    const cleanupInput = {
      userId: user._id,
      sessionId: claimA.session.sessionId,
      deviceId: claimA.session.deviceId,
      loginTime: claimA.session.loginTime,
    };
    expect(await cleanupFailedFirstVerifiedLoginSession(cleanupInput)).toEqual({ cleaned: true });
    expect(await cleanupFailedFirstVerifiedLoginSession(cleanupInput)).toEqual({ cleaned: false });

    expect(await UserSession.findOne({ sessionId: claimA.session.sessionId })).toBeNull();
    expect(await UserSession.findOne({ sessionId: sessionB.sessionId, isActive: true })).not.toBeNull();
    const storedUser = await User.findById(user._id).select("+initialEmailVerifiedLoginCompletedAt");
    expect(storedUser.initialEmailVerifiedLoginCompletedAt).toBeInstanceOf(Date);
    const consumedChallenge = await UserSession.findById(pendingB._id).select("+otpHash");
    expect(consumedChallenge.otpHash).toBeNull();

    const nextLoginResponse = response();
    await login(loginRequest(user, "request-c"), nextLoginResponse, jest.fn());
    expect(nextLoginResponse.body).toMatchObject({
      requiresOtp: true,
      code: "OTP_REQUIRED",
    });
    expect(sendLoginOtpEmail).toHaveBeenCalledTimes(2);
  });
});
