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
};
const sendEmailVerificationLinkEmail = jest.fn();
const User = {
  findOne: jest.fn(),
  findOneAndUpdate: jest.fn(),
  findById: jest.fn(),
  updateOne: jest.fn(),
};

await jest.unstable_mockModule("../config/firebase.js", () => ({ getAuth: () => firebaseAuth }));
await jest.unstable_mockModule("../config/email.js", () => ({ sendEmailVerificationLinkEmail }));
await jest.unstable_mockModule("../models/index.js", () => ({ User }));

const {
  finalizeEmailVerification,
  getEmailVerificationStatus,
  resendEmailVerification,
  sendAuthenticatedEmailVerification,
} = await import("./emailVerificationController.js");
const { createVerificationContext, EMAIL_VERIFICATION_STATES: S } = await import("../services/emailVerificationService.js");

const response = () => ({
  statusCode: 200,
  body: null,
  status(code) { this.statusCode = code; return this; },
  json(body) { this.body = body; return this; },
});

const makeUser = (overrides = {}) => ({
  _id: "mongo-user-id",
  firebaseUid: "firebase-uid",
  email: "leigh@example.com",
  firstName: "Leigh",
  isEmailVerified: false,
  onboardingStatus: "verification_pending",
  emailVerificationLastSentAt: null,
  save: jest.fn(async function save() { return this; }),
  ...overrides,
});

const firebaseUser = (overrides = {}) => ({
  uid: "firebase-uid",
  email: "leigh@example.com",
  emailVerified: false,
  ...overrides,
});

const context = (continuePath = "/applicant/reservation") =>
  createVerificationContext({ uid: "firebase-uid", email: "leigh@example.com", continuePath });

beforeEach(() => {
  jest.clearAllMocks();
  firebaseAuth.getUser.mockResolvedValue(firebaseUser());
  firebaseAuth.generateEmailVerificationLink.mockResolvedValue(
    "https://project.firebaseapp.com/__/auth/action?mode=verifyEmail&oobCode=one-time-code&apiKey=public-key",
  );
  User.findOne.mockResolvedValue(makeUser());
  User.findOneAndUpdate.mockResolvedValue(makeUser());
  User.findById.mockResolvedValue(makeUser());
  User.updateOne.mockResolvedValue({ modifiedCount: 1 });
  sendEmailVerificationLinkEmail.mockResolvedValue({ success: true });
});

describe("email verification controller", () => {
  test("initial authenticated send accepts no caller-supplied identity", async () => {
    const req = { user: { uid: "firebase-uid" }, body: { continuePath: "/applicant/reservation" } };
    const res = response();
    await sendAuthenticatedEmailVerification(req, res, jest.fn());
    expect(res.statusCode).toBe(200);
    expect(res.body.state).toBe(S.VERIFICATION_EMAIL_RESENT);
    expect(res.body.maskedEmail).toBe("l****@example.com");
    expect(sendEmailVerificationLinkEmail).toHaveBeenCalledTimes(1);
    const sent = sendEmailVerificationLinkEmail.mock.calls[0][0];
    expect(sent.verificationLink).toContain("https://www.lilycrest.space/auth-action");
    expect(JSON.stringify(req.body)).not.toContain("leigh@example.com");
  });

  test("resend success returns a refreshable context and cooldown", async () => {
    const res = response();
    await resendEmailVerification({ body: { verificationContext: context() } }, res, jest.fn());
    expect(res.body).toMatchObject({ state: S.VERIFICATION_EMAIL_RESENT, retryAfterSeconds: 60 });
    expect(res.body.verificationContext).toEqual(expect.any(String));
    expect(User.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ emailVerificationReservationId: expect.any(String) }),
      expect.objectContaining({ $set: { emailVerificationLastSentAt: expect.any(Date) } }),
    );
  });

  test("delivery failure is honest and releases the send reservation", async () => {
    sendEmailVerificationLinkEmail.mockResolvedValue({ success: false });
    const res = response();
    await resendEmailVerification({ body: { verificationContext: context() } }, res, jest.fn());
    expect(res.statusCode).toBe(503);
    expect(res.body.state).toBe(S.VERIFICATION_EMAIL_SEND_FAILED);
    expect(res.body.message).toMatch(/could not send/i);
    expect(User.updateOne).toHaveBeenCalledWith(
      expect.any(Object),
      { $unset: { emailVerificationSendReservedAt: 1, emailVerificationReservationId: 1 } },
    );
  });

  test("cooldown prevents provider contact", async () => {
    User.findOneAndUpdate.mockResolvedValue(null);
    User.findById.mockResolvedValue(makeUser({ emailVerificationLastSentAt: new Date() }));
    const res = response();
    await resendEmailVerification({ body: { verificationContext: context() } }, res, jest.fn());
    expect(res.statusCode).toBe(429);
    expect(res.body.state).toBe(S.RATE_LIMITED_OR_COOLDOWN_ACTIVE);
    expect(sendEmailVerificationLinkEmail).not.toHaveBeenCalled();
  });

  test("already verified account cannot resend and stale Mongo state is synchronized", async () => {
    firebaseAuth.getUser.mockResolvedValue(firebaseUser({ emailVerified: true }));
    const stale = makeUser();
    User.findOne.mockResolvedValue(stale);
    const res = response();
    await resendEmailVerification({ body: { verificationContext: context() } }, res, jest.fn());
    expect(res.body.state).toBe(S.ALREADY_VERIFIED_ACCOUNT);
    expect(sendEmailVerificationLinkEmail).not.toHaveBeenCalled();
    expect(stale.isEmailVerified).toBe(true);
    expect(stale.onboardingStatus).toBe("profile_complete");
    expect(stale.save).toHaveBeenCalled();
  });

  test("finalize confirms Firebase then updates the application user", async () => {
    firebaseAuth.getUser.mockResolvedValue(firebaseUser({ emailVerified: true }));
    const stale = makeUser();
    User.findOne.mockResolvedValue(stale);
    const res = response();
    await finalizeEmailVerification({ body: { verificationContext: context() } }, res, jest.fn());
    expect(res.body).toMatchObject({ state: S.VALID_UNUSED_LINK, verified: true, continuePath: "/applicant/reservation" });
    expect(stale.isEmailVerified).toBe(true);
    expect(stale.save).toHaveBeenCalled();
  });

  test("status distinguishes unverified, verified, tampered, and missing users", async () => {
    const pending = response();
    await getEmailVerificationStatus({ body: { verificationContext: context() } }, pending, jest.fn());
    expect(pending.body.state).toBe(S.VALID_UNUSED_LINK);

    const tampered = response();
    await getEmailVerificationStatus({ body: { verificationContext: `${context()}x` } }, tampered, jest.fn());
    expect(tampered.body.state).toBe(S.INVALID_OR_TAMPERED_LINK);

    firebaseAuth.getUser.mockRejectedValue({ code: "auth/user-not-found" });
    const missing = response();
    await getEmailVerificationStatus({ body: { verificationContext: context() } }, missing, jest.fn());
    expect(missing.body.state).toBe(S.USER_NOT_FOUND);
  });
});
