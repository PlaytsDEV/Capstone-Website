import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const findOne = jest.fn();
const audit = { log: jest.fn().mockResolvedValue({}), logLogin: jest.fn().mockResolvedValue({}), logRegistration: jest.fn().mockResolvedValue({}), logError: jest.fn().mockResolvedValue({}) };
const logger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
const sendPasswordChangedEmail = jest.fn().mockResolvedValue({ success: true });
const invalidateUserSessions = jest.fn().mockResolvedValue({ failures: [] });

class UserModel {
  constructor(data) { Object.assign(this, data); }
  static findOne(query) { return findOne(query); }
}

await jest.unstable_mockModule("../models/index.js", () => ({
  User: UserModel,
  UserSession: {},
  LoginLog: {},
  Reservation: {},
  Stay: {},
}));
await jest.unstable_mockModule("../config/email.js", () => ({
  sendLoginOtpEmail: jest.fn(),
  sendPasswordChangedEmail,
}));
await jest.unstable_mockModule("../config/firebase.js", () => ({ getAuth: jest.fn() }));
await jest.unstable_mockModule("../middleware/logger.js", () => ({ default: logger }));
await jest.unstable_mockModule("../middleware/validation.js", () => ({
  sanitizeName: (v) => v, sanitizePhone: (v) => v, sanitizeText: (v) => v,
}));
await jest.unstable_mockModule("../utils/auditLogger.js", () => ({ default: audit }));
await jest.unstable_mockModule("../services/sessionInvalidationService.js", () => ({ invalidateUserSessions }));
await jest.unstable_mockModule("../services/tenantProfileService.js", () => ({
  resolveTenantOccupancyDetails: jest.fn(), resolveTenantPersonalDetails: jest.fn(),
}));

const { notifyPasswordChanged } = await import("./authController.js");

const createResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

describe("notifyPasswordChanged controller", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns 404 if user profile is not found in database", async () => {
    findOne.mockResolvedValueOnce(null);
    const req = {
      user: { uid: "non-existent-uid" },
      body: {},
      headers: {},
    };
    const res = createResponse();
    await notifyPasswordChanged(req, res, jest.fn());

    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ error: "User profile not found", code: "USER_NOT_FOUND" });
    expect(sendPasswordChangedEmail).not.toHaveBeenCalled();
    expect(audit.log).not.toHaveBeenCalled();
  });

  test("records password change, dispatches security email, and logs audit trail", async () => {
    const mockUser = {
      _id: "mongo-user-123",
      firebaseUid: "firebase-uid-123",
      email: "tenant@lilycrest.test",
      firstName: "Maria",
      lastName: "Santos",
      role: "tenant",
    };
    findOne.mockResolvedValueOnce(mockUser);

    const req = {
      user: { uid: "firebase-uid-123" },
      body: { revokeOtherSessions: false },
      headers: { "user-agent": "Mozilla/5.0 TestBrowser", "x-forwarded-for": "192.168.1.100" },
    };
    const res = createResponse();
    const next = jest.fn((err) => { if (err) console.error("NEXT ERROR:", err); });
    await notifyPasswordChanged(req, res, next);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({
      success: true,
      message: "Password change recorded and security notification dispatched.",
      sessionCleanupComplete: true,
    });
    expect(invalidateUserSessions).not.toHaveBeenCalled();
    expect(sendPasswordChangedEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "tenant@lilycrest.test",
        name: "Maria",
        ipAddress: "192.168.1.100",
      })
    );
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "security",
        action: "Password changed",
        userId: "mongo-user-123",
        userEmail: "tenant@lilycrest.test",
      })
    );
  });

  test("revokes other sessions when revokeOtherSessions is true", async () => {
    const mockUser = {
      _id: "mongo-user-123",
      firebaseUid: "firebase-uid-123",
      email: "tenant@lilycrest.test",
      firstName: "Maria",
      lastName: "Santos",
      role: "tenant",
    };
    findOne.mockResolvedValueOnce(mockUser);
    invalidateUserSessions.mockResolvedValueOnce({ failures: [] });

    const req = {
      user: { uid: "firebase-uid-123" },
      body: { revokeOtherSessions: true },
      headers: { "user-agent": "Mozilla/5.0 TestBrowser" },
    };
    const res = createResponse();
    await notifyPasswordChanged(req, res, jest.fn());

    expect(res.statusCode).toBe(200);
    expect(invalidateUserSessions).toHaveBeenCalledWith(
      expect.objectContaining({
        user: mockUser,
        reason: "password_changed_revoke_others",
      })
    );
    expect(res.body.sessionCleanupComplete).toBe(true);
  });
});
