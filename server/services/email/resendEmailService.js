/**
 * The one authoritative backend email service. Every active user-facing
 * Lilycrest email — auth and transactional, web and mobile — sends through
 * `sendTemplateEmail()` below, which calls `resend.emails.send()` with a
 * published Resend Template ID and explicit variables. There is no HTML
 * built here and no SMTP/Nodemailer fallback: Resend's accept/reject
 * response is the only delivery signal.
 */
import crypto from "crypto";
import { getResendClient, getResendFromEmail, isResendConfigured } from "./resendClient.js";
import { getTemplateEnvKey, getTemplateId } from "./templateRegistry.js";

const PROVIDER_TIMEOUT_MS = 20000;

export const emailFingerprint = (value) =>
  crypto.createHash("sha256").update(String(value || "").trim().toLowerCase()).digest("hex").slice(0, 12);

export const maskEmail = (email) => {
  const [local = "", domain = ""] = String(email || "").split("@");
  if (!local || !domain) return "an email address";
  return `${local.slice(0, 1)}${"*".repeat(Math.min(Math.max(local.length - 1, 1), 4))}@${domain}`;
};

const RECIPIENT_REJECTION_PATTERN =
  /mailbox unavailable|mailbox not found|user unknown|no such user|recipient rejected|invalid recipient|address (?:not found|rejected)|does not exist|unknown user|550|551|553|5\.1\.1|5\.1\.10/i;

/**
 * Classifies a Resend error into a stable, non-enumerable internal category.
 * Never returns raw provider text — only category/code/httpStatus, safe to
 * log and safe to derive a generic user-facing message from.
 */
export const classifyResendError = (error = {}) => {
  const statusCode = Number(error?.statusCode || error?.status || error?.cause?.statusCode || 0) || null;
  const rawCode = String(error?.name || error?.code || error?.cause?.code || "");
  const text = `${rawCode} ${error?.message || ""}`.toLowerCase();

  if (RECIPIENT_REJECTION_PATTERN.test(text)) {
    return { category: "recipient_rejected", code: "EMAIL_RECIPIENT_REJECTED", statusCode };
  }
  if (/api key|invalid[_ -]?api[_ -]?key|unauthor|authenticat/.test(text)) {
    return { category: "invalid_api_key", code: "EMAIL_PROVIDER_AUTH_REJECTED", statusCode };
  }
  if (statusCode === 429 || /rate.?limit|too many/.test(text)) {
    return { category: "rate_limit", code: "EMAIL_PROVIDER_RATE_LIMITED", statusCode };
  }
  if (/timeout|timed out|abort|econnreset|etimedout/.test(text)) {
    return { category: "timeout", code: "EMAIL_PROVIDER_TIMEOUT", statusCode };
  }
  if (/econnrefused|enotfound|eai_again|network|socket/.test(text)) {
    return { category: "network", code: "EMAIL_PROVIDER_NETWORK_ERROR", statusCode };
  }
  if (/domain|sender|from address|verify/.test(text)) {
    return { category: "sender_rejection", code: "EMAIL_PROVIDER_SENDER_REJECTED", statusCode };
  }
  if ([401, 403].includes(statusCode)) {
    return { category: "invalid_api_key", code: "EMAIL_PROVIDER_AUTH_REJECTED", statusCode };
  }
  if (statusCode && statusCode >= 400) {
    return { category: "provider_rejected", code: "EMAIL_PROVIDER_REJECTED", statusCode };
  }
  return { category: "unknown", code: "EMAIL_PROVIDER_ERROR", statusCode };
};

const withTimeout = (promise, ms, onTimeout) =>
  new Promise((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      try {
        onTimeout?.();
      } catch {
        // Cancellation is best-effort; the timeout itself still applies.
      }
      const err = new Error("EMAIL_PROVIDER_TIMEOUT");
      err.code = "EMAIL_PROVIDER_TIMEOUT";
      reject(err);
    }, ms);
    Promise.resolve(promise).then(
      (value) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        reject(error);
      },
    );
  });

/**
 * Sends one email through Resend using a published Resend Template.
 *
 * @param {object} params
 * @param {string} params.emailType     Safe-to-log label, e.g. "PASSWORD_RESET".
 * @param {string|string[]} params.to   Recipient address(es).
 * @param {string} params.templateKey   Key into templateRegistry.js (e.g. "PASSWORD_RESET").
 * @param {object} [params.variables]   Template variables. Only pass values that truly exist.
 * @param {string} [params.from]        Overrides RESEND_FROM_EMAIL for this send.
 * @param {string} [params.replyTo]
 * @param {object[]} [params.tags]
 * @param {string} [params.idempotencyKey] Prevents an accidental duplicate send for the same event.
 */
export const sendTemplateEmail = async ({
  emailType,
  to,
  templateKey,
  variables = {},
  from,
  replyTo,
  tags,
  idempotencyKey,
}) => {
  if (!isResendConfigured()) {
    console.log("[Resend] email not sent — provider not configured", { emailType, templateKey });
    return { success: false, provider: "resend", category: "configuration", code: "EMAIL_PROVIDER_NOT_CONFIGURED" };
  }

  const client = getResendClient();
  const templateId = getTemplateId(templateKey);
  if (!templateId) {
    console.error("[Resend] email not sent — template not configured", {
      emailType,
      templateKey,
      envVar: getTemplateEnvKey(templateKey),
    });
    return { success: false, provider: "resend", category: "configuration", code: "EMAIL_TEMPLATE_NOT_CONFIGURED" };
  }

  const payload = {
    from: from || getResendFromEmail(),
    to: [].concat(to),
    template: { id: templateId, variables },
  };
  if (replyTo) payload.replyTo = replyTo;
  if (tags) payload.tags = tags;

  const abortController = new AbortController();
  const sendOptions = { signal: abortController.signal };
  if (idempotencyKey) sendOptions.idempotencyKey = idempotencyKey;

  try {
    const { data, error } = await withTimeout(
      client.emails.send(payload, sendOptions),
      PROVIDER_TIMEOUT_MS,
      () => abortController.abort(),
    );

    if (error) {
      const classification = classifyResendError(error);
      console.error("[Resend] email rejected", {
        emailType,
        provider: "resend",
        templateKey,
        recipientFingerprint: emailFingerprint(to),
        category: classification.category,
        code: classification.code,
        httpStatus: classification.statusCode,
      });
      return { success: false, provider: "resend", ...classification };
    }
    if (typeof data?.id !== "string" || !data.id.trim()) {
      console.error("[Resend] email send returned an unexpected response", { emailType, templateKey });
      return { success: false, provider: "resend", category: "unexpected_response", code: "EMAIL_DELIVERY_FAILED" };
    }

    console.log("[Resend] email accepted", {
      emailType,
      provider: "resend",
      templateKey,
      recipientFingerprint: emailFingerprint(to),
      messageId: data.id,
    });
    return { success: true, provider: "resend", messageId: data.id };
  } catch (error) {
    const classification = classifyResendError(error);
    console.error("[Resend] email send failed", {
      emailType,
      provider: "resend",
      templateKey,
      recipientFingerprint: emailFingerprint(to),
      category: classification.category,
      code: classification.code,
    });
    return { success: false, provider: "resend", ...classification };
  }
};

export default sendTemplateEmail;
