/**
 * The single entry point every controller/service should call to send a
 * Lilycrest email. This is the only place the "Resend Dashboard Template vs
 * inline HTML" decision is made — callers never build a Resend payload
 * themselves and never choose a path themselves.
 *
 *   Application event
 *        |
 *        v
 *   sendLilycrestEmail({ to, templateKey, variables })
 *        |
 *        v
 *   Is RESEND_TEMPLATE_MODE=dashboard and the template configured?
 *        |
 *   +----+----+
 *   |         |
 *  YES        NO
 *   |         |
 *   v         v
 * Resend    Inline HTML
 * Template  builder (services/email/builders/*.js)
 *   |         |
 *   +----+----+
 *        |
 *        v
 *      Resend (resend.emails.send)
 *        |
 *        v
 *   User Inbox
 *
 * This is a configuration-based routing DECISION, not a fallback chain: a
 * configured template ID that Resend then rejects (invalid ID, revoked,
 * etc.) is reported as the real failure — it never silently retries via the
 * inline path, which would risk a duplicate send and would hide a genuine
 * infrastructure/configuration problem behind an apparent success.
 */
import { getTemplateId } from "./templateRegistry.js";
import { getEmailTemplateConfig, resolveSubject } from "./emailRegistry.js";
import { sendInlineHtmlEmail, sendTemplateEmail } from "./resendEmailService.js";
import { isResendConfigured } from "./resendClient.js";
import {
  formatBranchName,
  formatBranchSubtitle,
} from "../../utils/branchPresentation.js";

export const normalizeEmailVariables = (variables = {}) => {
  if (!Object.prototype.hasOwnProperty.call(variables, "BRANCH_NAME")) {
    return variables;
  }

  return {
    ...variables,
    BRANCH_NAME: formatBranchName(variables.BRANCH_NAME),
    BRANCH_SUBTITLE: formatBranchSubtitle(variables.BRANCH_NAME),
  };
};

/**
 * @param {object} params
 * @param {string|string[]} params.to
 * @param {string} params.templateKey    Key shared by templateRegistry.js and emailRegistry.js.
 * @param {object} [params.variables]    Same variables shape for both the template and inline paths.
 * @param {string} [params.subject]      Overrides the registry's subject (rarely needed — prefer editing emailRegistry.js).
 * @param {string} [params.from]
 * @param {string} [params.replyTo]
 * @param {object[]} [params.tags]
 * @param {string} [params.idempotencyKey]
 */
export const sendLilycrestEmail = async ({
  to,
  templateKey,
  variables = {},
  subject,
  from,
  replyTo,
  tags,
  idempotencyKey,
}) => {
  const config = getEmailTemplateConfig(templateKey);
  if (!config) {
    console.error("[Email] Unknown email type — no registry entry", { templateKey });
    return { success: false, provider: "resend", category: "configuration", code: "EMAIL_TYPE_UNKNOWN" };
  }

  if (!isResendConfigured()) {
    console.log("[Email] not sent — Resend provider not configured", { templateKey });
    return { success: false, provider: "resend", category: "configuration", code: "EMAIL_PROVIDER_NOT_CONFIGURED" };
  }

  const normalizedVariables = normalizeEmailVariables(variables);

  const templateId = getTemplateId(templateKey);

  // Path A — Resend Dashboard Template explicitly enabled and configured.
  // Deterministic: no
  // try/catch fallback to the inline path on failure (see module docblock).
  if (templateId) {
    console.log("[Email] routing via Resend Dashboard Template", { templateKey });
    return sendTemplateEmail({
      emailType: templateKey,
      to,
      templateKey,
      variables: normalizedVariables,
      from,
      replyTo,
      tags,
      idempotencyKey,
    });
  }

  // Path B — no template ID configured. Inline HTML is a first-class path,
  // not a degraded one: this must be able to deliver every supported email
  // with zero RESEND_TEMPLATE_* variables set.
  if (typeof config.builder !== "function") {
    console.error("[Email] not sent — no Resend template configured and no inline builder available", { templateKey });
    return { success: false, provider: "resend", category: "configuration", code: "EMAIL_RENDERER_NOT_CONFIGURED" };
  }

  console.log("[Email] routing via inline HTML builder", { templateKey });
  const html = config.builder(normalizedVariables);
  const resolvedSubject = subject || resolveSubject(templateKey, normalizedVariables) || "Lilycrest Dormitory";

  return sendInlineHtmlEmail({
    emailType: templateKey,
    templateKey,
    to,
    subject: resolvedSubject,
    html,
    from,
    replyTo,
    tags,
    idempotencyKey,
  });
};

export default sendLilycrestEmail;
