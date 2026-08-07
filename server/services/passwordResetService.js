// Cooldown configuration for the backend-generated password-reset email,
// mirroring the equivalent EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS
// pattern in emailVerificationService.js.
import { getPublicUrlConfig } from "../config/publicUrls.js";

const boundedInteger = (name, value, { fallback, min, max }) => {
  const configured = String(value ?? "").trim();
  if (!configured) return fallback;
  if (!/^\d+$/.test(configured)) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  const parsed = Number(configured);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return parsed;
};

export const getPasswordResetCooldownSeconds = (environment = process.env) =>
  boundedInteger(
    "PASSWORD_RESET_RESEND_COOLDOWN_SECONDS",
    environment.PASSWORD_RESET_RESEND_COOLDOWN_SECONDS,
    { fallback: 60, min: 30, max: 60 * 60 },
  );

export const PASSWORD_RESET_COOLDOWN_SECONDS = getPasswordResetCooldownSeconds();

/**
 * `firebaseAuth.generatePasswordResetLink(email, actionCodeSettings)` does
 * NOT put `actionCodeSettings.url` in the link's host. With
 * `handleCodeInApp: false`, the link Firebase actually returns is hosted on
 * whatever "Action URL" is configured for this project in the Firebase
 * Console (Authentication -> Templates) — which may be Firebase's own
 * default hosted UI, or a stale/legacy domain (e.g. a Vercel preview host)
 * if one was ever set there. `actionCodeSettings.url` only becomes the
 * `continueUrl` query parameter carried *on* that link, not the link's base
 * host. Relying on it alone to land the user on lilycrest.space is exactly
 * the mistake this function exists to avoid.
 *
 * Instead, mirror emailVerificationService.js's buildCustomEmailVerificationLink:
 * take Firebase's raw link, extract only the action parameters it actually
 * needs (mode/oobCode/apiKey/lang), and rebuild a fresh URL on our own
 * canonical EMAIL_ACTION_URL. This makes the delivered link's host correct
 * unconditionally, independent of Firebase Console configuration.
 */
export const buildCustomPasswordResetLink = (firebaseLink, environment = process.env) => {
  const { emailActionUrl } = getPublicUrlConfig(environment);
  const generated = new URL(firebaseLink);
  const handler = new URL(emailActionUrl);
  for (const name of ["mode", "oobCode", "apiKey", "lang"]) {
    const value = generated.searchParams.get(name);
    if (value) handler.searchParams.set(name, value);
  }
  return handler.toString();
};
