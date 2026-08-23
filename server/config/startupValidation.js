import logger from "../middleware/logger.js";
import { createCorsOriginPolicy } from "./corsPolicy.js";
import { getPublicUrlConfig } from "./publicUrls.js";
import {
  getExchangeTtlSeconds,
  getResendCooldownSeconds,
  getSessionTtlSeconds,
} from "../services/emailVerificationService.js";
import { describeEmailRouting } from "../services/email/emailRegistry.js";
import { assertServiceIsolation } from "./environmentSafety.js";

const ENV_GROUPS = Object.freeze({
  mongodb: ["MONGODB_URI"],
  firebase: [
    "FIREBASE_PROJECT_ID",
    "FIREBASE_PRIVATE_KEY_ID",
    "FIREBASE_PRIVATE_KEY",
    "FIREBASE_CLIENT_EMAIL",
    "FIREBASE_CLIENT_ID",
    "FIREBASE_CLIENT_CERT_URL",
  ],
  paymongo: ["PAYMONGO_SECRET_KEY", "PAYMONGO_WEBHOOK_SECRET"],
});

const getMissingEnv = (keys = []) =>
  keys.filter((key) => !String(process.env[key] || "").trim());

export function validateStartupConfig() {
  if (process.env.NODE_ENV === "test") {
    return;
  }

  assertServiceIsolation(process.env);

  const isProduction = process.env.NODE_ENV === "production";
  const missingByGroup = Object.fromEntries(
    Object.entries(ENV_GROUPS).map(([group, keys]) => [group, getMissingEnv(keys)]),
  );

  const hasCorsConfig = Boolean(
    String(process.env.ALLOWED_FRONTEND_ORIGINS || "").trim() ||
    String(process.env.CORS_ORIGINS || "").trim() ||
    String(process.env.FRONTEND_URL || "").trim(),
  );

  const failures = Object.entries(missingByGroup)
    .filter(([, missing]) => missing.length > 0)
    .map(([group, missing]) => `${group}: ${missing.join(", ")}`);

  // Resend is the only email provider. Every active user-facing email —
  // auth and transactional — is delivered through it, so its credentials
  // and every referenced Resend Template ID are required in production.
  const hasResendCredentials = Boolean(
    String(process.env.RESEND_API_KEY || "").trim() &&
    String(process.env.RESEND_FROM_EMAIL || "").trim(),
  );

  if (!hasResendCredentials) {
    failures.push("resend: RESEND_API_KEY and RESEND_FROM_EMAIL are required — Resend is the only email provider");
  }

  // A Resend Dashboard Template ID is an OPTIONAL, explicitly enabled
  // override, not a system requirement: every email type has a first-class
  // inline HTML builder
  // (server/services/email/builders/*.js) it falls back to when no
  // RESEND_TEMPLATE_<KEY> is set, so an unconfigured template must never be
  // startup-fatal or read as an alarming warning. This just reports, per
  // email type, which of the two content paths is currently active — useful
  // for confirming a dashboard template rollout took effect, not a defect
  // report. Only a type with NEITHER path available is a real problem.
  const routing = describeEmailRouting();
  logger.info(
    {
      emailRouting: Object.fromEntries(
        routing.map(({ templateKey, path }) => [
          templateKey,
          path === "resend_template" ? "Resend Template" : path === "inline_html" ? "Inline HTML" : "UNAVAILABLE",
        ]),
      ),
    },
    "[Email] Resend configured — routing decided per email type",
  );
  const unavailable = routing.filter((entry) => entry.path === "unavailable").map((entry) => entry.templateKey);
  if (unavailable.length > 0) {
    failures.push(
      `email: ${unavailable.join(", ")} have neither a configured Resend Template nor an inline HTML builder`,
    );
  }

  if (!String(process.env.MOBILE_OTP_SECRET || "").trim()) {
    failures.push("mobile OTP: MOBILE_OTP_SECRET");
  }

  if (!hasCorsConfig) {
    failures.push("cors: CORS_ORIGINS or FRONTEND_URL");
  }

  if (isProduction) {
    for (const name of [
      "PUBLIC_FRONTEND_URL",
      "PUBLIC_API_URL",
      "EMAIL_ACTION_URL",
      "RESERVATION_CONTINUATION_URL",
      "EMAIL_VERIFICATION_SECRET",
    ]) {
      if (!String(process.env[name] || "").trim()) failures.push(`email verification: ${name}`);
    }
    if (!String(process.env.ALLOWED_FRONTEND_ORIGINS || process.env.CORS_ORIGINS || "").trim()) {
      failures.push("cors: ALLOWED_FRONTEND_ORIGINS or CORS_ORIGINS");
    }
    for (const validate of [getResendCooldownSeconds, getExchangeTtlSeconds, getSessionTtlSeconds]) {
      try {
        validate(process.env);
      } catch (error) {
        failures.push(`email verification: ${error.message}`);
      }
    }
    try {
      getPublicUrlConfig(process.env);
    } catch (error) {
      failures.push(`public URLs: ${error.message}`);
    }
    try {
      createCorsOriginPolicy(process.env);
    } catch (error) {
      failures.push(`cors: ${error.message}`);
    }
  }

  if (failures.length === 0) {
    return;
  }

  if (isProduction) {
    throw new Error(
      `Startup validation failed. Missing required configuration -> ${failures.join(" | ")}`,
    );
  }

  logger.warn(
    { missingConfiguration: failures },
    "Startup validation warnings detected",
  );
}

export default validateStartupConfig;
