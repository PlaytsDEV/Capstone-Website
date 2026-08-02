import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, jest, test } from "@jest/globals";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import { SESSION_ASSURANCE_METHODS } from "../config/sessionAssurance.js";
import { User, UserSession } from "../models/index.js";
import {
  claimFirstVerifiedLoginSession,
  cleanupFailedFirstVerifiedLoginSession,
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

const claimInputFor = (user, overrides = {}) => ({
  userId: user._id,
  firebaseUid: user.firebaseUid,
  email: user.email,
  expectedSecurityVersion: Number(user.securityVersion || 0),
  req: requestFor(),
  deviceId: "first-login-device",
  durationMs: 60_000,
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

    const result = await claimFirstVerifiedLoginSession(claimInputFor(user));

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
    const input = claimInputFor(user);

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
    const result = await claimFirstVerifiedLoginSession(claimInputFor(user));
    expect(result.claimed).toBe(false);
    expect(await UserSession.countDocuments({ userId: user._id, isActive: true })).toBe(0);
  });

  test("failed session creation aborts exemption consumption", async () => {
    const user = await createApplicant();
    const spy = jest.spyOn(UserSession, "createSession").mockRejectedValueOnce(new Error("session unavailable"));

    await expect(
      claimFirstVerifiedLoginSession(claimInputFor(user)),
    ).rejects.toThrow("session unavailable");

    spy.mockRestore();
    const storedUser = await User.findById(user._id).select("+initialEmailVerifiedLoginCompletedAt");
    expect(storedUser.initialEmailVerifiedLoginCompletedAt).toBeNull();
    expect(await UserSession.countDocuments({ userId: user._id })).toBe(0);
  });

  test("cookie failure removes only Session A and permanently preserves consumption", async () => {
    const user = await createApplicant();
    const result = await claimFirstVerifiedLoginSession(claimInputFor(user));

    const cleanup = await cleanupFailedFirstVerifiedLoginSession({
      userId: user._id,
      sessionId: result.session.sessionId,
      deviceId: result.session.deviceId,
      loginTime: result.session.loginTime,
    });

    const storedUser = await User.findById(user._id).select("+initialEmailVerifiedLoginCompletedAt");
    expect(cleanup).toEqual({ cleaned: true });
    expect(storedUser.initialEmailVerifiedLoginCompletedAt).toBeInstanceOf(Date);
    expect(await UserSession.countDocuments({ userId: user._id })).toBe(0);
    expect((await claimFirstVerifiedLoginSession(claimInputFor(storedUser))).claimed).toBe(false);
  });

  test("Session B survives delayed Session A cookie cleanup and cleanup is idempotent", async () => {
    const user = await createApplicant();
    await UserSession.create({
      userId: user._id,
      deviceId: "stale-device",
      isActive: false,
      otpHash: "b".repeat(64),
      otpPurpose: "login",
      otpExpiresAt: new Date(Date.now() + 60_000),
      otpLastSentAt: new Date(),
      logoutTime: new Date(),
    });

    const requestA = await claimFirstVerifiedLoginSession(claimInputFor(user));
    const sessionB = await UserSession.createSession(user._id, requestFor("otp-device"), {
      deviceId: "otp-device",
      durationMs: 60_000,
      otpVerified: true,
      assuranceMethod: SESSION_ASSURANCE_METHODS.LOGIN_OTP,
      securityVersion: requestA.user.securityVersion,
    });

    const cleanupInput = {
      userId: user._id,
      sessionId: requestA.session.sessionId,
      deviceId: requestA.session.deviceId,
      loginTime: requestA.session.loginTime,
    };
    expect(await cleanupFailedFirstVerifiedLoginSession(cleanupInput)).toEqual({ cleaned: true });
    expect(await cleanupFailedFirstVerifiedLoginSession(cleanupInput)).toEqual({ cleaned: false });

    expect(await UserSession.findOne({ sessionId: requestA.session.sessionId })).toBeNull();
    expect(await UserSession.findOne({ sessionId: sessionB.sessionId, isActive: true })).not.toBeNull();
    const storedUser = await User.findById(user._id).select("+initialEmailVerifiedLoginCompletedAt");
    expect(storedUser.initialEmailVerifiedLoginCompletedAt).toBeInstanceOf(Date);
    expect((await claimFirstVerifiedLoginSession(claimInputFor(storedUser))).claimed).toBe(false);
    const staleChallenge = await UserSession.findOne({
      userId: user._id,
      deviceId: "stale-device",
    }).select("+otpHash");
    expect(staleChallenge.otpHash).toBeNull();
  });

  test("cleanup is a no-op after Session A was already removed", async () => {
    const user = await createApplicant();
    const result = await claimFirstVerifiedLoginSession(claimInputFor(user));
    await UserSession.deleteOne({ _id: result.session._id });

    await expect(cleanupFailedFirstVerifiedLoginSession({
      userId: user._id,
      sessionId: result.session.sessionId,
      deviceId: result.session.deviceId,
      loginTime: result.session.loginTime,
    })).resolves.toEqual({ cleaned: false });

    const storedUser = await User.findById(user._id).select("+initialEmailVerifiedLoginCompletedAt");
    expect(storedUser.initialEmailVerifiedLoginCompletedAt).toBeInstanceOf(Date);
  });

  test("cleanup database failure never restores eligibility", async () => {
    const user = await createApplicant();
    const result = await claimFirstVerifiedLoginSession(claimInputFor(user));
    const deleteSpy = jest
      .spyOn(UserSession, "deleteOne")
      .mockRejectedValueOnce(new Error("cleanup unavailable"));

    await expect(cleanupFailedFirstVerifiedLoginSession({
      userId: user._id,
      sessionId: result.session.sessionId,
      deviceId: result.session.deviceId,
      loginTime: result.session.loginTime,
    })).rejects.toThrow("cleanup unavailable");
    deleteSpy.mockRestore();

    const storedUser = await User.findById(user._id).select("+initialEmailVerifiedLoginCompletedAt");
    expect(storedUser.initialEmailVerifiedLoginCompletedAt).toBeInstanceOf(Date);
    expect((await claimFirstVerifiedLoginSession(claimInputFor(storedUser))).claimed).toBe(false);
  });

  test("transaction uses the authoritative security version at claim time", async () => {
    const staleControllerUser = await createApplicant();
    await User.updateOne(
      { _id: staleControllerUser._id },
      { $set: { securityVersion: 3 } },
    );

    const staleClaim = await claimFirstVerifiedLoginSession(
      claimInputFor(staleControllerUser),
    );
    expect(staleClaim.claimed).toBe(false);
    let storedUser = await User.findById(staleControllerUser._id)
      .select("+initialEmailVerifiedLoginCompletedAt");
    expect(storedUser.initialEmailVerifiedLoginCompletedAt).toBeNull();

    const currentClaim = await claimFirstVerifiedLoginSession(
      claimInputFor(storedUser),
    );
    expect(currentClaim.claimed).toBe(true);
    expect(currentClaim.session.securityVersion).toBe(3);
    storedUser = await User.findById(staleControllerUser._id);
    expect(currentClaim.session.securityVersion).toBe(storedUser.securityVersion);
  });

  test("security revocation winning between controller read and claim fails closed", async () => {
    const staleControllerUser = await createApplicant();
    const originalFindOneAndUpdate = User.findOneAndUpdate.bind(User);
    let releaseClaim;
    let signalClaimStarted;
    const claimStarted = new Promise((resolve) => { signalClaimStarted = resolve; });
    const claimReleased = new Promise((resolve) => { releaseClaim = resolve; });
    const updateSpy = jest
      .spyOn(User, "findOneAndUpdate")
      .mockImplementationOnce(async (...args) => {
        signalClaimStarted();
        await claimReleased;
        return originalFindOneAndUpdate(...args);
      });

    const claimPromise = claimFirstVerifiedLoginSession(
      claimInputFor(staleControllerUser),
    );
    await claimStarted;
    await User.updateOne(
      { _id: staleControllerUser._id },
      { $inc: { securityVersion: 1 } },
    );
    releaseClaim();
    const result = await claimPromise;
    updateSpy.mockRestore();

    expect(result.claimed).toBe(false);
    const storedUser = await User.findById(staleControllerUser._id)
      .select("+initialEmailVerifiedLoginCompletedAt");
    expect(storedUser.securityVersion).toBe(1);
    expect(storedUser.initialEmailVerifiedLoginCompletedAt).toBeNull();
    expect(await UserSession.countDocuments({ userId: staleControllerUser._id })).toBe(0);
  });

  test("production session lookup enforces active state, expiry, device, and session ID", async () => {
    const user = await createApplicant({ initialEmailVerifiedLoginEligibleAt: null });
    const session = await UserSession.createSession(user._id, requestFor("bound-device"), {
      deviceId: "bound-device",
      durationMs: 60_000,
      otpVerified: true,
      assuranceMethod: SESSION_ASSURANCE_METHODS.LOGIN_OTP,
      securityVersion: user.securityVersion,
    });

    expect(await UserSession.findValidSession(user._id, "bound-device", session.sessionId)).not.toBeNull();
    expect(await UserSession.findValidSession(user._id, "other-device", session.sessionId)).toBeNull();
    expect(await UserSession.findValidSession(user._id, "bound-device", "other-session")).toBeNull();

    await UserSession.updateOne({ _id: session._id }, { $set: { expiresAt: new Date(Date.now() - 1) } });
    expect(await UserSession.findValidSession(user._id, "bound-device", session.sessionId)).toBeNull();

    await UserSession.updateOne({ _id: session._id }, {
      $set: { expiresAt: new Date(Date.now() + 60_000), isActive: false, logoutTime: new Date() },
    });
    expect(await UserSession.findValidSession(user._id, "bound-device", session.sessionId)).toBeNull();
  });

  test("leaving applicant role permanently clears registration eligibility", async () => {
    const user = await createApplicant();
    await User.updateOne({ _id: user._id }, { role: "tenant" });
    await User.updateOne({ _id: user._id }, { $set: { role: "applicant" } });
    const storedUser = await User.findById(user._id).select("+initialEmailVerifiedLoginEligibleAt");
    expect(storedUser.initialEmailVerifiedLoginEligibleAt).toBeNull();
  });
});
