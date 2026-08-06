import { beforeEach, describe, expect, jest, test } from "@jest/globals";

process.env.NODE_ENV = "test";
process.env.EMAIL_ACTION_URL = "https://www.lilycrest.space/auth-action";
process.env.PUBLIC_FRONTEND_URL = "https://www.lilycrest.space";
process.env.PUBLIC_API_URL = "https://api.lilycrest.space";
process.env.RESERVATION_CONTINUATION_URL = "https://www.lilycrest.space/applicant/check-availability";
process.env.EMAIL_VERIFICATION_SECRET = "controller-test-secret";
process.env.EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS = "60";

const firebaseAuth = {
  getUser: jest.fn(),
  generateEmailVerificationLink: jest.fn(),
  verifyIdToken: jest.fn(),
};
const sendEmailVerificationLinkEmail = jest.fn();
const User = {
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findById: jest.fn(),
  updateOne: jest.fn(),
};
const EmailVerificationExchange = {
  create: jest.fn(),
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  updateOne: jest.fn(),
};
const logger = { error: jest.fn() };

await jest.unstable_mockModule("../config/firebase.js", () => ({ getAuth: () => firebaseAuth }));
await jest.unstable_mockModule("../config/email.js", () => ({ sendEmailVerificationLinkEmail }));
await jest.unstable_mockModule("../models/User.js", () => ({ default: User }));
await jest.unstable_mockModule("../models/EmailVerificationExchange.js", () => ({ default: EmailVerificationExchange }));
await jest.unstable_mockModule("../middleware/logger.js", () => ({ default: logger }));

const {
  exchangeEmailVerificationToken,
  finalizeEmailVerification,
  getEmailVerificationStatus,
  reconcileAuthenticatedEmailVerification,
  resendEmailVerification,
  sendAuthenticatedEmailVerification,
} = await import("./emailVerificationController.js");
const {
  createOpaqueExchangeToken,
  emailFingerprint,
  EMAIL_VERIFICATION_STATES: S,
} = await import("../services/emailVerificationService.js");

const response = () => ({
  statusCode: 200,
  body: null,
  cookies: [],
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
  cookie(name, value, options) { this.cookies.push({ name, value, options }); return this; },
});

const makeUser = (overrides = {}) => ({
  _id: "mongo-user-id",
  firebaseUid: "firebase-uid",
  email: "leigh@example.com",
  firstName: "Leigh",
  isEmailVerified: false,
  onboardingStatus: "verification_pending",
  emailVerificationLastSentAt: null,
  emailVerificationDeliveredAt: null,
  emailVerificationSendReservedAt: null,
  save: jest.fn(async function save() { return this; }),
  ...overrides,
});

const firebaseUser = (overrides = {}) => ({
  uid: "firebase-uid",
  email: "leigh@example.com",
  emailVerified: false,
  ...overrides,
});

const exchangeRecord = (overrides = {}) => ({
  kind: "session",
  firebaseUid: "firebase-uid",
  emailHash: emailFingerprint("leigh@example.com"),
  continuePath: "/applicant/reservation",
  expiresAt: new Date(Date.now() + 60_000),
  consumedAt: null,
  ...overrides,
});

const selectable = (value) => ({ select: jest.fn().mockResolvedValue(value) });
const sessionRequest = (extras = {}) => ({
  headers: { cookie: `lilycrest_email_verification=${createOpaqueExchangeToken()}` },
  body: {},
  ...extras,
});

beforeEach(() => {
  jest.clearAllMocks();
  firebaseAuth.getUser.mockResolvedValue(firebaseUser());
  firebaseAuth.generateEmailVerificationLink.mockResolvedValue(
    "https://project.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=one-time-code&apiKey=public-key",
  );
  firebaseAuth.verifyIdToken.mockResolvedValue({ uid: "firebase-uid" });
  User.findOne.mockResolvedValue(makeUser());
  User.findOneAndUpdate.mockResolvedValue(makeUser());
  User.findById.mockReturnValue(selectable(makeUser()));
  User.updateOne.mockResolvedValue({ modifiedCount: 1 });
  EmailVerificationExchange.create.mockResolvedValue({});
  EmailVerificationExchange.findOne.mockReturnValue(selectable(exchangeRecord()));
  EmailVerificationExchange.findOneAndUpdate.mockReturnValue(selectable(exchangeRecord({ kind: "action" })));
  EmailVerificationExchange.updateOne.mockResolvedValue({ modifiedCount: 1 });
  sendEmailVerificationLinkEmail.mockResolvedValue({ success: true });
});

describe("email verification controller", () => {
  test("authenticated send sets an HttpOnly capability and exposes no context", async () => {
    const req = { user: { uid: "firebase-uid" }, body: { continuePath: "/applicant/reservation" } };
    const res = response();
    await sendAuthenticatedEmailVerification(req, res, jest.fn());
    expect(res.body).toMatchObject({ state: S.VERIFICATION_EMAIL_RESENT, maskedEmail: "l****@example.com" });
    expect(res.body).not.toHaveProperty("verificationContext");
    expect(res.cookies[0].options).toMatchObject({ httpOnly: true, path: "/api/auth/email-verification" });
    const link = new URL(sendEmailVerificationLinkEmail.mock.calls[0][0].verificationLink);
    expect(link.searchParams.get("exchange")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(link.searchParams.has("context")).toBe(false);
    expect(link.searchParams.has("continueUrl")).toBe(false);
  });

  test("exchange token is atomically consumed and rotated into a browser session", async () => {
    const res = response();
    await exchangeEmailVerificationToken({
      body: { exchangeToken: createOpaqueExchangeToken() },
      headers: { authorization: "Bearer current-token" },
    }, res, jest.fn());
    expect(EmailVerificationExchange.findOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "action", consumedAt: null, expiresAt: expect.any(Object) }),
      { $set: { consumedAt: expect.any(Date) } },
      { new: true },
    );
    expect(res.body.identityMatch).toBe("match");
    expect(res.cookies).toHaveLength(1);
  });

  test("expired, tampered, or consumed exchange token is rejected without replay", async () => {
    EmailVerificationExchange.findOneAndUpdate.mockReturnValue(selectable(null));
    const res = response();
    await exchangeEmailVerificationToken({ body: { exchangeToken: createOpaqueExchangeToken() }, headers: {} }, res, jest.fn());
    expect(res.statusCode).toBe(400);
    expect(res.body.state).toBe(S.INVALID_OR_TAMPERED_LINK);
    expect(EmailVerificationExchange.create).not.toHaveBeenCalled();
  });

  test("provider success finalizes delivered cooldown state", async () => {
    const res = response();
    await resendEmailVerification(sessionRequest(), res, jest.fn());
    expect(res.body.state).toBe(S.VERIFICATION_EMAIL_RESENT);
    expect(User.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ emailVerificationReservationId: expect.any(String) }),
      expect.objectContaining({
        $set: { emailVerificationLastSentAt: expect.any(Date), emailVerificationDeliveredAt: expect.any(Date) },
      }),
    );
  });

  test("provider failure releases its reservation and reports no delivery", async () => {
    sendEmailVerificationLinkEmail.mockResolvedValue({ success: false });
    const res = response();
    await resendEmailVerification(sessionRequest(), res, jest.fn());
    expect(res.statusCode).toBe(503);
    expect(res.body.state).toBe(S.VERIFICATION_EMAIL_SEND_FAILED);
    expect(User.updateOne).toHaveBeenCalledWith(
      expect.any(Object),
      { $unset: { emailVerificationSendReservedAt: 1, emailVerificationReservationId: 1 } },
    );
  });

  test.each([
    [{ success: false, code: "EMAIL_PROVIDER_NOT_CONFIGURED" }, "temporarily unavailable"],
    [{ success: false, code: "EMAIL_PROVIDER_AUTH_FAILED" }, "temporarily unavailable"],
    [{ success: false, code: "EMAIL_PROVIDER_TEMPORARILY_UNAVAILABLE" }, "temporarily unavailable"],
    [{ success: false, code: "EMAIL_PROVIDER_RATE_LIMITED" }, "Too many verification-email requests"],
    [{ success: false, code: "EMAIL_RECIPIENT_REJECTED" }, "check the address"],
    [{ success: false }, "could not send a new verification link"],
    [{ success: false, code: "SOME_UNKNOWN_INTERNAL_CODE" }, "could not send a new verification link"],
    [null, "could not send a new verification link"],
    [{}, "could not send a new verification link"],
    ["not-an-object", "could not send a new verification link"],
  ])("delivery failure %j maps to a stable, non-raw user-facing message", async (delivery, expectedSubstring) => {
    sendEmailVerificationLinkEmail.mockResolvedValue(delivery);
    const res = response();
    await resendEmailVerification(sessionRequest(), res, jest.fn());
    expect(res.statusCode).toBe(503);
    expect(res.body.state).toBe(S.VERIFICATION_EMAIL_SEND_FAILED);
    expect(res.body.message).toContain(expectedSubstring);
    // Never expose raw provider codes/categories/attempts to the client.
    expect(JSON.stringify(res.body)).not.toContain("EMAIL_PROVIDER");
    expect(JSON.stringify(res.body)).not.toContain("attempts");
  });

  test("delivery failure logs a safe fingerprint + normalized category, never the raw email or link", async () => {
    sendEmailVerificationLinkEmail.mockResolvedValue({
      success: false,
      category: "rate_limit",
      code: "EMAIL_PROVIDER_RATE_LIMITED",
      attempts: [{ provider: "resend", category: "rate_limit", code: "EMAIL_PROVIDER_RATE_LIMITED" }],
    });
    const res = response();
    await resendEmailVerification(sessionRequest(), res, jest.fn());
    expect(res.statusCode).toBe(503);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        emailFingerprint: expect.any(String),
        category: "rate_limit",
        code: "EMAIL_PROVIDER_RATE_LIMITED",
      }),
      "Email verification send failed",
    );
    const loggedArgs = JSON.stringify(logger.error.mock.calls);
    expect(loggedArgs).not.toContain("leigh@example.com");
    expect(loggedArgs).not.toContain("oobCode");
  });

  test("Firebase link generation failure never attempts delivery, releases the reservation, and returns the generic 503", async () => {
    firebaseAuth.generateEmailVerificationLink.mockRejectedValue(new Error("internal firebase error"));
    const res = response();
    await resendEmailVerification(sessionRequest(), res, jest.fn());
    expect(res.statusCode).toBe(503);
    expect(res.body.state).toBe(S.VERIFICATION_EMAIL_SEND_FAILED);
    expect(res.body.message).toContain("temporarily unavailable");
    expect(sendEmailVerificationLinkEmail).not.toHaveBeenCalled();
    expect(User.updateOne).toHaveBeenCalledWith(
      expect.any(Object),
      { $unset: { emailVerificationSendReservedAt: 1, emailVerificationReservationId: 1 } },
    );
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ code: "EMAIL_LINK_GENERATION_FAILED" }),
      "Email verification send failed",
    );
  });

  test("a stale reservation lock self-recovers into the cooldown response, never the delivery-failure message", async () => {
    // Simulate an old, still-active reservation blocking the atomic claim.
    User.findOneAndUpdate.mockResolvedValueOnce(null);
    User.findById.mockReturnValueOnce(
      selectable(makeUser({ emailVerificationSendReservedAt: new Date(Date.now() - 5000) })),
    );
    const res = response();
    await resendEmailVerification(sessionRequest(), res, jest.fn());
    expect(res.statusCode).toBe(429);
    expect(res.body.state).toBe(S.RATE_LIMITED_OR_COOLDOWN_ACTIVE);
    expect(res.body.state).not.toBe(S.VERIFICATION_EMAIL_SEND_FAILED);
    expect(sendEmailVerificationLinkEmail).not.toHaveBeenCalled();
  });

  test("provider success plus cooldown finalization failure remains fail closed", async () => {
    User.updateOne.mockRejectedValueOnce(new Error("database unavailable"));
    const first = response();
    await resendEmailVerification(sessionRequest(), first, jest.fn());
    expect(first.statusCode).toBe(200);
    expect(first.body.state).toBe(S.VERIFICATION_EMAIL_RESENT);
    expect(logger.error).toHaveBeenCalledWith(expect.any(Object), expect.stringMatching(/failed closed/));

    User.findOneAndUpdate.mockResolvedValueOnce(null);
    User.findById.mockReturnValueOnce(selectable(makeUser({ emailVerificationSendReservedAt: new Date() })));
    const retry = response();
    await resendEmailVerification(sessionRequest(), retry, jest.fn());
    expect(retry.statusCode).toBe(429);
    expect(sendEmailVerificationLinkEmail).toHaveBeenCalledTimes(1);
  });

  test("parallel resends make at most one provider call", async () => {
    User.findOneAndUpdate.mockResolvedValueOnce(makeUser()).mockResolvedValueOnce(null);
    const [one, two] = [response(), response()];
    await Promise.all([
      resendEmailVerification(sessionRequest(), one, jest.fn()),
      resendEmailVerification(sessionRequest(), two, jest.fn()),
    ]);
    expect(sendEmailVerificationLinkEmail).toHaveBeenCalledTimes(1);
    expect([one.statusCode, two.statusCode].sort()).toEqual([200, 429]);
  });

  test("atomic reservation permits stale cooldown fields", async () => {
    await resendEmailVerification(sessionRequest(), response(), jest.fn());
    const query = User.findOneAndUpdate.mock.calls[0][0];
    expect(query.$and).toHaveLength(3);
    expect(query.$and[2].$or[1].emailVerificationSendReservedAt.$lte).toBeInstanceOf(Date);
  });

  test("verified account cannot resend and stale Mongo state is synchronized", async () => {
    firebaseAuth.getUser.mockResolvedValue(firebaseUser({ emailVerified: true }));
    const stale = makeUser();
    User.findOne.mockResolvedValue(stale);
    const res = response();
    await resendEmailVerification(sessionRequest(), res, jest.fn());
    expect(res.body.state).toBe(S.ALREADY_VERIFIED_ACCOUNT);
    expect(sendEmailVerificationLinkEmail).not.toHaveBeenCalled();
    expect(stale.save).toHaveBeenCalled();
  });

  test("cookie-backed finalization confirms Firebase then reconciles Mongo", async () => {
    firebaseAuth.getUser.mockResolvedValue(firebaseUser({ emailVerified: true }));
    const stale = makeUser();
    User.findOne.mockResolvedValue(stale);
    const res = response();
    await finalizeEmailVerification(sessionRequest(), res, jest.fn());
    expect(res.body).toMatchObject({ state: S.VALID_UNUSED_LINK, verified: true, reconciled: true });
    expect(stale.save).toHaveBeenCalled();
  });

  test("authenticated reconciliation supports legacy links and is idempotent", async () => {
    firebaseAuth.getUser.mockResolvedValue(firebaseUser({ emailVerified: true }));
    const already = makeUser({ isEmailVerified: true, onboardingStatus: "profile_complete" });
    User.findOne.mockResolvedValue(already);
    const res = response();
    await reconcileAuthenticatedEmailVerification({ user: { uid: "firebase-uid" } }, res, jest.fn());
    expect(res.body).toMatchObject({ verified: true, reconciled: true });
    expect(already.save).not.toHaveBeenCalled();
  });

  test("Firebase identity mismatch is rejected", async () => {
    firebaseAuth.getUser.mockResolvedValue(firebaseUser({ email: "other@example.com", emailVerified: true }));
    const res = response();
    await finalizeEmailVerification(sessionRequest(), res, jest.fn());
    expect(res.statusCode).toBe(409);
    expect(res.body.state).toBe(S.ACCOUNT_MISMATCH);
  });

  test("Mongo email owned by another Firebase UID is never attached", async () => {
    firebaseAuth.getUser.mockResolvedValue(firebaseUser({ emailVerified: true }));
    User.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(makeUser({ firebaseUid: "another-uid" }));
    const res = response();
    await reconcileAuthenticatedEmailVerification({ user: { uid: "firebase-uid" } }, res, jest.fn());
    expect(res.statusCode).toBe(409);
    expect(res.body.state).toBe(S.ACCOUNT_MISMATCH);
    expect(User.updateOne).not.toHaveBeenCalled();
  });

  test("status reports signed-in cross-account mismatch without exposing identity", async () => {
    firebaseAuth.verifyIdToken.mockResolvedValue({ uid: "wrong-uid" });
    const res = response();
    await getEmailVerificationStatus(sessionRequest({ headers: {
      cookie: `lilycrest_email_verification=${createOpaqueExchangeToken()}`,
      authorization: "Bearer wrong-account",
    } }), res, jest.fn());
    expect(res.body.identityMatch).toBe("mismatch");
    expect(JSON.stringify(res.body)).not.toContain("firebase-uid");
    expect(JSON.stringify(res.body)).not.toContain("leigh@example.com");
  });
});
