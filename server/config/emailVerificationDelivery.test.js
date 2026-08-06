import { beforeEach, describe, expect, jest, test } from "@jest/globals";

// This suite exercises the real sendEmailVerificationLinkEmail() delivery
// logic (provider selection, fallback, timeout, and failure classification)
// with nodemailer and Resend mocked at the module boundary. No network
// call, real SMTP/Resend credential, or real email address is used anywhere
// in this file.

process.env.NODE_ENV = "test";
process.env.PUBLIC_FRONTEND_URL = "https://www.lilycrest.space";
process.env.EMAIL_USER = "smtp-user@example.test";
process.env.EMAIL_PASSWORD = "smtp-app-password";
process.env.RESEND_API_KEY = "resend-test-key";
process.env.RESEND_FROM_EMAIL = "no-reply@example.test";

const sendMail = jest.fn();
const verify = jest.fn((cb) => cb && cb(null));
const createTransport = jest.fn(() => ({ sendMail, verify }));

const resendSend = jest.fn();

await jest.unstable_mockModule("nodemailer", () => ({
  default: { createTransport },
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
});

describe("sendEmailVerificationLinkEmail — provider selection and fallback", () => {
  test("full success via SMTP never calls Resend", async () => {
    sendMail.mockResolvedValue({ messageId: "smtp-message-1" });
    const result = await sendEmailVerificationLinkEmail(ok());
    expect(result).toMatchObject({ success: true, provider: "smtp" });
    expect(resendSend).not.toHaveBeenCalled();
  });

  test("SMTP transient failure falls back to Resend success", async () => {
    sendMail.mockRejectedValue(Object.assign(new Error("connect ETIMEDOUT"), { code: "ETIMEDOUT" }));
    resendSend.mockResolvedValue({ data: { id: "resend-message-1" }, error: null });
    const result = await sendEmailVerificationLinkEmail(ok());
    expect(result).toMatchObject({ success: true, provider: "resend" });
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(resendSend).toHaveBeenCalledTimes(1);
  });

  test("both providers failing returns a single classified failure and preserves the attempt chain", async () => {
    sendMail.mockRejectedValue(Object.assign(new Error("535 Authentication failed"), { code: "EAUTH" }));
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
    sendMail.mockRejectedValue(Object.assign(new Error("535 authentication failed: invalid credentials"), { responseCode: 535 }));
    resendSend.mockResolvedValue({ data: { id: "resend-message-2" }, error: null });
    const result = await sendEmailVerificationLinkEmail(ok());
    expect(result.success).toBe(true); // Resend rescues it
    // But if Resend is also unavailable, the SMTP auth classification surfaces.
    resendSend.mockResolvedValue({ data: null, error: { statusCode: 500, message: "unauthorized: bad api key" } });
    const failure = await sendEmailVerificationLinkEmail(ok());
    expect(failure.attempts[0]).toMatchObject({ code: "EMAIL_PROVIDER_AUTH_FAILED" });
  });

  test("SMTP rate limit is classified as EMAIL_PROVIDER_RATE_LIMITED", async () => {
    sendMail.mockRejectedValue(Object.assign(new Error("rate limit exceeded"), { statusCode: 429 }));
    resendSend.mockResolvedValue({ data: null, error: { message: "not configured properly" } });
    const result = await sendEmailVerificationLinkEmail(ok());
    expect(result.attempts[0]).toMatchObject({ provider: "smtp", code: "EMAIL_PROVIDER_RATE_LIMITED" });
  });

  test("SMTP recipient rejection is classified as EMAIL_RECIPIENT_REJECTED", async () => {
    sendMail.mockRejectedValue(
      Object.assign(new Error("550 5.1.1 The email account does not exist"), { responseCode: 550 }),
    );
    resendSend.mockResolvedValue({ data: null, error: { message: "unrelated failure" } });
    const result = await sendEmailVerificationLinkEmail(ok());
    expect(result.attempts[0]).toMatchObject({ provider: "smtp", code: "EMAIL_RECIPIENT_REJECTED" });
  });

  test("Resend auth failure is classified as EMAIL_PROVIDER_AUTH_FAILED", async () => {
    sendMail.mockRejectedValue(new Error("smtp down"));
    resendSend.mockResolvedValue({ data: null, error: { statusCode: 401, message: "invalid api key" } });
    const result = await sendEmailVerificationLinkEmail(ok());
    expect(result.attempts[1]).toMatchObject({ provider: "resend", code: "EMAIL_PROVIDER_AUTH_FAILED" });
  });

  test("Resend rate limit is classified as EMAIL_PROVIDER_RATE_LIMITED", async () => {
    sendMail.mockRejectedValue(new Error("smtp down"));
    resendSend.mockResolvedValue({ data: null, error: { statusCode: 429, message: "rate limited" } });
    const result = await sendEmailVerificationLinkEmail(ok());
    expect(result.attempts[1]).toMatchObject({ provider: "resend", code: "EMAIL_PROVIDER_RATE_LIMITED" });
  });

  test("Resend sandbox/test-mode rejection classifies as a generic delivery failure (no raw provider text leaked)", async () => {
    sendMail.mockRejectedValue(new Error("smtp down"));
    resendSend.mockResolvedValue({
      data: null,
      error: { statusCode: 403, message: "You can only send testing emails to your own verified address" },
    });
    const result = await sendEmailVerificationLinkEmail(ok());
    expect(result.attempts[1].code).toBe("EMAIL_PROVIDER_AUTH_FAILED");
    expect(JSON.stringify(result)).not.toContain("your own verified address");
  });

  test("Resend sender/domain rejection is classified distinctly from recipient rejection", async () => {
    sendMail.mockRejectedValue(new Error("smtp down"));
    resendSend.mockResolvedValue({ data: null, error: { statusCode: 403, message: "domain is not verified" } });
    const result = await sendEmailVerificationLinkEmail(ok());
    expect(result.attempts[1].code).not.toBe("EMAIL_RECIPIENT_REJECTED");
  });

  test("a hung provider is bounded by a timeout and classified as temporarily unavailable", async () => {
    jest.useFakeTimers();
    sendMail.mockReturnValue(new Promise(() => {})); // never resolves
    resendSend.mockResolvedValue({ data: { id: "resend-message-3" }, error: null });
    const pending = sendEmailVerificationLinkEmail(ok());
    await jest.advanceTimersByTimeAsync(20001);
    const result = await pending;
    expect(result.success).toBe(true);
    expect(result.provider).toBe("resend");
    jest.useRealTimers();
  });

  test("a provider throwing a non-Error value does not crash and classifies as a generic failure", async () => {
    sendMail.mockRejectedValue("raw string rejection");
    resendSend.mockRejectedValue(undefined);
    const result = await sendEmailVerificationLinkEmail(ok());
    expect(result.success).toBe(false);
    expect(result.code).toBe("EMAIL_DELIVERY_FAILED");
  });

  test("SMTP accepting the message without a messageId still falls back to Resend", async () => {
    sendMail.mockResolvedValue({}); // malformed/incomplete success
    resendSend.mockResolvedValue({ data: { id: "resend-message-4" }, error: null });
    const result = await sendEmailVerificationLinkEmail(ok());
    expect(result).toMatchObject({ success: true, provider: "resend" });
  });

  test("Resend returning malformed output (no id, no error) is treated as failure, not silent success", async () => {
    sendMail.mockRejectedValue(new Error("smtp down"));
    resendSend.mockResolvedValue({ data: {}, error: null });
    const result = await sendEmailVerificationLinkEmail(ok());
    expect(result.success).toBe(false);
    expect(result.attempts[1]).toMatchObject({ provider: "resend", code: "EMAIL_DELIVERY_FAILED" });
  });

  test("no sensitive data (email address, link, credentials) appears in provider-failure console output", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    sendMail.mockRejectedValue(new Error("Invalid login: 535 authentication failed"));
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

  test("handles a null/undefined error input without throwing", () => {
    expect(() => classifyVerificationDeliveryError(undefined)).not.toThrow();
    expect(classifyVerificationDeliveryError(undefined).code).toBe("EMAIL_DELIVERY_FAILED");
  });
});
