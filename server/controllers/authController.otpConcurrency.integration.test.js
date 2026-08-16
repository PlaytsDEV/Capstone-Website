import crypto from "crypto";
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { MongoMemoryServer } from "mongodb-memory-server";
import UserSession from "../models/UserSession.js";

const sendLoginOtpEmail = jest.fn();
const userFindOne = jest.fn();
const auditLogger = { logError: jest.fn(), logLogin: jest.fn() };

await jest.unstable_mockModule("../models/index.js", () => ({
  User: { findOne: userFindOne },
  UserSession,
  LoginLog: { logEvent: jest.fn() },
  Reservation: {},
  Stay: {},
}));
await jest.unstable_mockModule("../config/email.js", () => ({ sendLoginOtpEmail, sendPasswordChangedEmail: jest.fn() }));
await jest.unstable_mockModule("../config/firebase.js", () => ({ getAuth: jest.fn() }));
await jest.unstable_mockModule("../middleware/logger.js", () => ({
  default: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
await jest.unstable_mockModule("../middleware/validation.js", () => ({
  sanitizeName: (value) => value,
  sanitizePhone: (value) => value,
  sanitizeText: (value) => value,
}));
await jest.unstable_mockModule("../utils/auditLogger.js", () => ({ default: auditLogger }));
await jest.unstable_mockModule("../services/sessionInvalidationService.js", () => ({ invalidateUserSessions: jest.fn() }));
await jest.unstable_mockModule("../services/tenantProfileService.js", () => ({
  resolveTenantOccupancyDetails: jest.fn(),
  resolveTenantPersonalDetails: jest.fn(),
}));

const { resendLoginOtp, storeOtpChallenge, verifyLoginOtp } = await import("./authController.js");

const response = () => ({
  statusCode: 200,
  body: null,
  cookie: jest.fn(),
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const requestFor = (overrides = {}) => ({
  id: "otp-concurrency-request",
  user: { uid: "disposable-firebase-identity" },
  headers: { "x-device-id": "disposable-device", "user-agent": "integration-test" },
  ip: "127.0.0.1",
  connection: {},
  body: {},
  ...overrides,
});

const hashOtp = (otp) =>
  crypto
    .createHash("sha256")
    .update(`${process.env.JWT_SECRET || "lilycrest"}:${otp}`)
    .digest("hex");

describe("login OTP database concurrency", () => {
  let mongo;
  let user;
  const deviceId = "disposable-device";

  beforeAll(async () => {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri(), { dbName: "registration_otp_concurrency" });
    await UserSession.syncIndexes();
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    await UserSession.deleteMany({});
    user = {
      _id: new mongoose.Types.ObjectId(),
      email: "disposable@example.test",
      firstName: "Test",
      lastName: "User",
      username: "test-user",
      role: "applicant",
      securityVersion: 0,
    };
    userFindOne.mockResolvedValue(user);
    sendLoginOtpEmail.mockResolvedValue({ success: true, category: "accepted" });
  });

  test("simultaneous first sends leave exactly one scoped usable challenge", async () => {
    const request = requestFor();

    await Promise.all([
      storeOtpChallenge(user, request, deviceId),
      storeOtpChallenge(user, request, deviceId),
    ]);

    const challenges = await UserSession.find({
      userId: user._id,
      deviceId,
      otpPurpose: "login",
      otpHash: { $ne: null },
    }).select("+otpHash +challengeKey");
    expect(challenges).toHaveLength(1);
    expect(challenges[0].challengeKey).toMatch(/^[a-f0-9]{64}$/);
  });

  test("simultaneous resends supersede one scoped challenge without duplicates", async () => {
    await UserSession.create({
      userId: user._id,
      deviceId,
      isActive: false,
      otpPurpose: "login",
      challengeKey: crypto.createHash("sha256").update(`${user._id}:${deviceId}:login`).digest("hex"),
      otpHash: hashOtp("104827"),
      otpExpiresAt: new Date(Date.now() + 60_000),
      otpLastSentAt: new Date(Date.now() - 60_000),
    });
    const responses = [response(), response()];

    await Promise.all([
      resendLoginOtp(requestFor(), responses[0], jest.fn()),
      resendLoginOtp(requestFor(), responses[1], jest.fn()),
    ]);

    expect(responses.map((item) => item.statusCode)).toEqual([200, 200]);
    expect(await UserSession.countDocuments({
      userId: user._id,
      deviceId,
      otpPurpose: "login",
      otpHash: { $ne: null },
    })).toBe(1);
  });

  test("failed resend preserves the previously usable challenge", async () => {
    const oldHash = hashOtp("218305");
    const challenge = await UserSession.create({
      userId: user._id,
      deviceId,
      isActive: false,
      otpPurpose: "login",
      challengeKey: crypto.createHash("sha256").update(`${user._id}:${deviceId}:login`).digest("hex"),
      otpHash: oldHash,
      otpExpiresAt: new Date(Date.now() + 60_000),
      otpLastSentAt: new Date(Date.now() - 60_000),
    });
    sendLoginOtpEmail.mockResolvedValueOnce({ success: false, category: "rejected" });
    const next = jest.fn();

    await resendLoginOtp(requestFor(), response(), next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: "OTP_EMAIL_SEND_FAILED" }));
    const preserved = await UserSession.findById(challenge._id).select("+otpHash");
    expect(preserved.otpHash).toBe(oldHash);
  });

  test("successful resend invalidates the previously issued OTP", async () => {
    const oldOtp = "509176";
    await UserSession.create({
      userId: user._id,
      deviceId,
      isActive: false,
      otpPurpose: "login",
      challengeKey: crypto.createHash("sha256").update(`${user._id}:${deviceId}:login`).digest("hex"),
      otpHash: hashOtp(oldOtp),
      otpExpiresAt: new Date(Date.now() + 60_000),
      otpLastSentAt: new Date(Date.now() - 60_000),
    });

    await resendLoginOtp(requestFor(), response(), jest.fn());
    const verifyResponse = response();
    await verifyLoginOtp(requestFor({ body: { otp: oldOtp } }), verifyResponse, jest.fn());

    expect(verifyResponse.statusCode).toBe(400);
    expect(verifyResponse.body).toMatchObject({ code: "OTP_INVALID" });
    expect(await UserSession.countDocuments({ userId: user._id, isActive: true })).toBe(0);
  });

  test("simultaneous correct verification consumes once and creates one session", async () => {
    const otp = "731946";
    const otpHash = hashOtp(otp);
    await UserSession.create({
      userId: user._id,
      deviceId,
      isActive: false,
      otpPurpose: "login",
      challengeKey: crypto.createHash("sha256").update(`scope:${deviceId}`).digest("hex"),
      otpHash,
      otpExpiresAt: new Date(Date.now() + 60_000),
      otpLastSentAt: new Date(),
    });
    const request = requestFor({ id: "verification-race", body: { otp } });
    const responses = [response(), response()];

    await Promise.all([
      verifyLoginOtp(request, responses[0], jest.fn()),
      verifyLoginOtp(request, responses[1], jest.fn()),
    ]);

    expect(responses.map((item) => item.statusCode).sort()).toEqual([200, 400]);
    expect(await UserSession.countDocuments({ userId: user._id, isActive: true })).toBe(1);
  });
});
