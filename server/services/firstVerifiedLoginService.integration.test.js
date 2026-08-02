import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { SESSION_ASSURANCE_METHODS } from "../config/sessionAssurance.js";
import { User, UserSession } from "../models/index.js";
import {
  claimFirstVerifiedLoginSession,
  rollbackFirstVerifiedLoginSession,
} from "./firstVerifiedLoginService.js";

const requestFor = (deviceId = "first-login-device") => ({
  headers: { "x-device-id": deviceId, "user-agent": "first-login-test" },
  ip: "127.0.0.1",
  connection: {},
});

const createApplicant = (overrides = {}) =>
  User.create({
    firebaseUid: `firebase-${new mongoose.Types.ObjectId()}`,
    email: `applicant-${new mongoose.Types.ObjectId()}@example.test`,
    username: `app_${new mongoose.Types.ObjectId().toString().slice(-10)}`,
    firstName: "First",
    lastName: "Applicant",
    role: "applicant",
    isEmailVerified: true,
    onboardingStatus: "verification_pending",
    initialEmailVerifiedLoginEligibleAt: new Date(),
    ...overrides,
  });

describe("first verified applicant login transaction", () => {
  let mongo;

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri(), { dbName: "first_verified_login" });
    await Promise.all([User.syncIndexes(), UserSession.syncIndexes()]);
  }, 120_000);

  afterAll(async () => {
    await mongoose.disconnect();
    await mongo?.stop();
  });

  beforeEach(async () => {
    await Promise.all([User.deleteMany({}), UserSession.deleteMany({})]);
  });

  test("eligible verified applicant is consumed once with truthful non-OTP assurance", async () => {
    const user = await createApplicant();
    await UserSession.create({
      userId: user._id,
      deviceId: "old-device",
      isActive: false,
      otpHash: "a".repeat(64),
      otpPurpose: "login",
      otpExpiresAt: new Date(Date.now() + 60_000),
      otpLastSentAt: new Date(),
      logoutTime: new Date(),
    });

    const result = await claimFirstVerifiedLoginSession({
      user,
      firebaseUid: user.firebaseUid,
      email: user.email,
      req: requestFor(),
      deviceId: "first-login-device",
      durationMs: 60_000,
    });

    expect(result.claimed).toBe(true);
    expect(result.session).toMatchObject({
      deviceId: "first-login-device",
      assuranceMethod: SESSION_ASSURANCE_METHODS.FIRST_VERIFIED_LOGIN,
      otpVerifiedAt: null,
      isActive: true,
    });
    const storedUser = await User.findById(user._id).select("+initialEmailVerifiedLoginCompletedAt");
    expect(storedUser.initialEmailVerifiedLoginCompletedAt).toBeInstanceOf(Date);
    expect(storedUser.onboardingStatus).toBe("profile_complete");
    const stale = await UserSession.findOne({ userId: user._id, isActive: false }).select("+otpHash");
    expect(stale.otpHash).toBeNull();
  });

  test("two simultaneous claims create exactly one exempt session", async () => {
    const user = await createApplicant();
    const input = {
      user,
      firebaseUid: user.firebaseUid,
      email: user.email,
      req: requestFor(),
      deviceId: "first-login-device",
      durationMs: 60_000,
    };

    const results = await Promise.all([
      claimFirstVerifiedLoginSession(input),
      claimFirstVerifiedLoginSession(input),
    ]);

    expect(results.filter((result) => result.claimed)).toHaveLength(1);
    expect(await UserSession.countDocuments({
      userId: user._id,
      assuranceMethod: SESSION_ASSURANCE_METHODS.FIRST_VERIFIED_LOGIN,
      isActive: true,
    })).toBe(1);
  });

  test.each([
    ["unverified", { isEmailVerified: false }],
    ["tenant", { role: "tenant" }],
    ["inactive", { isActive: false }],
    ["blocked", { accountStatus: "suspended" }],
    ["historical", { initialEmailVerifiedLoginEligibleAt: null }],
    ["already consumed", { initialEmailVerifiedLoginCompletedAt: new Date() }],
  ])("%s account cannot claim the exemption", async (_label, overrides) => {
    const user = await createApplicant(overrides);
    const result = await claimFirstVerifiedLoginSession({
      user,
      firebaseUid: user.firebaseUid,
      email: user.email,
      req: requestFor(),
      deviceId: "first-login-device",
      durationMs: 60_000,
    });
    expect(result.claimed).toBe(false);
    expect(await UserSession.countDocuments({ userId: user._id, isActive: true })).toBe(0);
  });

  test("failed session creation aborts exemption consumption", async () => {
    const user = await createApplicant();
    const spy = jest.spyOn(UserSession, "createSession").mockRejectedValueOnce(new Error("session unavailable"));

    await expect(claimFirstVerifiedLoginSession({
      user,
      firebaseUid: user.firebaseUid,
      email: user.email,
      req: requestFor(),
      deviceId: "first-login-device",
      durationMs: 60_000,
    })).rejects.toThrow("session unavailable");

    spy.mockRestore();
    const storedUser = await User.findById(user._id).select("+initialEmailVerifiedLoginCompletedAt");
    expect(storedUser.initialEmailVerifiedLoginCompletedAt).toBeNull();
    expect(await UserSession.countDocuments({ userId: user._id })).toBe(0);
  });

  test("cookie-completion rollback removes the session and restores eligibility", async () => {
    const user = await createApplicant();
    const result = await claimFirstVerifiedLoginSession({
      user,
      firebaseUid: user.firebaseUid,
      email: user.email,
      req: requestFor(),
      deviceId: "first-login-device",
      durationMs: 60_000,
    });

    await rollbackFirstVerifiedLoginSession({
      userId: user._id,
      firebaseUid: user.firebaseUid,
      completedAt: result.completedAt,
      sessionId: result.session.sessionId,
    });

    const storedUser = await User.findById(user._id).select("+initialEmailVerifiedLoginCompletedAt");
    expect(storedUser.initialEmailVerifiedLoginCompletedAt).toBeNull();
    expect(await UserSession.countDocuments({ userId: user._id })).toBe(0);
  });

  test("leaving applicant role permanently clears registration eligibility", async () => {
    const user = await createApplicant();
    await User.updateOne({ _id: user._id }, { role: "tenant" });
    await User.updateOne({ _id: user._id }, { $set: { role: "applicant" } });
    const storedUser = await User.findById(user._id).select("+initialEmailVerifiedLoginEligibleAt");
    expect(storedUser.initialEmailVerifiedLoginEligibleAt).toBeNull();
  });
});
