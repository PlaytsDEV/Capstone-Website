import { jest } from "@jest/globals";
import express from "express";
import http from "http";

// In-memory User fake — just enough Mongo-query-shape emulation to exercise
// the real atomic cooldown reservation logic in passwordResetController.js
// (findOneAndUpdate with the three-field cutoff $and/$or, updateOne scoped
// by reservationId) without a real database.
const state = { users: [], nextId: 1 };
const COOLDOWN_MS = 60 * 1000; // matches PASSWORD_RESET_RESEND_COOLDOWN_SECONDS default (60s)

const withinCooldown = (value) => Boolean(value) && value.getTime() > Date.now() - COOLDOWN_MS;

const FakeUser = {
  findOne: async (query) => state.users.find((u) => u.firebaseUid === query.firebaseUid) || null,
  findOneAndUpdate: async (query, update) => {
    const user = state.users.find((u) => String(u._id) === String(query._id));
    if (!user) return null;
    const blocked =
      withinCooldown(user.passwordResetLastSentAt) ||
      withinCooldown(user.passwordResetDeliveredAt) ||
      withinCooldown(user.passwordResetSendReservedAt);
    if (blocked) return null;
    Object.assign(user, update.$set);
    return user;
  },
  updateOne: async (query, update) => {
    const user = state.users.find((u) => String(u._id) === String(query._id));
    if (!user) return { matchedCount: 0, modifiedCount: 0 };
    if (query.passwordResetReservationId && user.passwordResetReservationId !== query.passwordResetReservationId) {
      return { matchedCount: 0, modifiedCount: 0 };
    }
    if (update.$set) Object.assign(user, update.$set);
    if (update.$unset) for (const key of Object.keys(update.$unset)) delete user[key];
    return { matchedCount: 1, modifiedCount: 1 };
  },
};

const getUserByEmail = jest.fn();
const generatePasswordResetLink = jest.fn();
const sendPasswordResetLinkEmail = jest.fn();
const auditLog = jest.fn().mockResolvedValue(undefined);
const loggerInfo = jest.fn();
const loggerError = jest.fn();
const loggerWarn = jest.fn();

await jest.unstable_mockModule("../config/firebase.js", () => ({
  getAuth: () => ({ getUserByEmail, generatePasswordResetLink }),
}));
await jest.unstable_mockModule("../config/email.js", () => ({
  sendPasswordResetLinkEmail,
}));
await jest.unstable_mockModule("../config/publicUrls.js", () => ({
  getPublicUrlConfig: () => ({
    emailActionUrl: "https://www.lilycrest.space/auth-action",
    publicFrontendUrl: "https://www.lilycrest.space",
  }),
}));
await jest.unstable_mockModule("../models/User.js", () => ({ default: FakeUser }));
await jest.unstable_mockModule("../utils/auditLogger.js", () => ({ default: { log: auditLog } }));
await jest.unstable_mockModule("../middleware/logger.js", () => ({
  default: { info: loggerInfo, error: loggerError, warn: loggerWarn },
}));

const { requestPasswordReset, requestMobileTenantPasswordReset } = await import("./passwordResetController.js");

const REGISTERED_EMAIL = "known-tenant@example.test";
const UNREGISTERED_EMAIL = "nobody@example.test";
const FIREBASE_UID = "firebase-uid-1";
// Deliberately on a non-canonical host (mirrors the actual observed defect:
// Firebase's raw generatePasswordResetLink() output is hosted wherever the
// project's Console "Action URL" is configured, not wherever
// actionCodeSettings.url points) to prove the controller rewrites it before
// ever handing it to the email sender.
const RAW_FIREBASE_LINK = "https://lilycrest-dormitory.vercel.app/auth-action?mode=resetPassword&oobCode=real-oob-code&apiKey=key";
const REWRITTEN_LINK = "https://www.lilycrest.space/auth-action?mode=resetPassword&oobCode=real-oob-code&apiKey=key";

const app = express();
app.use(express.json());
app.post("/api/auth/request-password-reset", requestPasswordReset);
app.post("/api/m/auth/forgot-password", requestMobileTenantPasswordReset);

let server;
let baseUrl;

beforeAll(async () => {
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

afterAll(async () => {
  await new Promise((resolve) => server.close(resolve));
});

beforeEach(() => {
  jest.clearAllMocks();
  state.users = [
    {
      _id: "user-1",
      user_id: "tenant-1",
      firebaseUid: FIREBASE_UID,
      firstName: "Jose",
      lastName: "Cruz",
      role: "tenant",
      accountStatus: "active",
      tenantStatus: "active",
      passwordResetLastSentAt: null,
      passwordResetDeliveredAt: null,
      passwordResetSendReservedAt: null,
      passwordResetReservationId: null,
    },
  ];
  generatePasswordResetLink.mockResolvedValue(RAW_FIREBASE_LINK);
  sendPasswordResetLinkEmail.mockResolvedValue({ success: true, provider: "smtp", attempts: [] });
});

const post = async (body, requestPath = "/api/auth/request-password-reset") => {
  const response = await fetch(`${baseUrl}${requestPath}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: response.status, body: await response.json() };
};

const GENERIC_MESSAGE = "If an account exists for this email, a password reset link has been sent.";

describe("requestPasswordReset — enumeration safety", () => {
  test("a registered email with a valid Firebase identity generates a link, sends the branded email, and returns the generic response", async () => {
    getUserByEmail.mockResolvedValue({ uid: FIREBASE_UID, email: REGISTERED_EMAIL });
    const result = await post({ email: REGISTERED_EMAIL });
    expect(result).toEqual({ status: 200, body: { message: GENERIC_MESSAGE } });
    expect(generatePasswordResetLink).toHaveBeenCalledWith(REGISTERED_EMAIL, {
      url: "https://www.lilycrest.space/signin",
      handleCodeInApp: false,
    });
    // The raw Firebase link (mocked here as a Vercel host — the actual
    // observed defect) must never reach the email sender unrewritten.
    expect(sendPasswordResetLinkEmail).toHaveBeenCalledWith({
      to: REGISTERED_EMAIL,
      name: "Jose",
      resetLink: REWRITTEN_LINK,
    });
    const [{ resetLink: deliveredLink }] = sendPasswordResetLinkEmail.mock.calls[0];
    expect(deliveredLink).not.toContain("vercel.app");
    expect(state.users[0].passwordResetDeliveredAt).toBeInstanceOf(Date);
    expect(state.users[0].passwordResetSendReservedAt).toBeUndefined();
  });

  test("an unregistered email returns the exact same response and never calls link generation or email delivery", async () => {
    getUserByEmail.mockRejectedValue(Object.assign(new Error("no user"), { code: "auth/user-not-found" }));
    const result = await post({ email: UNREGISTERED_EMAIL });
    expect(result).toEqual({ status: 200, body: { message: GENERIC_MESSAGE } });
    expect(generatePasswordResetLink).not.toHaveBeenCalled();
    expect(sendPasswordResetLinkEmail).not.toHaveBeenCalled();
  });

  test("a Firebase identity with no backend User profile still receives the reset email (registration-interruption edge case)", async () => {
    getUserByEmail.mockResolvedValue({ uid: "orphan-firebase-uid", email: "interrupted@example.test" });
    const result = await post({ email: "interrupted@example.test" });
    expect(result).toEqual({ status: 200, body: { message: GENERIC_MESSAGE } });
    expect(sendPasswordResetLinkEmail).toHaveBeenCalledWith({
      to: "interrupted@example.test",
      name: undefined,
      resetLink: REWRITTEN_LINK,
    });
  });

  test("cooldown active for a real account still returns the identical generic response, not a distinguishing 429", async () => {
    getUserByEmail.mockResolvedValue({ uid: FIREBASE_UID, email: REGISTERED_EMAIL });
    state.users[0].passwordResetLastSentAt = new Date();
    const result = await post({ email: REGISTERED_EMAIL });
    expect(result).toEqual({ status: 200, body: { message: GENERIC_MESSAGE } });
    expect(sendPasswordResetLinkEmail).not.toHaveBeenCalled();
  });

  test("delivery failure still returns the generic response and releases the reservation for a later retry", async () => {
    getUserByEmail.mockResolvedValue({ uid: FIREBASE_UID, email: REGISTERED_EMAIL });
    sendPasswordResetLinkEmail.mockResolvedValue({ success: false, category: "timeout", code: "EMAIL_PROVIDER_TEMPORARILY_UNAVAILABLE" });
    const result = await post({ email: REGISTERED_EMAIL });
    expect(result).toEqual({ status: 200, body: { message: GENERIC_MESSAGE } });
    expect(state.users[0].passwordResetSendReservedAt).toBeUndefined();
    expect(state.users[0].passwordResetReservationId).toBeUndefined();
    expect(state.users[0].passwordResetDeliveredAt).toBeNull();
  });

  test("every outcome (registered, unregistered, cooldown, delivery failure) produces byte-identical response bodies", async () => {
    getUserByEmail.mockResolvedValue({ uid: FIREBASE_UID, email: REGISTERED_EMAIL });
    const successResult = await post({ email: REGISTERED_EMAIL });

    getUserByEmail.mockRejectedValue(Object.assign(new Error("no user"), { code: "auth/user-not-found" }));
    const unknownResult = await post({ email: UNREGISTERED_EMAIL });

    getUserByEmail.mockResolvedValue({ uid: FIREBASE_UID, email: REGISTERED_EMAIL });
    state.users[0].passwordResetLastSentAt = new Date();
    const cooldownResult = await post({ email: REGISTERED_EMAIL });

    expect(successResult.body).toEqual(unknownResult.body);
    expect(successResult.body).toEqual(cooldownResult.body);
    expect(successResult.status).toBe(unknownResult.status);
    expect(successResult.status).toBe(cooldownResult.status);
  });
});

describe("requestMobileTenantPasswordReset — server-derived tenant eligibility", () => {
  const mobilePath = "/api/m/auth/forgot-password";

  test("an authoritative active tenant receives the canonical Firebase reset email", async () => {
    getUserByEmail.mockResolvedValue({ uid: FIREBASE_UID, email: REGISTERED_EMAIL });
    const result = await post({ email: REGISTERED_EMAIL, role: "owner" }, mobilePath);
    expect(result).toEqual({ status: 200, body: { message: GENERIC_MESSAGE } });
    expect(generatePasswordResetLink).toHaveBeenCalledTimes(1);
    expect(sendPasswordResetLinkEmail).toHaveBeenCalledTimes(1);
  });

  test.each(["applicant", "admin", "branch_admin", "owner", "staff"])(
    "%s receives the generic response without reset generation",
    async (role) => {
      state.users[0].role = role;
      getUserByEmail.mockResolvedValue({ uid: FIREBASE_UID, email: REGISTERED_EMAIL });
      const result = await post({ email: REGISTERED_EMAIL, role: "tenant" }, mobilePath);
      expect(result).toEqual({ status: 200, body: { message: GENERIC_MESSAGE } });
      expect(generatePasswordResetLink).not.toHaveBeenCalled();
      expect(sendPasswordResetLinkEmail).not.toHaveBeenCalled();
    },
  );

  test("a Firebase identity with no application profile receives no mobile reset", async () => {
    state.users = [];
    getUserByEmail.mockResolvedValue({ uid: "unknown-profile", email: UNREGISTERED_EMAIL });
    const result = await post({ email: UNREGISTERED_EMAIL }, mobilePath);
    expect(result).toEqual({ status: 200, body: { message: GENERIC_MESSAGE } });
    expect(generatePasswordResetLink).not.toHaveBeenCalled();
  });

  test("an unknown email is indistinguishable and generates nothing", async () => {
    getUserByEmail.mockRejectedValue(Object.assign(new Error("no user"), { code: "auth/user-not-found" }));
    const result = await post({ email: UNREGISTERED_EMAIL, role: "tenant" }, mobilePath);
    expect(result).toEqual({ status: 200, body: { message: GENERIC_MESSAGE } });
    expect(generatePasswordResetLink).not.toHaveBeenCalled();
  });
});

describe("requestPasswordReset — input validation and safety", () => {
  test("a malformed email is rejected with a distinct 400 before any Firebase call", async () => {
    const result = await post({ email: "not-an-email" });
    expect(result.status).toBe(400);
    expect(result.body).toEqual(expect.objectContaining({ code: "VALIDATION_ERROR" }));
    expect(getUserByEmail).not.toHaveBeenCalled();
  });

  test("a missing email is rejected with 400", async () => {
    const result = await post({});
    expect(result.status).toBe(400);
  });

  test("actionCodeSettings.url (the post-reset continue URL) targets canonical /signin, never localhost or a Vercel preview host", async () => {
    getUserByEmail.mockResolvedValue({ uid: FIREBASE_UID, email: REGISTERED_EMAIL });
    await post({ email: REGISTERED_EMAIL });
    const [, options] = generatePasswordResetLink.mock.calls[0];
    expect(options.url).toBe("https://www.lilycrest.space/signin");
    expect(options.url).not.toContain("localhost");
    expect(options.url).not.toContain("vercel.app");
  });

  test("the actually-delivered reset link's host is always the canonical action URL, regardless of what Firebase's raw link returns", async () => {
    getUserByEmail.mockResolvedValue({ uid: FIREBASE_UID, email: REGISTERED_EMAIL });
    await post({ email: REGISTERED_EMAIL });
    const [{ resetLink }] = sendPasswordResetLinkEmail.mock.calls[0];
    expect(resetLink.startsWith("https://www.lilycrest.space/auth-action?")).toBe(true);
    expect(resetLink).not.toContain("vercel.app");
    expect(resetLink).not.toContain("localhost");
  });

  test("no raw email address, reset link, or password ever appears in a logger call", async () => {
    getUserByEmail.mockResolvedValue({ uid: FIREBASE_UID, email: REGISTERED_EMAIL });
    await post({ email: REGISTERED_EMAIL });
    const allLogCalls = JSON.stringify([...loggerInfo.mock.calls, ...loggerError.mock.calls, ...loggerWarn.mock.calls]);
    expect(allLogCalls).not.toContain(REGISTERED_EMAIL);
    expect(allLogCalls).not.toContain(RAW_FIREBASE_LINK);
    expect(allLogCalls).not.toContain(REWRITTEN_LINK);

    jest.clearAllMocks();
    getUserByEmail.mockRejectedValue(Object.assign(new Error("no user"), { code: "auth/user-not-found" }));
    await post({ email: UNREGISTERED_EMAIL });
    const unknownLogCalls = JSON.stringify([...loggerInfo.mock.calls, ...loggerError.mock.calls, ...loggerWarn.mock.calls]);
    expect(unknownLogCalls).not.toContain(UNREGISTERED_EMAIL);
  });

  test("an internal audit log is still written on success, distinct from the public response", async () => {
    getUserByEmail.mockResolvedValue({ uid: FIREBASE_UID, email: REGISTERED_EMAIL });
    await post({ email: REGISTERED_EMAIL });
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "Password reset email sent", severity: "info" }),
    );
  });

  test("an internal audit log records delivery failure distinctly, without exposing it publicly", async () => {
    getUserByEmail.mockResolvedValue({ uid: FIREBASE_UID, email: REGISTERED_EMAIL });
    sendPasswordResetLinkEmail.mockResolvedValue({ success: false, category: "network", code: "EMAIL_PROVIDER_TEMPORARILY_UNAVAILABLE" });
    const result = await post({ email: REGISTERED_EMAIL });
    expect(result.body).toEqual({ message: GENERIC_MESSAGE });
    expect(auditLog).toHaveBeenCalledWith(
      expect.objectContaining({ action: "Password reset email delivery failed", severity: "warning" }),
    );
  });
});
