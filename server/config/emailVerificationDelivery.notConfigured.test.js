import { describe, expect, jest, test } from "@jest/globals";

// Verifies that blank/whitespace-only provider env vars are treated as "not
// configured" (not as truthy garbage credentials), and that in that state
// no provider network call is ever attempted. Isolated into its own module
// because email.js resolves provider configuration once, at import time.

process.env.NODE_ENV = "test";
process.env.PUBLIC_FRONTEND_URL = "https://www.lilycrest.space";
process.env.EMAIL_USER = "   ";
process.env.EMAIL_PASSWORD = "";
process.env.SMTP_USER = "";
process.env.SMTP_PASS = "";
process.env.RESEND_API_KEY = "   ";
process.env.RESEND_FROM_EMAIL = "";

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

const { sendEmailVerificationLinkEmail } = await import("./email.js");

describe("sendEmailVerificationLinkEmail — no provider configured", () => {
  test("blank/whitespace env vars are treated as not configured and no provider is contacted", async () => {
    const result = await sendEmailVerificationLinkEmail({
      to: "someone@example.test",
      name: "Someone",
      verificationLink: "https://www.lilycrest.space/auth-action?exchange=x",
    });
    expect(result).toMatchObject({ success: false, code: "EMAIL_PROVIDER_NOT_CONFIGURED" });
    expect(result.attempts).toEqual([
      { provider: "smtp", category: "configuration", code: "EMAIL_PROVIDER_NOT_CONFIGURED" },
      { provider: "resend", category: "configuration", code: "EMAIL_PROVIDER_NOT_CONFIGURED" },
    ]);
    expect(sendMail).not.toHaveBeenCalled();
    expect(resendSend).not.toHaveBeenCalled();
  });
});
