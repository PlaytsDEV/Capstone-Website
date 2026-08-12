/**
 * Central registry mapping every active Lilycrest email to its OPTIONAL
 * published Resend Template override. One key per email that is
 * meaningfully distinct in business purpose — not one giant generic
 * template, and not a new template per near-duplicate variant (e.g. every
 * physical-visit status change shares VISIT_STATUS; the differentiating
 * copy is passed as variables).
 *
 * None of these env vars are required: every key here also has a matching
 * inline HTML builder in emailRegistry.js that server/services/email/
 * lilycrestEmailService.js uses whenever the template ID below is unset.
 * Setting one here only overrides that one email type onto a Resend
 * Dashboard Template instead.
 *
 * Each template ID is resolved from an env var at call time (not cached at
 * import time) so tests and ops tooling can change it without a process
 * restart.
 */
const TEMPLATE_ENV_KEYS = Object.freeze({
  // Auth — Firebase Admin generates the secure link/code; Resend delivers it.
  EMAIL_VERIFICATION: "RESEND_TEMPLATE_EMAIL_VERIFICATION",
  PASSWORD_RESET: "RESEND_TEMPLATE_PASSWORD_RESET",
  LOGIN_OTP: "RESEND_TEMPLATE_LOGIN_OTP",
  PASSWORD_CHANGED: "RESEND_TEMPLATE_PASSWORD_CHANGED",

  // Tenant/applicant lifecycle transactional emails.
  INQUIRY_RESPONSE: "RESEND_TEMPLATE_INQUIRY_RESPONSE",
  RESERVATION_CONFIRMED: "RESEND_TEMPLATE_RESERVATION_CONFIRMED",
  VISIT_APPROVED: "RESEND_TEMPLATE_VISIT_APPROVED",
  VISIT_STATUS: "RESEND_TEMPLATE_VISIT_STATUS",
  DOCUMENTS_REJECTED: "RESEND_TEMPLATE_DOCUMENTS_REJECTED",

  // Billing / payments.
  BILL_GENERATED: "RESEND_TEMPLATE_BILL_GENERATED",
  UTILITY_CHARGE: "RESEND_TEMPLATE_UTILITY_CHARGE",
  PAYMENT_REMINDER: "RESEND_TEMPLATE_PAYMENT_REMINDER",
  OVERDUE_NOTICE: "RESEND_TEMPLATE_OVERDUE_NOTICE",
  PAYMENT_APPROVED: "RESEND_TEMPLATE_PAYMENT_APPROVED",
  PAYMENT_REJECTED: "RESEND_TEMPLATE_PAYMENT_REJECTED",
  PAYMENT_RECEIPT: "RESEND_TEMPLATE_PAYMENT_RECEIPT",
});

export const TEMPLATE_KEYS = Object.freeze(Object.keys(TEMPLATE_ENV_KEYS));

export const getTemplateEnvKey = (templateKey) => TEMPLATE_ENV_KEYS[templateKey] || null;

export const getTemplateId = (templateKey, environment = process.env) => {
  const envKey = TEMPLATE_ENV_KEYS[templateKey];
  if (!envKey) return null;
  return String(environment[envKey] || "").trim() || null;
};

export default TEMPLATE_ENV_KEYS;
