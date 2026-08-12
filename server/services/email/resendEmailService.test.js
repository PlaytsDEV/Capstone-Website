import { beforeEach, describe, expect, jest, test } from "@jest/globals";

// Exercises the single authoritative Resend send path: correct template ID,
// recipient, variables, and sender; failure classification for missing API
// key, missing template ID, and various provider errors; and that no secret
// or PII ever appears in a log call. No network call is made anywhere here.

process.env.NODE_ENV = "test";
process.env.RESEND_API_KEY = "resend-test-key";
process.env.RESEND_FROM_EMAIL = "no-reply@example.test";
process.env.RESEND_TEMPLATE_PASSWORD_RESET = "tmpl_password_reset";

const resendSend = jest.fn();

await jest.unstable_mockModule("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: resendSend } })),
}));

const { sendTemplateEmail, classifyResendError, emailFingerprint, maskEmail } = await import("./resendEmailService.js");
const { __resetResendClientCache } = await import("./resendClient.js");

beforeEach(() => {
  jest.clearAllMocks();
  __resetResendClientCache();
});

const baseCall = (overrides = {}) => ({
  emailType: "PASSWORD_RESET",
  to: "tenant@example.test",
  templateKey: "PASSWORD_RESET",
  variables: { USER_NAME: "Jose", RESET_URL: "https://www.lilycrest.space/auth-action?mode=resetPassword" },
  ...overrides,
});

describe("sendTemplateEmail — happy path", () => {
  test("calls resend.emails.send with the resolved template ID, recipient, variables, and configured sender", async () => {
    resendSend.mockResolvedValue({ data: { id: "msg_123" }, error: null });
    const result = await sendTemplateEmail(baseCall());

    expect(result).toEqual({ success: true, provider: "resend", messageId: "msg_123" });
    expect(resendSend).toHaveBeenCalledTimes(1);
    const [payload] = resendSend.mock.calls[0];
    expect(payload.from).toBe("no-reply@example.test");
    expect(payload.to).toEqual(["tenant@example.test"]);
    expect(payload.template).toEqual({
      id: "tmpl_password_reset",
      variables: { USER_NAME: "Jose", RESET_URL: "https://www.lilycrest.space/auth-action?mode=resetPassword" },
    });
  });

  test("an explicit `from` overrides RESEND_FROM_EMAIL for that send only", async () => {
    resendSend.mockResolvedValue({ data: { id: "msg_124" }, error: null });
    await sendTemplateEmail(baseCall({ from: "billing@example.test" }));
    const [payload] = resendSend.mock.calls[0];
    expect(payload.from).toBe("billing@example.test");
  });

  test("an idempotency key, when provided, is passed to the SDK call", async () => {
    resendSend.mockResolvedValue({ data: { id: "msg_125" }, error: null });
    await sendTemplateEmail(baseCall({ idempotencyKey: "deterministic-key" }));
    const [, options] = resendSend.mock.calls[0];
    expect(options.idempotencyKey).toBe("deterministic-key");
    expect(options.signal).toBeInstanceOf(AbortSignal);
  });
});

describe("sendTemplateEmail — configuration failures", () => {
  test("missing RESEND_API_KEY never calls the provider and returns EMAIL_PROVIDER_NOT_CONFIGURED", async () => {
    delete process.env.RESEND_API_KEY;
    const result = await sendTemplateEmail(baseCall());
    expect(result).toMatchObject({ success: false, code: "EMAIL_PROVIDER_NOT_CONFIGURED" });
    expect(resendSend).not.toHaveBeenCalled();
    process.env.RESEND_API_KEY = "resend-test-key";
  });

  test("missing RESEND_FROM_EMAIL never calls the provider and returns EMAIL_PROVIDER_NOT_CONFIGURED", async () => {
    delete process.env.RESEND_FROM_EMAIL;
    const result = await sendTemplateEmail(baseCall());
    expect(result).toMatchObject({ success: false, code: "EMAIL_PROVIDER_NOT_CONFIGURED" });
    expect(resendSend).not.toHaveBeenCalled();
    process.env.RESEND_FROM_EMAIL = "no-reply@example.test";
  });

  test("an unpublished/missing template ID never calls the provider and returns EMAIL_TEMPLATE_NOT_CONFIGURED", async () => {
    delete process.env.RESEND_TEMPLATE_PASSWORD_RESET;
    const result = await sendTemplateEmail(baseCall());
    expect(result).toMatchObject({ success: false, code: "EMAIL_TEMPLATE_NOT_CONFIGURED" });
    expect(resendSend).not.toHaveBeenCalled();
    process.env.RESEND_TEMPLATE_PASSWORD_RESET = "tmpl_password_reset";
  });

  test("an unknown templateKey (not in the registry at all) is treated the same as an unconfigured template", async () => {
    const result = await sendTemplateEmail(baseCall({ templateKey: "NOT_A_REAL_KEY" }));
    expect(result).toMatchObject({ success: false, code: "EMAIL_TEMPLATE_NOT_CONFIGURED" });
    expect(resendSend).not.toHaveBeenCalled();
  });
});

describe("sendTemplateEmail — provider failure classification", () => {
  test("a Resend-returned error is classified and surfaced as a failure, not silent success", async () => {
    resendSend.mockResolvedValue({ data: null, error: { statusCode: 401, message: "invalid api key" } });
    const result = await sendTemplateEmail(baseCall());
    expect(result).toMatchObject({ success: false, code: "EMAIL_PROVIDER_AUTH_REJECTED" });
  });

  test("a 429 is classified as rate limited", async () => {
    resendSend.mockResolvedValue({ data: null, error: { statusCode: 429, message: "too many requests" } });
    const result = await sendTemplateEmail(baseCall());
    expect(result).toMatchObject({ success: false, code: "EMAIL_PROVIDER_RATE_LIMITED" });
  });

  test("a rejected value the SDK throws instead of returning is caught and classified the same way", async () => {
    resendSend.mockRejectedValue(Object.assign(new Error("network unavailable"), { code: "ECONNREFUSED" }));
    const result = await sendTemplateEmail(baseCall());
    expect(result).toMatchObject({ success: false, code: "EMAIL_PROVIDER_NETWORK_ERROR" });
  });

  test("a response with neither a message id nor an error is treated as failure, not silent success", async () => {
    resendSend.mockResolvedValue({ data: {}, error: null });
    const result = await sendTemplateEmail(baseCall());
    expect(result).toMatchObject({ success: false, code: "EMAIL_DELIVERY_FAILED" });
  });
});

describe("classifyResendError", () => {
  test("never echoes raw provider error text or credentials into the classification", () => {
    const result = classifyResendError({ statusCode: 401, message: "API key sk_live_abcdef123456 is invalid" });
    expect(JSON.stringify(result)).not.toContain("sk_live_abcdef123456");
  });

  test("recipient-rejection patterns classify as EMAIL_RECIPIENT_REJECTED", () => {
    expect(classifyResendError({ message: "550 5.1.1 user unknown" }).code).toBe("EMAIL_RECIPIENT_REJECTED");
  });

  test("handles a null/undefined error input without throwing", () => {
    expect(() => classifyResendError(undefined)).not.toThrow();
    expect(classifyResendError(undefined).code).toBe("EMAIL_PROVIDER_ERROR");
  });
});

describe("no sensitive data is ever logged", () => {
  test("recipient email, OTP-shaped values, and API key never appear in console output on failure", async () => {
    const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    resendSend.mockResolvedValue({ data: null, error: { statusCode: 401, message: "invalid api key" } });
    await sendTemplateEmail(baseCall({ variables: { USER_NAME: "Jose", OTP_CODE: "482913" } }));
    const dump = JSON.stringify(errorSpy.mock.calls);
    expect(dump).not.toContain("tenant@example.test");
    expect(dump).not.toContain("482913");
    expect(dump).not.toContain("resend-test-key");
    errorSpy.mockRestore();
  });
});

describe("privacy helpers", () => {
  test("emailFingerprint is a stable, non-reversible short hash", () => {
    expect(emailFingerprint("tenant@example.test")).toBe(emailFingerprint("Tenant@Example.Test "));
    expect(emailFingerprint("tenant@example.test")).not.toContain("tenant");
  });

  test("maskEmail preserves only the first local-part character and the domain", () => {
    expect(maskEmail("jose@example.test")).toBe("j***@example.test");
    expect(maskEmail("not-an-email")).toBe("an email address");
  });
});
