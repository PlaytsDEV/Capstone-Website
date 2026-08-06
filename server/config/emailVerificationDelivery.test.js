import { beforeEach, describe, expect, jest, test } from "@jest/globals";
import { EventEmitter } from "events";

// This suite exercises the real sendEmailVerificationLinkEmail() delivery
// logic (provider selection, fallback, timeout, and failure classification)
// with the SMTP connection and Resend mocked at the module boundary. No
// network call, real SMTP/Resend credential, or real email address is used
// anywhere in this file.
//
// SMTP is mocked at the `nodemailer/lib/smtp-connection` level (not
// `transporter.sendMail`) because sendEmailVerificationLinkEmail() drives a
// dedicated SMTPConnection directly so a timeout can force-close the
// in-flight session — a capability `transporter.sendMail()` does not expose.
// Mocking at that boundary lets these tests assert on the same cancellation
// behavior production actually relies on.

process.env.NODE_ENV = "test";
process.env.PUBLIC_FRONTEND_URL = "https://www.lilycrest.space";
process.env.EMAIL_USER = "smtp-user@example.test";
process.env.EMAIL_PASSWORD = "smtp-app-password";
process.env.RESEND_API_KEY = "resend-test-key";
process.env.RESEND_FROM_EMAIL = "no-reply@example.test";

const resendSend = jest.fn();

// Per-test-configurable behavior for the fake SMTP connection. Each hook
// receives the fake connection instance so a test can trigger success/error
// asynchronously (including "after the outer timeout already fired").
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

const smtpSuccess = (recipient = "resend-target@example.test") => ({
  connect: (conn, cb) => cb(),
  login: (conn, auth, cb) => cb(null),
  send: (conn, envelope, stream, cb) => cb(null, { accepted: [recipient], rejected: [], response: "250 OK" }),
});

const smtpNeverResolves = () => ({
  connect: () => {}, // never calls back, never emits — the outer hard timeout must be what ends this
  login: () => {},
  send: () => {},
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

const { sendEmailVerificationLinkEmail, classifyVerificationDeliveryError } = await import("./email.js");

const TEST_RECIPIENT = "resend-target@example.test";
const TEST_LINK = "https://www.lilycrest.space/auth-action?mode=verifyEmail&oobCode=test-code&exchange=test-exchange";

const ok = (overrides = {}) => ({ to: TEST_RECIPIENT, name: "Test Tenant", verificationLink: TEST_LINK, ...overrides });

const assertNoSensitiveLeak = (spy) => {
  const dump = JSON.stringify(spy.mock.calls);
  expect(dump).not.toContain(TEST_RECIPIENT);
  expect(dump).not.toContain(TEST_LINK);
  expect(dump).not.toContain("smtp-app-password");
  expect(dump).not.toContain("resend-test-key");
};

beforeEach(() => {
  jest.clearAllMocks();
  smtpBehavior = smtpSuccess();
});

describe("sendEmailVerificationLinkEmail — provider selection and fallback", () => {
  test("full success via SMTP never calls Resend", async () => {
    const result = await sendEmailVerificationLinkEmail(ok());
    expect(result).toMatchObject({ success: true, provider: "smtp" });
    expect(resendSend).not.toHaveBeenCalled();
  });

  test("SMTP transient failure falls back to Resend success", async () => {
    smtpBehavior = smtpRejectsWithError(Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" }));
    resendSend.mockResolvedValue({ data: { id: "resend-message-1" }, error: null });
    const result = await sendEmailVerificationLinkEmail(ok());
    expect(result).toMatchObject({ success: true, provider: "resend" });
    expect(smtpConnectSpy).toHaveBeenCalledTimes(1);
    expect(resendSend).toHaveBeenCalledTimes(1);
  });

  test("both providers failing returns a single classified failure and preserves the attempt chain", async () => {
    smtpBehavior = smtpRejectsWithError(Object.assign(new Error("535 Authentication failed"), { code: "EAUTH" }));
    resendSend.mockResolvedValue({ data: null, error: { statusCode: 429, message: "Too many requests" } });
    const result = await sendEmailVerificationLinkEmail(ok());
    expect(result.success).toBe(false);
    expect(result.attempts).toHaveLength(2);
    expect(result.attempts[0]).toMatchObject({ provider: "smtp", code: "EMAIL_PROVIDER_AUTH_FAILED" });
    expect(result.attempts[1]).toMatchObject({ provider: "resend", code: "EMAIL_PROVIDER_RATE_LIMITED" });
    // The top-level classification surfaces the first specific (non
    // "not configured") failure, and every provider's diagnosis remains
    // available in `attempts` so no information is lost.
    expect(result.code).toBe("EMAIL_PROVIDER_AUTH_FAILED");
  });

  test("SMTP auth failure is classified distinctly", async () => {
    smtpBehavior = smtpRejectsWithError(
      Object.assign(new Error("535 authentication failed: invalid credentials"), { responseCode: 535 }),
    );
    resendSend.mockResolvedValue({ data: { id: "resend-message-2" }, error: null });
    const result = await sendEmailVerificationLinkEmail(ok());
    expect(result.success).toBe(true); // Resend rescues it
    // But if Resend is also unavailable, the SMTP auth classification surfaces.
    resendSend.mockResolvedValue({ data: null, error: { statusCode: 500, message: "unauthorized: bad api key" } });
    const failure = await sendEmailVerificationLinkEmail(ok());
    expect(failure.attempts[0]).toMatchObject({ code: "EMAIL_PROVIDER_AUTH_FAILED" });
  });

  test("SMTP rate limit is classified as EMAIL_PROVIDER_RATE_LIMITED", async () => {
    smtpBehavior = smtpRejectsWithError(Object.assign(new Error("rate limit exceeded"), { statusCode: 429 }));
    resendSend.mockResolvedValue({ data: null, error: { message: "not configured properly" } });
    const result = await sendEmailVerificationLinkEmail(ok());
    expect(result.attempts[0]).toMatchObject({ provider: "smtp", code: "EMAIL_PROVIDER_RATE_LIMITED" });
  });

  test("SMTP recipient rejection (authoritative rejected[] on the error) is classified as EMAIL_RECIPIENT_REJECTED", async () => {
    const err = Object.assign(new Error("550 5.1.1 The email account does not exist"), {
      responseCode: 550,
      rejected: [TEST_RECIPIENT],
    });
    smtpBehavior = smtpRejectsWithError(err);
    resendSend.mockResolvedValue({ data: null, error: { message: "unrelated failure" } });
    const result = await sendEmailVerificationLinkEmail(ok());
    expect(result.attempts[0]).toMatchObject({ provider: "smtp", code: "EMAIL_RECIPIENT_REJECTED" });
  });

  test("SMTP send() succeeding but reporting the sole recipient as rejected is treated as recipient rejection, not success", async () => {
    smtpBehavior = {
      connect: (conn, cb) => cb(),
      login: (conn, auth, cb) => cb(null),
      send: (conn, envelope, stream, cb) => cb(null, { accepted: [], rejected: [TEST_RECIPIENT], response: "550 rejected" }),
    };
    resendSend.mockResolvedValue({ data: { id: "resend-message-rescue" }, error: null });
    const result = await sendEmailVerificationLinkEmail(ok());
    expect(result).toMatchObject({ success: true, provider: "resend" });
  });

  test("Resend auth failure is classified as EMAIL_PROVIDER_AUTH_FAILED", async () => {
    smtpBehavior = smtpRejectsWithError(new Error("smtp down"));
    resendSend.mockResolvedValue({ data: null, error: { statusCode: 401, message: "invalid api key" } });
    const result = await sendEmailVerificationLinkEmail(ok());
    expect(result.attempts[1]).toMatchObject({ provider: "resend", code: "EMAIL_PROVIDER_AUTH_FAILED" });
  });

  test("Resend rate limit is classified as EMAIL_PROVIDER_RATE_LIMITED", async () => {
    smtpBehavior = smtpRejectsWithError(new Error("smtp down"));
    resendSend.mockResolvedValue({ data: null, error: { statusCode: 429, message: "rate limited" } });
    const result = await sendEmailVerificationLinkEmail(ok());
    expect(result.attempts[1]).toMatchObject({ provider: "resend", code: "EMAIL_PROVIDER_RATE_LIMITED" });
  });

  test("Resend sandbox/test-mode rejection classifies as a generic delivery failure (no raw provider text leaked)", async () => {
    smtpBehavior = smtpRejectsWithError(new Error("smtp down"));
    resendSend.mockResolvedValue({
      data: null,
      error: { statusCode: 403, message: "You can only send testing emails to your own verified address" },
    });
    const result = await sendEmailVerificationLinkEmail(ok());
    expect(result.attempts[1].code).toBe("EMAIL_PROVIDER_AUTH_FAILED");
    expect(JSON.stringify(result)).not.toContain("your own verified address");
  });

  test("Resend sender/domain rejection is classified distinctly from recipient rejection", async () => {
    smtpBehavior = smtpRejectsWithError(new Error("smtp down"));
    resendSend.mockResolvedValue({ data: null, error: { statusCode: 403, message: "domain is not verified" } });
    const result = await sendEmailVerificationLinkEmail(ok());
    expect(result.attempts[1].code).not.toBe("EMAIL_RECIPIENT_REJECTED");
  });

  test("Resend is called with an AbortSignal and an idempotency key derived from the recipient and link", async () => {
    smtpBehavior = smtpRejectsWithError(new Error("smtp down"));
    resendSend.mockResolvedValue({ data: { id: "resend-message-idem" }, error: null });
    await sendEmailVerificationLinkEmail(ok());
    expect(resendSend).toHaveBeenCalledTimes(1);
    const [, options] = resendSend.mock.calls[0];
    expect(options.signal).toBeInstanceOf(AbortSignal);
    expect(options.signal.aborted).toBe(false);
    expect(typeof options.idempotencyKey).toBe("string");
    expect(options.idempotencyKey.length).toBeGreaterThan(0);
    // Must never itself be (or contain) the raw recipient/link.
    expect(options.idempotencyKey).not.toContain(TEST_RECIPIENT);
    expect(options.idempotencyKey).not.toContain(TEST_LINK);
  });

  test("a hung SMTP connection is bounded by the timeout, force-closed, and falls back to Resend", async () => {
    jest.useFakeTimers();
    smtpBehavior = smtpNeverResolves();
    resendSend.mockResolvedValue({ data: { id: "resend-message-3" }, error: null });
    const pending = sendEmailVerificationLinkEmail(ok());
    await jest.advanceTimersByTimeAsync(20001);
    const result = await pending;
    expect(result.success).toBe(true);
    expect(result.provider).toBe("resend");
    // The whole point of driving a raw connection instead of
    // transporter.sendMail(): on timeout we can actually terminate the
    // session instead of merely abandoning a promise.
    expect(smtpCloseSpy).toHaveBeenCalled();
    jest.useRealTimers();
  });

  test("SMTP resolving successfully after the timeout already forced a Resend fallback does not surface as a second success", async () => {
    jest.useFakeTimers();
    let sendCallback;
    smtpBehavior = {
      connect: (conn, cb) => cb(),
      login: (conn, auth, cb) => cb(null),
      send: (conn, envelope, stream, cb) => {
        sendCallback = cb; // never invoked by us until after the timeout below
      },
    };
    resendSend.mockResolvedValue({ data: { id: "resend-message-late" }, error: null });

    const pending = sendEmailVerificationLinkEmail(ok());
    await jest.advanceTimersByTimeAsync(20001);
    const result = await pending;
    expect(result).toMatchObject({ success: true, provider: "resend" });
    expect(smtpCloseSpy).toHaveBeenCalled();

    // Simulate the abandoned SMTP session's callback finally firing late
    // (e.g. a delayed 250 response the closed connection is no longer
    // listening for in a real socket, but exercised here to prove the
    // application layer can't be tricked into acting on it twice).
    expect(() => sendCallback(null, { accepted: [TEST_RECIPIENT], rejected: [] })).not.toThrow();
    // The already-resolved outer promise cannot change outcome or provider,
    // and no unhandled rejection/second callback into caller code occurs.
    jest.useRealTimers();
  });

  test("a provider throwing a non-Error value does not crash and classifies as a generic failure", async () => {
    smtpBehavior = smtpRejectsWithError("raw string rejection");
    resendSend.mockRejectedValue(undefined);
    const result = await sendEmailVerificationLinkEmail(ok());
    expect(result.success).toBe(false);
    expect(result.code).toBe("EMAIL_DELIVERY_FAILED");
  });

  test("SMTP accepting the message without a messageId still falls back to Resend", async () => {
    smtpBehavior = {
      connect: (conn, cb) => cb(),
      login: (conn, auth, cb) => cb(null),
      send: (conn, envelope, stream, cb) => cb(null, {}), // malformed/incomplete success
    };
    resendSend.mockResolvedValue({ data: { id: "resend-message-4" }, error: null });
    const result = await sendEmailVerificationLinkEmail(ok());
    expect(result).toMatchObject({ success: true, provider: "resend" });
  });

  test("Resend returning malformed output (no id, no error) is treated as failure, not silent success", async () => {
    smtpBehavior = smtpRejectsWithError(new Error("smtp down"));
    resendSend.mockResolvedValue({ data: {}, error: null });
    const result = await sendEmailVerificationLinkEmail(ok());
    expect(result.success).toBe(false);
    expect(result.attempts[1]).toMatchObject({ provider: "resend", code: "EMAIL_DELIVERY_FAILED" });
  });

  test("no sensitive data (email address, link, credentials) appears in provider-failure console output", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    smtpBehavior = smtpRejectsWithError(new Error("Invalid login: 535 authentication failed"));
    resendSend.mockResolvedValue({ data: null, error: { statusCode: 401, message: "invalid api key" } });
    await sendEmailVerificationLinkEmail(ok());
    assertNoSensitiveLeak(errorSpy);
    errorSpy.mockRestore();
  });
});

describe("classifyVerificationDeliveryError", () => {
  test("never echoes raw provider error text into the classification", () => {
    const result = classifyVerificationDeliveryError({
      statusCode: 401,
      message: "API key sk_live_abcdef123456 is invalid",
    });
    expect(JSON.stringify(result)).not.toContain("sk_live_abcdef123456");
  });

  test("recipient-rejection patterns are detected ahead of generic classification", () => {
    const result = classifyVerificationDeliveryError({ message: "550 5.1.1 user unknown" });
    expect(result.code).toBe("EMAIL_RECIPIENT_REJECTED");
  });

  test("an authoritative rejected[] list on the error is honored even without a matching message pattern", () => {
    const result = classifyVerificationDeliveryError({ message: "unexpected server response", rejected: ["a@b.test"] });
    expect(result.code).toBe("EMAIL_RECIPIENT_REJECTED");
  });

  test("handles a null/undefined error input without throwing", () => {
    expect(() => classifyVerificationDeliveryError(undefined)).not.toThrow();
    expect(classifyVerificationDeliveryError(undefined).code).toBe("EMAIL_DELIVERY_FAILED");
  });
});
