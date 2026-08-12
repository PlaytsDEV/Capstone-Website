import { describe, expect, test } from "@jest/globals";
import { EMAIL_TEMPLATES, describeEmailRouting, getEmailTemplateConfig, resolveSubject } from "./emailRegistry.js";
import { TEMPLATE_KEYS } from "./templateRegistry.js";

describe("emailRegistry — coverage integrity", () => {
  test("every key in templateRegistry.js has a matching subject+builder entry, and vice versa", () => {
    expect(Object.keys(EMAIL_TEMPLATES).sort()).toEqual([...TEMPLATE_KEYS].sort());
  });

  test("every registered email type has a callable inline builder — the hybrid architecture's core guarantee", () => {
    for (const key of TEMPLATE_KEYS) {
      expect(typeof getEmailTemplateConfig(key).builder).toBe("function");
    }
  });

  test("every subject resolves to a non-empty string given representative variables", () => {
    const sampleVariables = {
      BRANCH_NAME: "Gil Puyat",
      RESERVATION_CODE: "RSV-1",
      STATUS_LABEL: "Physical Visit Scheduled",
      BILL_TYPE_LABEL: "Monthly Rent",
      BILLING_MONTH: "August 2026",
      UTILITY_LABEL: "Water",
      DUE_DATE: "August 10, 2026",
      NOTICE_VARIANT: "overdue",
      AMOUNT: "4,500.00",
    };
    for (const key of TEMPLATE_KEYS) {
      const subject = resolveSubject(key, sampleVariables);
      expect(typeof subject).toBe("string");
      expect(subject.length).toBeGreaterThan(0);
    }
  });

  test("OVERDUE_NOTICE subject differs between the overdue and penalty variants", () => {
    const overdue = resolveSubject("OVERDUE_NOTICE", { BILL_TYPE_LABEL: "Rent", NOTICE_VARIANT: "overdue" });
    const penalty = resolveSubject("OVERDUE_NOTICE", { BILL_TYPE_LABEL: "Rent", NOTICE_VARIANT: "penalty" });
    expect(overdue).not.toBe(penalty);
    expect(penalty).toContain("Penalty");
  });
});

describe("describeEmailRouting", () => {
  test("reports resend_template when a template ID is configured, inline_html otherwise", () => {
    const routing = describeEmailRouting({ RESEND_TEMPLATE_PASSWORD_RESET: "tmpl_123" });
    const passwordReset = routing.find((r) => r.templateKey === "PASSWORD_RESET");
    const otp = routing.find((r) => r.templateKey === "LOGIN_OTP");
    expect(passwordReset.path).toBe("resend_template");
    expect(otp.path).toBe("inline_html");
  });

  test("never reports 'unavailable' for any current template key (every key has a builder)", () => {
    const routing = describeEmailRouting({});
    expect(routing.every((r) => r.path !== "unavailable")).toBe(true);
  });
});
