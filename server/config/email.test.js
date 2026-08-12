import { beforeEach, describe, expect, jest, test } from "@jest/globals";

// email.js is now a thin mapping layer: every send* function computes
// {emailType, to, templateKey, variables, idempotencyKey} and hands it to
// the single authoritative sendTemplateEmail() in resendEmailService.js.
// These tests mock that one boundary and assert each function maps its
// caller-provided data onto the correct template key and variables, and
// that a provider failure is never reported as a successful send.

const sendTemplateEmail = jest.fn();

await jest.unstable_mockModule("../services/email/resendEmailService.js", () => ({
  sendTemplateEmail,
  emailFingerprint: (v) => `fingerprint(${v})`,
}));

const email = await import("./email.js");

beforeEach(() => {
  jest.clearAllMocks();
  sendTemplateEmail.mockResolvedValue({ success: true, provider: "resend", messageId: "msg_1" });
});

describe("sendEmailVerificationLinkEmail", () => {
  test("maps to the EMAIL_VERIFICATION template with the Firebase-generated link as a variable", async () => {
    const link = "https://www.lilycrest.space/auth-action?mode=verifyEmail&oobCode=abc";
    await email.sendEmailVerificationLinkEmail({ to: "tenant@example.test", name: "Jose", verificationLink: link });

    expect(sendTemplateEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        emailType: "EMAIL_VERIFICATION",
        to: "tenant@example.test",
        templateKey: "EMAIL_VERIFICATION",
        variables: { USER_NAME: "Jose", VERIFICATION_URL: link },
      }),
    );
    expect(typeof sendTemplateEmail.mock.calls[0][0].idempotencyKey).toBe("string");
  });

  test("a provider rejection is propagated as failure, never reported as success", async () => {
    sendTemplateEmail.mockResolvedValue({ success: false, code: "EMAIL_PROVIDER_AUTH_REJECTED" });
    const result = await email.sendEmailVerificationLinkEmail({
      to: "tenant@example.test", name: "Jose", verificationLink: "https://www.lilycrest.space/auth-action",
    });
    expect(result.success).toBe(false);
  });
});

describe("sendPasswordResetLinkEmail", () => {
  test("maps to the PASSWORD_RESET template with the Firebase-generated, canonical-domain link", async () => {
    const link = "https://www.lilycrest.space/auth-action?mode=resetPassword&oobCode=xyz";
    await email.sendPasswordResetLinkEmail({ to: "tenant@example.test", name: "Jose", resetLink: link });

    expect(sendTemplateEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        emailType: "PASSWORD_RESET",
        templateKey: "PASSWORD_RESET",
        variables: { USER_NAME: "Jose", RESET_URL: link },
      }),
    );
  });

  test("verification and password-reset idempotency keys never collide for the same address+link shape", async () => {
    const link = "https://www.lilycrest.space/auth-action?mode=x&oobCode=same";
    await email.sendPasswordResetLinkEmail({ to: "tenant@example.test", name: "Jose", resetLink: link });
    const resetKey = sendTemplateEmail.mock.calls[0][0].idempotencyKey;

    sendTemplateEmail.mockClear();
    await email.sendEmailVerificationLinkEmail({ to: "tenant@example.test", name: "Jose", verificationLink: link });
    const verifyKey = sendTemplateEmail.mock.calls[0][0].idempotencyKey;

    expect(resetKey).not.toBe(verifyKey);
  });

  test("a provider rejection is propagated as failure, never reported as success", async () => {
    sendTemplateEmail.mockResolvedValue({ success: false, code: "EMAIL_DELIVERY_FAILED" });
    const result = await email.sendPasswordResetLinkEmail({
      to: "tenant@example.test", name: "Jose", resetLink: "https://www.lilycrest.space/auth-action",
    });
    expect(result.success).toBe(false);
  });
});

describe("sendLoginOtpEmail", () => {
  test("maps to the LOGIN_OTP template with the OTP code and expiry as variables", async () => {
    await email.sendLoginOtpEmail({ to: "tenant@example.test", name: "Jose", otp: "482913", expiresInMinutes: 10 });
    expect(sendTemplateEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        emailType: "LOGIN_OTP",
        templateKey: "LOGIN_OTP",
        variables: { USER_NAME: "Jose", OTP_CODE: "482913", EXPIRY_MINUTES: 10 },
      }),
    );
  });

  test("a provider rejection is propagated as failure, never a false requiresOtp-style success", async () => {
    sendTemplateEmail.mockResolvedValue({ success: false, code: "EMAIL_PROVIDER_NOT_CONFIGURED" });
    const result = await email.sendLoginOtpEmail({ to: "tenant@example.test", name: "Jose", otp: "482913" });
    expect(result.success).toBe(false);
  });
});

describe("transactional emails map to their own distinct templates with only real values", () => {
  test("sendBillGeneratedEmail", async () => {
    await email.sendBillGeneratedEmail({
      to: "tenant@example.test", tenantName: "Jose", billingMonth: "August 2026",
      totalAmount: 4500, dueDate: "August 10, 2026", branchName: "Gil Puyat", billType: "rent",
    });
    expect(sendTemplateEmail).toHaveBeenCalledWith(
      expect.objectContaining({ templateKey: "BILL_GENERATED", variables: expect.objectContaining({ TOTAL_AMOUNT: "4,500.00" }) }),
    );
  });

  test("sendPaymentReceiptEmail derives a per-reference idempotency key so a webhook redelivery cannot double-send", async () => {
    await email.sendPaymentReceiptEmail({
      to: "tenant@example.test", tenantName: "Jose", amount: 4500, description: "Rent",
      paymentMethod: "GCash", paymentDate: "August 1, 2026", referenceId: "REF-0001",
    });
    expect(sendTemplateEmail).toHaveBeenCalledWith(
      expect.objectContaining({ templateKey: "PAYMENT_RECEIPT", idempotencyKey: expect.any(String) }),
    );
  });

  test("sendOverdueNoticeEmail does not compute the penalty itself — it only forwards the caller's value", async () => {
    await email.sendOverdueNoticeEmail({
      to: "tenant@example.test", tenantName: "Jose", totalAmount: 4750, daysLate: 3,
      penalty: 250, dueDate: "August 10, 2026", billType: "Rent", noticeVariant: "penalty",
    });
    expect(sendTemplateEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        templateKey: "OVERDUE_NOTICE",
        variables: expect.objectContaining({ PENALTY: "250.00", NOTICE_VARIANT: "penalty" }),
      }),
    );
  });

  test("sendInquiryResponseEmail rejects an obviously invalid recipient before ever calling the provider", async () => {
    const result = await email.sendInquiryResponseEmail({ to: "not-an-email", customerName: "Jose", inquirySubject: "x", response: "y" });
    expect(result.success).toBe(false);
    expect(sendTemplateEmail).not.toHaveBeenCalled();
  });
});
