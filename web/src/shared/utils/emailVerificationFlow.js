export const EMAIL_VERIFICATION_STATES = Object.freeze({
  VALID_UNUSED_LINK: "VALID_UNUSED_LINK",
  EXPIRED_LINK_UNVERIFIED_USER: "EXPIRED_LINK_UNVERIFIED_USER",
  ALREADY_USED_LINK_VERIFIED_USER: "ALREADY_USED_LINK_VERIFIED_USER",
  INVALID_OR_TAMPERED_LINK: "INVALID_OR_TAMPERED_LINK",
  USER_NOT_FOUND: "USER_NOT_FOUND",
  VERIFICATION_EMAIL_RESENT: "VERIFICATION_EMAIL_RESENT",
  VERIFICATION_EMAIL_SEND_FAILED: "VERIFICATION_EMAIL_SEND_FAILED",
  ALREADY_VERIFIED_ACCOUNT: "ALREADY_VERIFIED_ACCOUNT",
  RATE_LIMITED_OR_COOLDOWN_ACTIVE: "RATE_LIMITED_OR_COOLDOWN_ACTIVE",
  RECONCILIATION_REQUIRED: "RECONCILIATION_REQUIRED",
  ACCOUNT_MISMATCH: "ACCOUNT_MISMATCH",
  AUTHENTICATION_EXPIRED: "AUTHENTICATION_EXPIRED",
});

const TRUSTED_CONTINUATIONS = new Set([
  "/signin",
  "/applicant/check-availability",
  "/applicant/reservation",
]);

export const normalizeInternalContinuation = (value) => {
  if (!value || typeof value !== "string" || /[\r\n]/.test(value)) return "/signin";
  let parsed;
  try {
    parsed = new URL(value, window.location.origin);
  } catch {
    return "/signin";
  }
  if (parsed.origin !== window.location.origin || !TRUSTED_CONTINUATIONS.has(parsed.pathname)) {
    return "/signin";
  }
  return `${parsed.pathname}${parsed.search}`;
};

export const cleanAuthActionUrl = () => {
  window.history.replaceState({}, document.title, "/auth-action");
};

export const classifyVerificationSession = ({ currentEmail, targetEmail, identityMatch = "none" }) => {
  if (["mismatch", "admin"].includes(identityMatch)) return "mismatch";
  if (identityMatch === "expired") return "expired";
  if (!currentEmail) return "none";
  if (!targetEmail) return identityMatch === "match" ? "match" : "none";
  return currentEmail.trim().toLowerCase() === targetEmail.trim().toLowerCase()
    ? "match"
    : "mismatch";
};

export const classifyFailedVerification = ({ firebaseErrorCode, accountState, identityUnconfirmed = false }) => {
  if (accountState === EMAIL_VERIFICATION_STATES.ALREADY_VERIFIED_ACCOUNT) {
    return EMAIL_VERIFICATION_STATES.ALREADY_USED_LINK_VERIFIED_USER;
  }
  if (accountState === EMAIL_VERIFICATION_STATES.USER_NOT_FOUND) {
    return EMAIL_VERIFICATION_STATES.USER_NOT_FOUND;
  }
  // Firebase's own verdict is trusted for the expired/invalid distinction even
  // without backend account-state confirmation when the custom exchange
  // capability itself failed (e.g. it expired a moment before the oobCode
  // did) — this only changes which error screen and resend affordance is
  // shown, never whether Firebase/Mongo verification state is touched.
  if (
    firebaseErrorCode === "auth/expired-action-code" &&
    (accountState === EMAIL_VERIFICATION_STATES.VALID_UNUSED_LINK || identityUnconfirmed)
  ) {
    return EMAIL_VERIFICATION_STATES.EXPIRED_LINK_UNVERIFIED_USER;
  }
  return EMAIL_VERIFICATION_STATES.INVALID_OR_TAMPERED_LINK;
};
