/**
 * The one authoritative subject + inline-builder registry, keyed by the
 * same TEMPLATE_KEYS used in templateRegistry.js (which resolves the
 * optional RESEND_TEMPLATE_* env var for each key, enabled only when
 * RESEND_TEMPLATE_MODE=dashboard). Subjects live here —
 * not scattered across controllers or builders — so there is exactly one
 * place that owns "what does this email say in the inbox list view".
 *
 * `subject` may be a plain string or a `(variables) => string` function for
 * emails whose subject line is data-dependent (e.g. BILL_GENERATED includes
 * the billing month). `builder` is the Path B inline-HTML renderer used only
 * when Dashboard mode is not explicitly enabled for that key — it MUST accept the
 * exact same variables object the Resend Template path receives.
 */
import { getTemplateEnvKey, getTemplateId, TEMPLATE_KEYS } from "./templateRegistry.js";
import {
  buildLoginOtpEmail,
  buildPasswordChangedEmail,
  buildPasswordResetEmail,
  buildVerificationEmail,
} from "./builders/authEmails.js";
import {
  buildDocumentsRejectedEmail,
  buildReservationConfirmedEmail,
  buildVisitApprovedEmail,
  buildVisitStatusEmail,
} from "./builders/reservationEmails.js";
import {
  buildBillGeneratedEmail,
  buildOverdueNoticeEmail,
  buildPaymentApprovedEmail,
  buildPaymentReceiptEmail,
  buildPaymentRejectedEmail,
  buildPaymentReminderEmail,
  buildUtilityChargeEmail,
} from "./builders/billingEmails.js";
import { buildInquiryResponseEmail } from "./builders/notificationEmails.js";

export const EMAIL_TEMPLATES = Object.freeze({
  EMAIL_VERIFICATION: { subject: "Verify your Lilycrest email", builder: buildVerificationEmail },
  PASSWORD_RESET: { subject: "Reset your Lilycrest password", builder: buildPasswordResetEmail },
  LOGIN_OTP: { subject: "Your Lilycrest login verification code", builder: buildLoginOtpEmail },
  PASSWORD_CHANGED: { subject: "Your Lilycrest password was changed", builder: buildPasswordChangedEmail },

  INQUIRY_RESPONSE: {
    subject: (v) =>
      `New reply to ${v.TICKET_ID ? `#${v.TICKET_ID}` : "your inquiry"} | Lilycrest Dormitory`,
    builder: buildInquiryResponseEmail,
  },
  RESERVATION_CONFIRMED: {
    subject: (v) => `Reservation Confirmed — ${v.RESERVATION_CODE} | Lilycrest Dormitory`,
    builder: buildReservationConfirmedEmail,
  },
  VISIT_APPROVED: {
    subject: "Visit Schedule Confirmed — Continue Your Application | Lilycrest Dormitory",
    builder: buildVisitApprovedEmail,
  },
  VISIT_STATUS: {
    subject: (v) => `${v.STATUS_LABEL} | Lilycrest Dormitory`,
    builder: buildVisitStatusEmail,
  },
  DOCUMENTS_REJECTED: {
    subject: "Action Required: Documents Need Attention — Lilycrest Dormitory",
    builder: buildDocumentsRejectedEmail,
  },

  BILL_GENERATED: {
    subject: (v) => `${v.BILL_TYPE_LABEL} bill for ${v.BILLING_MONTH} | Lilycrest Dormitory`,
    builder: buildBillGeneratedEmail,
  },
  UTILITY_CHARGE: {
    subject: (v) => `${v.UTILITY_LABEL} charge for ${v.BILLING_MONTH} | Lilycrest Dormitory`,
    builder: buildUtilityChargeEmail,
  },
  PAYMENT_REMINDER: {
    subject: (v) => `${v.BILL_TYPE_LABEL} Reminder — Due ${v.DUE_DATE} | Lilycrest Dormitory`,
    builder: buildPaymentReminderEmail,
  },
  OVERDUE_NOTICE: {
    subject: (v) =>
      v.NOTICE_VARIANT === "penalty"
        ? `Penalty Notice — ${v.BILL_TYPE_LABEL} | Lilycrest Dormitory`
        : `Overdue Notice — ${v.BILL_TYPE_LABEL} | Lilycrest Dormitory`,
    builder: buildOverdueNoticeEmail,
  },
  PAYMENT_APPROVED: {
    subject: (v) => `Payment Confirmed — ${v.BILLING_MONTH} | Lilycrest Dormitory`,
    builder: buildPaymentApprovedEmail,
  },
  PAYMENT_REJECTED: {
    subject: (v) => `Payment Proof Rejected — ${v.BILLING_MONTH} | Lilycrest Dormitory`,
    builder: buildPaymentRejectedEmail,
  },
  PAYMENT_RECEIPT: {
    subject: (v) => `Payment Receipt — ₱${v.AMOUNT} | Lilycrest Dormitory`,
    builder: buildPaymentReceiptEmail,
  },
});

// Fails fast in CI/dev, not in production, if a key drifts between the two
// registries — templateRegistry.js's env-var map and this subject/builder
// map must always cover exactly the same set of email types.
const registryKeys = new Set(TEMPLATE_KEYS);
const emailTemplateKeys = new Set(Object.keys(EMAIL_TEMPLATES));
const missingFromEmailRegistry = TEMPLATE_KEYS.filter((key) => !emailTemplateKeys.has(key));
const missingFromTemplateRegistry = Object.keys(EMAIL_TEMPLATES).filter((key) => !registryKeys.has(key));
if (missingFromEmailRegistry.length > 0 || missingFromTemplateRegistry.length > 0) {
  throw new Error(
    `templateRegistry.js and emailRegistry.js have drifted — ` +
      `missing from emailRegistry: [${missingFromEmailRegistry.join(", ")}], ` +
      `missing from templateRegistry: [${missingFromTemplateRegistry.join(", ")}]`,
  );
}

export const resolveSubject = (templateKey, variables = {}) => {
  const config = EMAIL_TEMPLATES[templateKey];
  if (!config) return null;
  return typeof config.subject === "function" ? config.subject(variables) : config.subject;
};

export const getEmailTemplateConfig = (templateKey) => EMAIL_TEMPLATES[templateKey] || null;

/**
 * Resolves, for every registered email type, which delivery path is
 * currently active — used by startup diagnostics and any future admin/QA
 * tooling. Never throws; a key with neither a configured template ID nor an
 * inline builder resolves to "unavailable" so callers can decide how loud
 * to be about it.
 */
export const describeEmailRouting = (environment = process.env) =>
  TEMPLATE_KEYS.map((key) => {
    const templateId = getTemplateId(key, environment);
    const hasBuilder = typeof EMAIL_TEMPLATES[key]?.builder === "function";
    return {
      templateKey: key,
      envKey: getTemplateEnvKey(key),
      path: templateId ? "resend_template" : hasBuilder ? "inline_html" : "unavailable",
    };
  });

export default EMAIL_TEMPLATES;
