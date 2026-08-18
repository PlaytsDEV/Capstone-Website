import { beforeEach, describe, expect, jest, test } from "@jest/globals";

// Exercises the real routing decision end-to-end (registry + builders +
// Resend dispatch), mocking only the Resend SDK boundary — this is
// deliberately NOT a mock of sendTemplateEmail/sendInlineHtmlEmail, so a
// regression in the actual decision logic or in a real builder would be
// caught here.

process.env.NODE_ENV = "test";
process.env.PUBLIC_FRONTEND_URL = "https://www.lilycrest.space";
process.env.RESEND_API_KEY = "resend-test-key";
process.env.RESEND_FROM_EMAIL = "no-reply@example.test";
delete process.env.RESEND_TEMPLATE_PASSWORD_RESET;
delete process.env.RESEND_TEMPLATE_EMAIL_VERIFICATION;
delete process.env.RESEND_TEMPLATE_LOGIN_OTP;
delete process.env.RESEND_TEMPLATE_MODE;

const resendSend = jest.fn();

await jest.unstable_mockModule("resend", () => ({
  Resend: jest.fn().mockImplementation(() => ({ emails: { send: resendSend } })),
}));

const { sendLilycrestEmail } = await import("./lilycrestEmailService.js");
const { __resetResendClientCache } = await import("./resendClient.js");

beforeEach(() => {
  jest.clearAllMocks();
  __resetResendClientCache();
  resendSend.mockResolvedValue({ data: { id: "msg_1" }, error: null });
});

const RESET_URL = "https://www.lilycrest.space/auth-action?mode=resetPassword&oobCode=abc";

describe("Case 1 — template configured", () => {
  test("sends `template`, never `html`/`subject`, with the exact variables passed", async () => {
    process.env.RESEND_TEMPLATE_PASSWORD_RESET = "tmpl_password_reset";
    process.env.RESEND_TEMPLATE_MODE = "dashboard";
    const result = await sendLilycrestEmail({
      to: "tenant@example.test",
      templateKey: "PASSWORD_RESET",
      variables: { USER_NAME: "Jose", RESET_URL },
    });

    expect(result.success).toBe(true);
    const [payload] = resendSend.mock.calls[0];
    expect(payload.template).toEqual({ id: "tmpl_password_reset", variables: { USER_NAME: "Jose", RESET_URL } });
    expect(payload).not.toHaveProperty("html");
    expect(payload).not.toHaveProperty("subject");
    delete process.env.RESEND_TEMPLATE_PASSWORD_RESET;
    delete process.env.RESEND_TEMPLATE_MODE;
  });
});

describe("Case 2 — template not configured", () => {
  test("uses the inline builder, sends `html`+`subject`, never `template`", async () => {
    const result = await sendLilycrestEmail({
      to: "tenant@example.test",
      templateKey: "PASSWORD_RESET",
      variables: { USER_NAME: "Jose", RESET_URL },
    });

    expect(result.success).toBe(true);
    const [payload] = resendSend.mock.calls[0];
    expect(payload).not.toHaveProperty("template");
    expect(typeof payload.html).toBe("string");
    expect(payload.html).toContain("<!DOCTYPE html>");
    expect(payload.subject).toBe("Reset your Lilycrest password");
  });

  test("a data-dependent subject (e.g. BILL_GENERATED) is composed from the same variables the builder receives", async () => {
    await sendLilycrestEmail({
      to: "tenant@example.test",
      templateKey: "BILL_GENERATED",
      variables: {
        TENANT_NAME: "Jose", BILL_TYPE_LABEL: "Monthly Rent", ROOM_NAME: "204-A",
        BILLING_MONTH: "August 2026", TOTAL_AMOUNT: "4,500.00", DUE_DATE: "August 10, 2026", BRANCH_NAME: "Gil Puyat",
      },
    });
    const [payload] = resendSend.mock.calls[0];
    expect(payload.subject).toBe("Monthly Rent bill for August 2026 | Lilycrest Dormitory");
  });
});

describe("Case 3 — missing both a template and a builder", () => {
  test("an unknown template key fails clearly without ever calling Resend", async () => {
    const result = await sendLilycrestEmail({
      to: "tenant@example.test",
      templateKey: "NOT_A_REAL_EMAIL_TYPE",
      variables: {},
    });
    expect(result).toMatchObject({ success: false, code: "EMAIL_TYPE_UNKNOWN" });
    expect(resendSend).not.toHaveBeenCalled();
  });
});

describe("Case 4 — an invalid configured template does not trigger a second inline send", () => {
  test("Resend rejecting the configured template ID is reported as the real failure, Resend is called exactly once", async () => {
    process.env.RESEND_TEMPLATE_PASSWORD_RESET = "tmpl_that_does_not_exist";
    process.env.RESEND_TEMPLATE_MODE = "dashboard";
    resendSend.mockResolvedValue({ data: null, error: { statusCode: 422, message: "template not found" } });

    const result = await sendLilycrestEmail({
      to: "tenant@example.test",
      templateKey: "PASSWORD_RESET",
      variables: { USER_NAME: "Jose", RESET_URL },
    });

    expect(result.success).toBe(false);
    expect(resendSend).toHaveBeenCalledTimes(1);
    const [payload] = resendSend.mock.calls[0];
    expect(payload).toHaveProperty("template");
    expect(payload).not.toHaveProperty("html");
    delete process.env.RESEND_TEMPLATE_PASSWORD_RESET;
    delete process.env.RESEND_TEMPLATE_MODE;
  });
});

describe("Case 5 — variable mapping stays identical across both paths", () => {
  test("the same variables object reaches Resend for the template path", async () => {
    process.env.RESEND_TEMPLATE_LOGIN_OTP = "tmpl_login_otp";
    process.env.RESEND_TEMPLATE_MODE = "dashboard";
    await sendLilycrestEmail({
      to: "tenant@example.test",
      templateKey: "LOGIN_OTP",
      variables: { USER_NAME: "Jose", OTP_CODE: "482913", EXPIRY_MINUTES: 10 },
    });
    expect(resendSend.mock.calls[0][0].template.variables).toEqual({
      USER_NAME: "Jose", OTP_CODE: "482913", EXPIRY_MINUTES: 10,
    });
    delete process.env.RESEND_TEMPLATE_LOGIN_OTP;
    delete process.env.RESEND_TEMPLATE_MODE;
  });

  test("the inline HTML for the same email type renders the same OTP code", async () => {
    await sendLilycrestEmail({
      to: "tenant@example.test",
      templateKey: "LOGIN_OTP",
      variables: { USER_NAME: "Jose", OTP_CODE: "482913", EXPIRY_MINUTES: 10 },
    });
    expect(resendSend.mock.calls[0][0].html).toContain("482913");
  });
});

describe("Case 6 — escaping", () => {
  test("a script-injection attempt in a name field cannot produce executable markup in the rendered HTML", async () => {
    const malicious = "<script>alert('x')</script>";
    await sendLilycrestEmail({
      to: "tenant@example.test",
      templateKey: "PASSWORD_RESET",
      variables: { USER_NAME: malicious, RESET_URL },
    });
    const html = resendSend.mock.calls[0][0].html;
    expect(html).not.toContain("<script>alert('x')</script>");
    expect(html).toContain("&lt;script&gt;");
  });

  test("the same injection attempt in a billing description/reason field is also neutralized", async () => {
    await sendLilycrestEmail({
      to: "tenant@example.test",
      templateKey: "DOCUMENTS_REJECTED",
      variables: { TENANT_NAME: "Jose", REJECTION_REASON: "<img src=x onerror=alert(1)>", BRANCH_NAME: "Gil Puyat" },
    });
    const html = resendSend.mock.calls[0][0].html;
    expect(html).not.toContain("<img src=x onerror=alert(1)>");
  });
});

describe("Case 7 — URL correctness", () => {
  test("the inline password-reset email embeds exactly the RESET_URL it was given, not a fabricated domain", async () => {
    await sendLilycrestEmail({
      to: "tenant@example.test",
      templateKey: "PASSWORD_RESET",
      variables: { USER_NAME: "Jose", RESET_URL },
    });
    const html = resendSend.mock.calls[0][0].html;
    // HTML-escaped (& -> &amp;) is the correct, safe rendering of the URL —
    // browsers/mail clients resolve the entity back to the real link.
    expect(html).toContain(`href="${RESET_URL.replace(/&/g, "&amp;")}"`);
    expect(html).not.toContain("vercel.app");
    expect(html).not.toContain("localhost");
  });
});

describe("Case 8 — canonical branch personalization", () => {
  const billingVariables = (branch) => ({
    TENANT_NAME: "Jose",
    BILL_TYPE_LABEL: "Electricity",
    ROOM_NAME: "Room 202",
    BILLING_MONTH: "September 2026",
    TOTAL_AMOUNT: "7,200.00",
    DUE_DATE: "September 28, 2026",
    BRANCH_NAME: branch,
  });

  test.each([
    ["GP", "Gil Puyat Branch"],
    ["guadalupe", "Guadalupe Branch"],
    ["client supplied branch", "Lilycrest Dormitory"],
  ])("%s renders the safe subtitle %s", async (branch, expected) => {
    await sendLilycrestEmail({
      to: "tenant@example.test",
      templateKey: "BILL_GENERATED",
      variables: billingVariables(branch),
    });
    const html = resendSend.mock.calls[0][0].html;
    expect(html).toContain(expected);
    expect(html).not.toContain("LilyCrest Branch");
    expect(html).not.toMatch(/linear-gradient|radial-gradient/i);
  });

  test("the dashboard-template path receives normalized branch variables", async () => {
    process.env.RESEND_TEMPLATE_BILL_GENERATED = "tmpl_bill";
    process.env.RESEND_TEMPLATE_MODE = "dashboard";
    await sendLilycrestEmail({
      to: "tenant@example.test",
      templateKey: "BILL_GENERATED",
      variables: billingVariables("GUA"),
    });
    expect(resendSend.mock.calls[0][0].template.variables).toMatchObject({
      BRANCH_NAME: "Guadalupe",
      BRANCH_SUBTITLE: "Guadalupe Branch",
    });
    delete process.env.RESEND_TEMPLATE_BILL_GENERATED;
    delete process.env.RESEND_TEMPLATE_MODE;
  });
});

describe("routing is deterministic, never a try/fallback chain", () => {
  test("a template-configured send that fails does not fall back to an inline second send", async () => {
    process.env.RESEND_TEMPLATE_EMAIL_VERIFICATION = "tmpl_verify";
    process.env.RESEND_TEMPLATE_MODE = "dashboard";
    resendSend.mockResolvedValueOnce({ data: null, error: { statusCode: 500, message: "provider error" } });
    await sendLilycrestEmail({
      to: "tenant@example.test",
      templateKey: "EMAIL_VERIFICATION",
      variables: { USER_NAME: "Jose", VERIFICATION_URL: "https://www.lilycrest.space/auth-action?mode=verifyEmail" },
    });
    expect(resendSend).toHaveBeenCalledTimes(1);
    delete process.env.RESEND_TEMPLATE_EMAIL_VERIFICATION;
    delete process.env.RESEND_TEMPLATE_MODE;
  });
});
