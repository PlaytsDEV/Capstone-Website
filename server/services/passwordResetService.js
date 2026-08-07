// Cooldown configuration for the backend-generated password-reset email,
// mirroring the equivalent EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS
// pattern in emailVerificationService.js.

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
