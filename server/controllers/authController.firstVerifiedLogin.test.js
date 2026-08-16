import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { SESSION_ASSURANCE_METHODS } from "../config/sessionAssurance.js";

const userFindOne = jest.fn();
const saveNewUser = jest.fn();
const findValidSession = jest.fn();
const createSession = jest.fn();
const findOneAndUpdate = jest.fn();
const updateOne = jest.fn();
const updateMany = jest.fn();
const sendLoginOtpEmail = jest.fn();
const claimFirstVerifiedLoginSession = jest.fn();
const cleanupFailedFirstVerifiedLoginSession = jest.fn();
const logEvent = jest.fn();

class UserModel {
  constructor(data) { Object.assign(this, data); this._id = "new-applicant-id"; }
  save() { return saveNewUser(this); }
  static findOne(query) { return userFindOne(query); }
}

await jest.unstable_mockModule("../models/index.js", () => ({
  User: UserModel,
  UserSession: {
    findValidSession,
    createSession,
    findOneAndUpdate,
    updateOne,
    updateMany,
  },
  LoginLog: { logEvent },
  Reservation: {},
  Stay: {},
}));
await jest.unstable_mockModule("../services/firstVerifiedLoginService.js", () => ({
  claimFirstVerifiedLoginSession,
  cleanupFailedFirstVerifiedLoginSession,
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
await jest.unstable_mockModule("../utils/auditLogger.js", () => ({
  default: { log: jest.fn(), logLogin: jest.fn(), logLogout: jest.fn(), logRegistration: jest.fn(), logError: jest.fn() },
}));
await jest.unstable_mockModule("../services/sessionInvalidationService.js", () => ({ invalidateUserSessions: jest.fn() }));
await jest.unstable_mockModule("../services/tenantProfileService.js", () => ({
  resolveTenantOccupancyDetails: jest.fn(),
  resolveTenantPersonalDetails: jest.fn(),
}));

const { login, logout, register } = await import("./authController.js");

const response = ({ cookie = true } = {}) => {
  const res = {
    statusCode: 200,
    body: null,
    clearCookie: jest.fn(),
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
  if (cookie) res.cookie = jest.fn();
  return res;
};

const applicant = (overrides = {}) => ({
  _id: "applicant-id",
  firebaseUid: "firebase-applicant",
  email: "applicant@example.test",
  username: "applicant",
  firstName: "First",
  lastName: "Applicant",
  role: "applicant",
  permissions: [],
  isActive: true,
  accountStatus: "active",
  isEmailVerified: true,
  onboardingStatus: "profile_complete",
  securityVersion: 0,
  save: jest.fn(async function save() { return this; }),
  ...overrides,
});

const loginRequest = (user, overrides = {}) => ({
  id: "first-login-request",
  query: {},
  headers: { "x-device-id": "device-1", "user-agent": "test-agent" },
  ip: "127.0.0.1",
  connection: {},
  user: {
    uid: user.firebaseUid,
    email: user.email,
    email_verified: true,
    firebase: { sign_in_provider: "password" },
  },
  ...overrides,
});

describe("one-time first verified applicant login controller policy", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    findValidSession.mockResolvedValue(null);
    sendLoginOtpEmail.mockResolvedValue({ success: true, category: "accepted" });
    findOneAndUpdate.mockResolvedValue({ _id: "pending-otp" });
    updateOne.mockResolvedValue({ modifiedCount: 1 });
    updateMany.mockResolvedValue({ modifiedCount: 0 });
    createSession.mockResolvedValue({ sessionId: "normal-session" });
    claimFirstVerifiedLoginSession.mockResolvedValue({ claimed: false });
    cleanupFailedFirstVerifiedLoginSession.mockResolvedValue({ cleaned: true });
  });

  test("new password registration creates eligibility without consuming it", async () => {
    userFindOne.mockResolvedValue(null);
    saveNewUser.mockImplementation(async (user) => user);
    const req = {
      id: "register-password",
      headers: {},
      user: {
        uid: "new-firebase-applicant",
        email: "new@example.test",
        email_verified: false,
        firebase: { sign_in_provider: "password" },
      },
      sanitizedData: { username: "new_user", firstName: "New", lastName: "Applicant" },
    };
    const res = response();
    await register(req, res, jest.fn());
    const saved = saveNewUser.mock.calls[0][0];
    expect(saved.initialEmailVerifiedLoginEligibleAt).toBeInstanceOf(Date);
    expect(saved.initialEmailVerifiedLoginCompletedAt).toBeUndefined();
    expect(res.statusCode).toBe(201);
  });

  test("OAuth registration and same-UID recovery do not create or reset eligibility", async () => {
    const existing = applicant({
      isEmailVerified: false,
      initialEmailVerifiedLoginEligibleAt: new Date("2026-01-01T00:00:00Z"),
      initialEmailVerifiedLoginCompletedAt: null,
    });
    userFindOne.mockResolvedValueOnce(existing);
    const req = {
      id: "register-retry",
      headers: {},
      user: { uid: existing.firebaseUid, email: existing.email, email_verified: false, firebase: { sign_in_provider: "password" } },
      sanitizedData: { username: existing.username, firstName: existing.firstName, lastName: existing.lastName },
    };
    await register(req, response(), jest.fn());
    expect(existing.save).not.toHaveBeenCalled();
    expect(existing.initialEmailVerifiedLoginEligibleAt).toEqual(new Date("2026-01-01T00:00:00Z"));

    userFindOne.mockReset();
    userFindOne.mockResolvedValue(null);
    saveNewUser.mockImplementation(async (user) => user);
    await register({
      ...req,
      user: { uid: "oauth-uid", email: "oauth@example.test", email_verified: true, firebase: { sign_in_provider: "google.com" } },
      sanitizedData: { username: "oauth_user", firstName: "OAuth", lastName: "User" },
    }, response(), jest.fn());
    expect(saveNewUser.mock.calls.at(-1)[0].initialEmailVerifiedLoginEligibleAt).toBeNull();
  });

  test("newly verified applicant receives one non-OTP session and normal response", async () => {
    const user = applicant();
    const exemptSession = {
      sessionId: "first-login-session",
      deviceId: "device-1",
      loginTime: new Date(),
      assuranceMethod: SESSION_ASSURANCE_METHODS.FIRST_VERIFIED_LOGIN,
      otpVerifiedAt: null,
    };
    userFindOne.mockResolvedValue(user);
    claimFirstVerifiedLoginSession.mockResolvedValue({
      claimed: true,
      user: { ...user, initialEmailVerifiedLoginCompletedAt: new Date() },
      session: exemptSession,
      completedAt: new Date(),
    });
    const res = response();
    await login(loginRequest(user), res, jest.fn());

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ message: "Login successful", user: { role: "applicant" } });
    expect(res.body).not.toHaveProperty("requiresOtp");
    expect(sendLoginOtpEmail).not.toHaveBeenCalled();
    expect(findOneAndUpdate).not.toHaveBeenCalled();
    expect(exemptSession.otpVerifiedAt).toBeNull();
    expect(res.cookie).toHaveBeenCalled();
  });

  test("refresh with the valid first-login session remains authenticated without reclaiming", async () => {
    const user = applicant();
    findValidSession.mockResolvedValue({
      sessionId: "first-login-session",
      assuranceMethod: SESSION_ASSURANCE_METHODS.FIRST_VERIFIED_LOGIN,
      otpVerifiedAt: null,
      securityVersion: 0,
      save: jest.fn(),
    });
    userFindOne.mockResolvedValue(user);
    const res = response();
    await login(loginRequest(user, {
      headers: {
        "x-device-id": "device-1",
        "x-session-id": "first-login-session",
        "user-agent": "test-agent",
      },
    }), res, jest.fn());

    expect(res.body).toMatchObject({ message: "Login successful" });
    expect(claimFirstVerifiedLoginSession).not.toHaveBeenCalled();
    expect(sendLoginOtpEmail).not.toHaveBeenCalled();
  });

  test("unverified applicant cannot consume exemption or receive a session", async () => {
    const user = applicant({ isEmailVerified: false, onboardingStatus: "verification_pending" });
    userFindOne.mockResolvedValue(user);
    const res = response();
    await login(loginRequest(user, { user: { ...loginRequest(user).user, email_verified: false } }), res, jest.fn());
    expect(res.statusCode).toBe(403);
    expect(res.body.code).toBe("EMAIL_NOT_VERIFIED");
    expect(claimFirstVerifiedLoginSession).not.toHaveBeenCalled();
    expect(createSession).not.toHaveBeenCalled();
  });

  test("applicant after consumption follows normal OTP policy", async () => {
    const user = applicant({ initialEmailVerifiedLoginCompletedAt: new Date() });
    userFindOne.mockResolvedValue(user);
    const res = response();
    await login(loginRequest(user), res, jest.fn());
    expect(res.body).toMatchObject({ requiresOtp: true, code: "OTP_REQUIRED" });
    expect(sendLoginOtpEmail).toHaveBeenCalledTimes(1);
  });

  test("explicitly logged-out applicant session requires OTP on the next login", async () => {
    const user = applicant({ initialEmailVerifiedLoginCompletedAt: new Date() });
    userFindOne.mockResolvedValue(user);
    findValidSession.mockResolvedValue(null);
    const res = response();
    await login(loginRequest(user, { headers: {
      "x-device-id": "device-1",
      "x-session-id": "logged-out-session",
      "user-agent": "test-agent",
    } }), res, jest.fn());
    expect(findValidSession).toHaveBeenCalledWith(user._id, "device-1", "logged-out-session");
    expect(res.body).toMatchObject({ requiresOtp: true, code: "OTP_REQUIRED" });
  });

  test("expired applicant session requires OTP on the next login", async () => {
    const user = applicant({ initialEmailVerifiedLoginCompletedAt: new Date() });
    userFindOne.mockResolvedValue(user);
    findValidSession.mockResolvedValue(null);
    const res = response();
    await login(loginRequest(user, { headers: {
      "x-device-id": "device-1",
      "x-session-id": "expired-session",
      "user-agent": "test-agent",
    } }), res, jest.fn());
    expect(findValidSession).toHaveBeenCalledWith(user._id, "device-1", "expired-session");
    expect(res.body).toMatchObject({ requiresOtp: true, code: "OTP_REQUIRED" });
  });

  test("deleted cookie requires OTP on the next applicant login", async () => {
    const user = applicant({ initialEmailVerifiedLoginCompletedAt: new Date() });
    userFindOne.mockResolvedValue(user);
    const res = response();
    await login(loginRequest(user), res, jest.fn());
    expect(findValidSession).toHaveBeenCalledWith(user._id, "device-1", "");
    expect(res.body).toMatchObject({ requiresOtp: true, code: "OTP_REQUIRED" });
  });

  test("a new device requires OTP after the exemption was consumed", async () => {
    const user = applicant({ initialEmailVerifiedLoginCompletedAt: new Date() });
    userFindOne.mockResolvedValue(user);
    const res = response();
    await login(loginRequest(user, { headers: {
      "x-device-id": "new-device",
      "x-session-id": "old-device-session",
      "user-agent": "test-agent",
    } }), res, jest.fn());
    expect(findValidSession).toHaveBeenCalledWith(user._id, "new-device", "old-device-session");
    expect(res.body).toMatchObject({ requiresOtp: true, code: "OTP_REQUIRED" });
  });

  test("revoked session requires OTP on the next applicant login", async () => {
    const user = applicant({ initialEmailVerifiedLoginCompletedAt: new Date() });
    userFindOne.mockResolvedValue(user);
    findValidSession.mockResolvedValue(null);
    const res = response();
    await login(loginRequest(user, { headers: {
      "x-device-id": "device-1",
      "x-session-id": "revoked-session",
      "user-agent": "test-agent",
    } }), res, jest.fn());
    expect(res.body).toMatchObject({ requiresOtp: true, code: "OTP_REQUIRED" });
  });

  test("security-version increment rejects an otherwise active session and requires OTP", async () => {
    const user = applicant({
      initialEmailVerifiedLoginCompletedAt: new Date(),
      securityVersion: 2,
    });
    userFindOne.mockResolvedValue(user);
    findValidSession.mockResolvedValue({
      sessionId: "stale-security-session",
      assuranceMethod: SESSION_ASSURANCE_METHODS.LOGIN_OTP,
      otpVerifiedAt: new Date(),
      securityVersion: 1,
      save: jest.fn(),
    });
    const res = response();
    await login(loginRequest(user, { headers: {
      "x-device-id": "device-1",
      "x-session-id": "stale-security-session",
      "user-agent": "test-agent",
    } }), res, jest.fn());
    expect(res.body).toMatchObject({ requiresOtp: true, code: "OTP_REQUIRED" });
  });

  test("applicant-to-tenant transition rejects first-login assurance and requires OTP", async () => {
    const user = applicant({ role: "tenant", initialEmailVerifiedLoginCompletedAt: new Date() });
    userFindOne.mockResolvedValue(user);
    findValidSession.mockResolvedValue({
      sessionId: "former-applicant-session",
      assuranceMethod: SESSION_ASSURANCE_METHODS.FIRST_VERIFIED_LOGIN,
      otpVerifiedAt: null,
      securityVersion: 0,
      save: jest.fn(),
    });
    const res = response();
    await login(loginRequest(user, { headers: {
      "x-device-id": "device-1",
      "x-session-id": "former-applicant-session",
      "user-agent": "test-agent",
    } }), res, jest.fn());
    expect(claimFirstVerifiedLoginSession).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({ requiresOtp: true, code: "OTP_REQUIRED" });
  });

  test.each(["tenant", "branch_admin", "owner"])("%s cannot use applicant exemption", async (role) => {
    const user = applicant({ role });
    userFindOne.mockResolvedValue(user);
    const res = response();
    await login(loginRequest(user), res, jest.fn());
    expect(claimFirstVerifiedLoginSession).not.toHaveBeenCalled();
    if (role === "tenant") {
      expect(res.body).toMatchObject({ requiresOtp: true });
    } else {
      expect(res.body).toMatchObject({ message: "Login successful" });
      expect(createSession).toHaveBeenCalledWith(
        user._id,
        expect.any(Object),
        expect.objectContaining({ assuranceMethod: SESSION_ASSURANCE_METHODS.ADMIN_PASSWORD, otpVerified: false }),
      );
    }
  });

  test.each(["branch_admin", "owner"])("%s password login requires device binding and never generates OTP", async (role) => {
    const user = applicant({ role });
    userFindOne.mockResolvedValue(user);
    const res = response();
    await login(loginRequest(user, { headers: { "user-agent": "test-agent" } }), res, jest.fn());
    expect(res.statusCode).toBe(400);
    expect(res.body.code).toBe("DEVICE_ID_REQUIRED");
    expect(createSession).not.toHaveBeenCalled();
    expect(sendLoginOtpEmail).not.toHaveBeenCalled();
  });

  test("blocked applicant cannot consume exemption", async () => {
    const user = applicant({ isActive: false });
    userFindOne.mockResolvedValue(user);
    const res = response();
    await login(loginRequest(user), res, jest.fn());
    expect(res.statusCode).toBe(403);
    expect(claimFirstVerifiedLoginSession).not.toHaveBeenCalled();
  });

  test("different email or UID identity conflict cannot consume exemption", async () => {
    const user = applicant();
    userFindOne.mockResolvedValueOnce(null).mockResolvedValueOnce(user);
    const res = response();
    await login(loginRequest(user, { user: { ...loginRequest(user).user, uid: "different-uid" } }), res, jest.fn());
    expect(res.statusCode).toBe(409);
    expect(claimFirstVerifiedLoginSession).not.toHaveBeenCalled();
  });

  test("same UID with a mismatched token email cannot consume exemption", async () => {
    const user = applicant();
    userFindOne.mockResolvedValue(user);
    const res = response();
    await login(loginRequest(user, {
      user: { ...loginRequest(user).user, email: "attacker@example.test" },
    }), res, jest.fn());
    expect(res.statusCode).toBe(409);
    expect(claimFirstVerifiedLoginSession).not.toHaveBeenCalled();
  });

  test("logout revokes the active first-login session", async () => {
    const user = applicant();
    userFindOne.mockResolvedValue(user);
    const req = loginRequest(user, {
      headers: {
        "x-device-id": "device-1",
        "x-session-id": "first-login-session",
      },
    });
    const res = response();
    await logout(req, res, jest.fn());

    expect(updateOne).toHaveBeenCalledWith(
      { userId: user._id, sessionId: "first-login-session", isActive: true },
      { $set: { isActive: false, logoutTime: expect.any(Date) } },
    );
    expect(res.body).toMatchObject({ code: "LOGOUT_SUCCESS" });
  });

  test.each(["branch_admin", "owner"])("%s logout revokes the same application session used by HTTP and sockets", async (role) => {
    const user = applicant({ role });
    userFindOne.mockResolvedValue(user);
    const req = loginRequest(user, {
      headers: {
        "x-device-id": "admin-device",
        "x-session-id": "admin-session",
      },
    });
    const res = response();
    await logout(req, res, jest.fn());

    expect(updateOne).toHaveBeenCalledWith(
      { userId: user._id, sessionId: "admin-session", isActive: true },
      { $set: { isActive: false, logoutTime: expect.any(Date) } },
    );
    expect(res.body).toMatchObject({ code: "LOGOUT_SUCCESS" });
  });

  test("session creation failure does not fall through to OTP", async () => {
    const user = applicant();
    userFindOne.mockResolvedValue(user);
    claimFirstVerifiedLoginSession.mockRejectedValue(new Error("session unavailable"));
    const next = jest.fn();
    await login(loginRequest(user), response(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: "session unavailable" }));
    expect(sendLoginOtpEmail).not.toHaveBeenCalled();
  });

  test("cookie failure cleans only Session A without restoring eligibility", async () => {
    const user = applicant();
    const loginTime = new Date();
    userFindOne.mockResolvedValue(user);
    claimFirstVerifiedLoginSession.mockResolvedValue({
      claimed: true,
      user,
      session: {
        sessionId: "first-login-session",
        deviceId: "device-1",
        loginTime,
      },
    });
    const next = jest.fn();
    await login(loginRequest(user), response({ cookie: false }), next);
    expect(cleanupFailedFirstVerifiedLoginSession).toHaveBeenCalledWith({
      userId: user._id,
      sessionId: "first-login-session",
      deviceId: "device-1",
      loginTime,
    });
    expect(next).toHaveBeenCalled();
  });

  test("cookie cleanup failure returns a safe error and never falls through to OTP", async () => {
    const user = applicant();
    userFindOne.mockResolvedValue(user);
    claimFirstVerifiedLoginSession.mockResolvedValue({
      claimed: true,
      user,
      session: {
        sessionId: "first-login-session",
        deviceId: "device-1",
        loginTime: new Date(),
      },
    });
    cleanupFailedFirstVerifiedLoginSession.mockRejectedValue(
      new Error("cleanup unavailable"),
    );
    const next = jest.fn();

    await login(loginRequest(user), response({ cookie: false }), next);

    expect(next).toHaveBeenCalledWith(
      expect.objectContaining({ message: "cleanup unavailable" }),
    );
    expect(sendLoginOtpEmail).not.toHaveBeenCalled();
  });
});
