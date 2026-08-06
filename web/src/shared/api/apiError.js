const firstString = (values) => values.find((value) => typeof value === "string" && value.trim()) || null;

export const getApiErrorCode = (value) => firstString([
  value?.state,
  value?.code,
  value?.error?.state,
  value?.error?.code,
  value?.data?.state,
  value?.data?.code,
  value?.data?.error?.state,
  value?.data?.error?.code,
  value?.response?.data?.state,
  value?.response?.data?.code,
  value?.response?.data?.error?.state,
  value?.response?.data?.error?.code,
]);

export const normalizeVerificationErrorCode = (value, fallback) => {
  const code = getApiErrorCode(value);
  if (["RATE_LIMITED", "RATE_LIMIT_EXCEEDED", "COOLDOWN_ACTIVE"].includes(code)) {
    return "RATE_LIMITED_OR_COOLDOWN_ACTIVE";
  }
  return code || fallback;
};

export const normalizeRetryAfterSeconds = (value, maximum = 3600) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(Math.ceil(parsed), maximum);
};

const GENERIC_RESEND_FAILURE_MESSAGE = "We could not send a new verification link right now. Please try again.";
const RATE_LIMIT_MESSAGE = "Too many requests. Please wait a few minutes.";
const WRONG_PASSWORD_MESSAGE = "Incorrect password. Please re-enter your password.";

/**
 * Pure, source-substring-free mapping from a caught resend-verification
 * error to safe, stable user-facing copy. Never names a provider (SMTP,
 * Gmail, Firebase, Resend) and never differs based on whether an arbitrary
 * account exists — only on the caller's own request outcome.
 *
 * Extracted as a standalone function (rather than left inline in a
 * component) so it can be exercised directly in tests without mounting.
 */
export const resolveResendVerificationMessage = (err) => {
  const code = normalizeVerificationErrorCode(err, "UNKNOWN");
  const firebaseCode = err?.code;

  if (code === "RATE_LIMITED_OR_COOLDOWN_ACTIVE" || firebaseCode === "auth/too-many-requests") {
    return RATE_LIMIT_MESSAGE;
  }
  if (firebaseCode === "auth/wrong-password" || firebaseCode === "auth/invalid-credential") {
    return WRONG_PASSWORD_MESSAGE;
  }

  // For every other resend outcome (provider not configured, temporarily
  // unavailable, recipient rejected, generic delivery failure, etc.), the
  // backend already picked a safe, stable, non-enumerating message — surface
  // it verbatim rather than re-deriving per-category copy on the client.
  const serverMessage = firstString([
    err?.response?.data?.message,
    err?.data?.message,
  ]);
  return serverMessage || GENERIC_RESEND_FAILURE_MESSAGE;
};
