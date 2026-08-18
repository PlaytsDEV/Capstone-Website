import { EMAIL_TEMPLATES } from "./emailRegistry.js";
import { THEME } from "./emailLayout.js";

describe("Email Builders Layout & Standardization Tests", () => {
  const sampleVariables = {
    EMAIL_VERIFICATION: {
      USER_NAME: "Juan Dela Cruz",
      VERIFICATION_URL: "https://lilycrestdms.com/verify?token=abc123xyz",
    },
    PASSWORD_RESET: {
      USER_NAME: "Juan Dela Cruz",
      RESET_URL: "https://lilycrestdms.com/reset?token=reset123",
    },
    LOGIN_OTP: {
      USER_NAME: "Juan Dela Cruz",
      OTP_CODE: "123456",
      EXPIRY_MINUTES: 10,
    },
    PASSWORD_CHANGED: {
      USER_NAME: "Juan Dela Cruz",
      TIMESTAMP: "August 17, 2026 6:30 PM",
      IP_ADDRESS: "192.168.1.1",
    },
    INQUIRY_RESPONSE: {
      CUSTOMER_NAME: "Maria Santos",
      INQUIRY_SUBJECT: "Available Rooms",
      RESPONSE: "Yes, we have 2-bed and 4-bed options currently available.",
      BRANCH_NAME: "Main Branch",
    },
    RESERVATION_CONFIRMED: {
      TENANT_NAME: "Juan Dela Cruz",
      RESERVATION_CODE: "RES-2026-001",
      ROOM_NAME: "Room 204 - Bed A",
      BRANCH_NAME: "Main Branch",
      MOVE_IN_DATE: "September 1, 2026",
    },
    VISIT_APPROVED: {
      TENANT_NAME: "Juan Dela Cruz",
      BRANCH_NAME: "Main Branch",
    },
    VISIT_STATUS: {
      TENANT_NAME: "Juan Dela Cruz",
      ROOM_NAME: "Room 204",
      BRANCH_NAME: "Main Branch",
      VISIT_CODE: "VST-1234",
      VISIT_SCHEDULE: "August 20, 2026 at 2:00 PM",
      PREVIOUS_SCHEDULE: "August 18, 2026 at 10:00 AM",
      REMARKS: "Rescheduled upon applicant request.",
      STATUS_LABEL: "Visit Rescheduled",
      STATUS_INTRO: "Your physical visit schedule has been updated.",
      NEXT_STEP: "Please visit the branch on your updated schedule.",
    },
    DOCUMENTS_REJECTED: {
      TENANT_NAME: "Juan Dela Cruz",
      REJECTION_REASON: "Government ID photo is blurry and illegible.",
      BRANCH_NAME: "Main Branch",
    },
    BILL_GENERATED: {
      TENANT_NAME: "Juan Dela Cruz",
      BILL_TYPE_LABEL: "Monthly Rent",
      ROOM_NAME: "Room 204 - Bed A",
      BILLING_MONTH: "August 2026",
      TOTAL_AMOUNT: "4,500.00",
      DUE_DATE: "August 25, 2026",
      BRANCH_NAME: "Main Branch",
    },
    UTILITY_CHARGE: {
      TENANT_NAME: "Juan Dela Cruz",
      UTILITY_LABEL: "Electricity",
      BILLING_MONTH: "August 2026",
      UTILITY_AMOUNT: "650.00",
      TOTAL_AMOUNT: "5,150.00",
      DUE_DATE: "August 25, 2026",
      BRANCH_NAME: "Main Branch",
    },
    PAYMENT_REMINDER: {
      TENANT_NAME: "Juan Dela Cruz",
      BILL_TYPE_LABEL: "Monthly Rent",
      TOTAL_AMOUNT: "4,500.00",
      DUE_DATE: "August 25, 2026",
      BRANCH_NAME: "Main Branch",
    },
    OVERDUE_NOTICE: {
      TENANT_NAME: "Juan Dela Cruz",
      BILL_TYPE_LABEL: "Monthly Rent",
      DAYS_LATE: "5",
      TOTAL_AMOUNT: "4,700.00",
      PENALTY: "200.00",
      DUE_DATE: "August 12, 2026",
      REASON: "Unpaid rent past grace period",
      NOTICE_VARIANT: "overdue",
      BRANCH_NAME: "Main Branch",
    },
    PAYMENT_APPROVED: {
      TENANT_NAME: "Juan Dela Cruz",
      BILLING_MONTH: "August 2026",
      PAID_AMOUNT: "4,500.00",
      BRANCH_NAME: "Main Branch",
    },
    PAYMENT_REJECTED: {
      TENANT_NAME: "Juan Dela Cruz",
      BILLING_MONTH: "August 2026",
      REJECTION_REASON: "Transaction reference number did not match bank statement.",
      BRANCH_NAME: "Main Branch",
    },
    PAYMENT_RECEIPT: {
      TENANT_NAME: "Juan Dela Cruz",
      AMOUNT: "4,500.00",
      DESCRIPTION: "Monthly Rent - August 2026",
      BILLED_TO: "Juan Dela Cruz",
      PAYMENT_METHOD: "GCash / PayMongo",
      PAYMENT_DATE: "August 17, 2026",
      REFERENCE_NUMBER: "PAY-2026-9876",
      RESERVATION_CODE: "RES-2026-001",
      ROOM_NAME: "Room 204 - Bed A",
      BRANCH_NAME: "Main Branch",
    },
  };

  test("Every registered email template has an active builder function", () => {
    Object.entries(EMAIL_TEMPLATES).forEach(([key, config]) => {
      expect(typeof config.builder).toBe("function");
    });
  });

  test("All email builders generate valid HTML with unified Lilycrest layout and theme tokens", () => {
    Object.entries(EMAIL_TEMPLATES).forEach(([key, config]) => {
      const vars = sampleVariables[key] || {};
      const html = config.builder(vars);

      // Structure checks
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("Lilycrest Dormitory");
      expect(html).toContain("Automated service email");
      expect(html).toContain("© " + new Date().getFullYear() + " Lilycrest Dormitory");

      // Brand token checks
      expect(html).toContain(THEME.navy);
      expect(html).toContain(THEME.gold);
      expect(html).toContain('alt="Lilycrest Dormitory logo"');
      expect(html).not.toMatch(/linear-gradient|radial-gradient/i);
    });
  });

  test("Builders properly sanitize inputs to prevent HTML injection", () => {
    const maliciousName = "<script>alert('XSS')</script>Juan";
    const vars = {
      ...sampleVariables.BILL_GENERATED,
      TENANT_NAME: maliciousName,
    };
    const html = EMAIL_TEMPLATES.BILL_GENERATED.builder(vars);

    expect(html).not.toContain("<script>alert('XSS')</script>");
    expect(html).toContain("&lt;script&gt;alert(&#39;XSS&#39;)&lt;/script&gt;Juan");
  });
});
