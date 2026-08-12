import { afterEach, beforeEach, describe, expect, test } from "@jest/globals";
import { validateStartupConfig } from "./startupValidation.js";
import { TEMPLATE_KEYS, getTemplateEnvKey } from "../services/email/templateRegistry.js";

const originalEnvironment = { ...process.env };

const resendTemplateEnvironment = Object.fromEntries(
  TEMPLATE_KEYS.map((key) => [getTemplateEnvKey(key), `tmpl_${key.toLowerCase()}`]),
);

const validProductionEnvironment = {
  NODE_ENV: "production",
  MONGODB_URI: "mongodb://example.test/lilycrest",
  FIREBASE_PROJECT_ID: "project",
  FIREBASE_PRIVATE_KEY_ID: "key-id",
  FIREBASE_PRIVATE_KEY: "private-key",
  FIREBASE_CLIENT_EMAIL: "firebase@example.test",
  FIREBASE_CLIENT_ID: "client-id",
  FIREBASE_CLIENT_CERT_URL: "https://example.test/cert",
  PAYMONGO_SECRET_KEY: "paymongo-secret",
  PAYMONGO_WEBHOOK_SECRET: "webhook-secret",
  RESEND_API_KEY: "resend-key",
  RESEND_FROM_EMAIL: "sender@example.test",
  ...resendTemplateEnvironment,
  MOBILE_OTP_SECRET: "mobile-secret",
  PUBLIC_FRONTEND_URL: "https://www.lilycrest.space",
  PUBLIC_API_URL: "https://api.lilycrest.space",
  EMAIL_ACTION_URL: "https://www.lilycrest.space/auth-action",
  RESERVATION_CONTINUATION_URL: "https://www.lilycrest.space/applicant/check-availability",
  EMAIL_VERIFICATION_SECRET: "verification-secret",
  ALLOWED_FRONTEND_ORIGINS: "https://www.lilycrest.space",
};

beforeEach(() => Object.assign(process.env, validProductionEnvironment));
afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, originalEnvironment);
});

describe("production startup validation", () => {
  test("accepts the complete email-verification configuration gate", () => {
    expect(() => validateStartupConfig()).not.toThrow();
  });

  test("rejects a missing email-verification secret", () => {
    delete process.env.EMAIL_VERIFICATION_SECRET;
    expect(() => validateStartupConfig()).toThrow(/EMAIL_VERIFICATION_SECRET/);
  });

  test("rejects invalid optional verification TTL configuration", () => {
    process.env.EMAIL_VERIFICATION_CONTEXT_TTL_SECONDS = "not-a-number";
    expect(() => validateStartupConfig()).toThrow(/EMAIL_VERIFICATION_CONTEXT_TTL_SECONDS must be an integer between 300 and 86400/);
  });

  test("rejects missing RESEND_API_KEY/RESEND_FROM_EMAIL — Resend is the only email provider", () => {
    delete process.env.RESEND_API_KEY;
    expect(() => validateStartupConfig()).toThrow(/RESEND_API_KEY and RESEND_FROM_EMAIL are required/);
  });

  test("rejects a missing Resend template ID", () => {
    delete process.env.RESEND_TEMPLATE_PASSWORD_RESET;
    expect(() => validateStartupConfig()).toThrow(/RESEND_TEMPLATE_PASSWORD_RESET/);
  });
});
