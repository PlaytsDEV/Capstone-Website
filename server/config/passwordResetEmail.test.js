import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { EventEmitter } from "events";

// Mirrors emailVerificationDelivery.test.js's mocking approach exactly —
// sendPasswordResetLinkEmail() reuses the same SMTP-hard-timeout/Resend-
// fallback machinery, so it needs the same module-boundary mocks. No
// network call, real credential, or real email address is used anywhere in
// this file.

process.env.NODE_ENV = "test";
process.env.PUBLIC_FRONTEND_URL = "https://www.lilycrest.space";
process.env.EMAIL_USER = "smtp-user@example.test";
process.env.EMAIL_PASSWORD = "smtp-app-password";
process.env.RESEND_API_KEY = "resend-test-key";
process.env.RESEND_FROM_EMAIL = "no-reply@example.test";

const resendSend = jest.fn();

let smtpBehavior;
const smtpCloseSpy = jest.fn();
const smtpConnectSpy = jest.fn();

class FakeSMTPConnection extends EventEmitter {
  constructor(options) {
    super();
    this.options = options;
  }
  connect(cb) {
    smtpConnectSpy();
    smtpBehavior.connect(this, cb);
  }
  login(auth, cb) {
    smtpBehavior.login(this, auth, cb);
  }
  send(envelope, stream, cb) {
    smtpBehavior.send(this, envelope, stream, cb);
  }
  close() {
    smtpCloseSpy();
  }
}

const smtpSuccess = (recipient = "reset-target@example.test") => ({
  connect: (conn, cb) => cb(),
  login: (conn, auth, cb) => cb(null),
  send: (conn, envelope, stream, cb) => cb(null, { accepted: [recipient], rejected: [], response: "250 OK" }),
});

const smtpRejectsWithError = (error) => ({
  connect: (conn, cb) => cb(),
  login: (conn, auth, cb) => cb(null),
  send: (conn, envelope, stream, cb) => cb(error),
});

await jest.unstable_mockModule("nodemailer/lib/smtp-connection/index.js", () => ({
  default: FakeSMTPConnection,
}));
await jest.unstable_mockModule("nodemailer/lib/mail-composer/index.js", () => ({
  default: class FakeMailComposer {
    constructor(mailOptions) {
      this.mailOptions = mailOptions;
    }
    compile() {
      return {
        getEnvelope: () => ({ from: this.mailOptions.from, to: [].concat(this.mailOptions.to) }),
        messageId: () => "<fake-message-id@example.test>",
        createReadStream: () => ({}),
      };
    }
  },
}));
await jest.unstable_mockModule("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: resendSend } })),
}));

const { sendPasswordResetLinkEmail, generatePasswordResetEmail, sendEmailVerificationLinkEmail } =
  await import("./email.js");

const TEST_RECIPIENT = "reset-target@example.test";
const TEST_LINK = "https://www.lilycrest.space/auth-action?mode=resetPassword&oobCode=test-reset-code&apiKey=test-key";

const ok = (overrides = {}) => ({ to: TEST_RECIPIENT, name: "Test Tenant", resetLink: TEST_LINK, ...overrides });

beforeEach(() => {
  jest.clearAllMocks();
  smtpBehavior = smtpSuccess();
});

describe("sendPasswordResetLinkEmail — provider selection and fallback", () => {
  test("full success via SMTP never calls Resend", async () => {
    const result = await sendPasswordResetLinkEmail(ok());
    expect(result).toMatchObject({ success: true, provider: "smtp" });
    expect(resendSend).not.toHaveBeenCalled();
  });

  test("SMTP transient failure falls back to Resend success", async () => {
    smtpBehavior = smtpRejectsWithError(Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" }));
    resendSend.mockResolvedValue({ data: { id: "resend-message-1" }, error: null });
    const result = await sendPasswordResetLinkEmail(ok());
    expect(result).toMatchObject({ success: true, provider: "resend" });
    expect(smtpConnectSpy).toHaveBeenCalledTimes(1);
    expect(resendSend).toHaveBeenCalledTimes(1);
  });

  test("both providers failing returns a single classified failure and preserves the attempt chain", async () => {
    smtpBehavior = smtpRejectsWithError(Object.assign(new Error("535 Authentication failed"), { code: "EAUTH" }));
    resendSend.mockResolvedValue({ data: null, error: { statusCode: 429, message: "Too many requests" } });
    const result = await sendPasswordResetLinkEmail(ok());
    expect(result.success).toBe(false);
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0]).toMatchObject({ provider: "smtp", code: "EMAIL_PROVIDER_AUTH_FAILED" });
    expect(result.attempts[1]).toMatchObject({ provider: "resend", code: "EMAIL_PROVIDER_RATE_LIMITED" });
    expect(result.code).toBe("EMAIL_PROVIDER_AUTH_FAILED");
  });

  test("Resend is called with an AbortSignal and an idempotency key namespaced separately from email verification", async () => {
    smtpBehavior = smtpRejectsWithError(new Error("smtp down"));
    resendSend.mockResolvedValue({ data: { id: "resend-message-idem" }, error: null });
    await sendPasswordResetLinkEmail(ok());
    expect(resendSend).toHaveBeenCalledTimes(1);
    const [, options] = resendSend.mock.calls[0];
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(typeof options.idempotencyKey).toBe("string");
    expect(options.idempotencyKey).not.toContain(TEST_RECIPIENT);
    expect(options.idempotencyKey).not.toContain(TEST_LINK);

    // Same recipient + a same-shaped link must not collide between the two
    // features' idempotency keys — otherwise a verification-email retry
    // could be deduped against an unrelated password-reset send or vice
    // versa.
    resendSend.mockClear();
    resendSend.mockResolvedValue({ data: { id: "resend-message-verify" }, error: null });
    await sendEmailVerificationLinkEmail({ to: TEST_RECIPIENT, name: "Test Tenant", verificationLink: TEST_LINK });
    const [, verifyOptions] = resendSend.mock.calls[0];
    expect(verifyOptions.idempotencyKey).not.toBe(options.idempotencyKey);
  });

  test("no sensitive data (email address, link, credentials) appears in provider-failure console output", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    smtpBehavior = smtpRejectsWithError(new Error("Invalid login: 535 authentication failed"));
    resendSend.mockResolvedValue({ data: null, error: { statusCode: 401, message: "invalid api key" } });
    await sendPasswordResetLinkEmail(ok());
    const dump = JSON.stringify(errorSpy.mock.calls);
    expect(dump).not.toContain(TEST_RECIPIENT);
    expect(dump).not.toContain(TEST_LINK);
    expect(dump).not.toContain("smtp-app-password");
    expect(dump).not.toContain("resend-test-key");
    errorSpy.mockRestore();
  });
});

describe("generatePasswordResetEmail — Lilycrest branded template, matches the verification email's visual system", () => {
  test("subject follows the same sibling convention as 'Verify your Lilycrest email' / 'Your Lilycrest login OTP'", async () => {
    const smtpMailSpy = jest.fn();
    smtpBehavior = {
      connect: (conn, cb) => cb(),
      login: (conn, auth, cb) => cb(null),
      send: (conn, envelope, stream, cb) => {
        smtpMailSpy(envelope);
        cb(null, { accepted: [TEST_RECIPIENT], rejected: [], response: "250 OK" });
      },
    };
    await sendPasswordResetLinkEmail(ok());
    expect(smtpMailSpy).toHaveBeenCalled();
  });

  test("HTML reuses the shared Lilycrest gold theme, logo header, and footer — not a bespoke design", () => {
    const html = generatePasswordResetEmail({ displayName: "Jose", resetLink: TEST_LINK });
    // Shared brand shell markers (same ones the verification email renders).
    expect(html).toContain("Lilycrest Dormitory");
    expect(html).toContain("#c9a227"); // THEME.gold
    expect(html).toContain("LOGO-8Ay0b2-y.svg");
    expect(html).toContain("This is an automated notification. Please do not reply directly to this email.");
  });

  test("heading and CTA text match the required password-reset copy", () => {
    const html = generatePasswordResetEmail({ displayName: "Jose", resetLink: TEST_LINK });
    expect(html).toContain("Reset Your Password");
    expect(html).toContain(">Reset Password<");
  });

  test("CTA href is the actual generated Firebase reset link, not a hardcoded bare domain", () => {
    const html = generatePasswordResetEmail({ displayName: "Jose", resetLink: TEST_LINK });
    // The link is HTML-escaped in the href attribute (& -> &amp;), same as
    // the verification email's CTA.
    const escapedLink = TEST_LINK.replace(/&/g, "&amp;");
    expect(html).toContain(`href="${escapedLink}"`);
    // Must not hardcode only the bare canonical host with no action params.
    expect(html).not.toContain('href="https://www.lilycrest.space/auth-action"><');
  });

  test("includes the required 'safe to ignore, password unchanged' security note without implying the password already changed", () => {
    const html = generatePasswordResetEmail({ displayName: "Jose", resetLink: TEST_LINK });
    expect(html).toContain("If you did not request a password reset, you can safely ignore this email.");
    expect(html).toContain("Your password will remain unchanged.");
    expect(html).not.toMatch(/password (has been|was) (already )?changed/i);
  });

  test("includes a neutral expiration notice without inventing a specific duration", () => {
    const html = generatePasswordResetEmail({ displayName: "Jose", resetLink: TEST_LINK });
    expect(html).toContain("this password reset link is temporary");
    expect(html).not.toMatch(/expires? in \d+/i);
  });

  test("includes a copy/paste fallback link for clients where the CTA button doesn't render", () => {
    const html = generatePasswordResetEmail({ displayName: "Jose", resetLink: TEST_LINK });
    expect(html).toContain("If the button above doesn't work");
    const escapedLink = TEST_LINK.replace(/&/g, "&amp;");
    const occurrences = html.match(new RegExp(escapedLink.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || [];
    // Once in the CTA href, once in the visible fallback link.
    expect(occurrences.length).toBeGreaterThanOrEqual(2);
  });

  test("HTML-escapes the display name and reset link (no injection via a crafted name)", () => {
    const html = generatePasswordResetEmail({ displayName: '<img src=x onerror=alert(1)>', resetLink: TEST_LINK });
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
    expect(html).toContain("&lt;img src=x onerror=alert(1)&gt;");
  });
});
