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

export const getVerificationContext = (searchParams) => {
  const direct = searchParams.get("context");
  if (direct) return direct;
  const continueUrl = searchParams.get("continueUrl");
  if (!continueUrl) return "";
  try {
    const parsed = new URL(continueUrl);
    if (parsed.origin !== window.location.origin || parsed.pathname !== "/auth-action") return "";
    return parsed.searchParams.get("context") || "";
  } catch {
    return "";
  }
};

export const classifyFailedVerification = ({ firebaseErrorCode, accountState }) => {
  if (accountState === EMAIL_VERIFICATION_STATES.ALREADY_VERIFIED_ACCOUNT) {
    return EMAIL_VERIFICATION_STATES.ALREADY_USED_LINK_VERIFIED_USER;
  }
  if (accountState === EMAIL_VERIFICATION_STATES.USER_NOT_FOUND) {
    return EMAIL_VERIFICATION_STATES.USER_NOT_FOUND;
  }
  if (
    firebaseErrorCode === "auth/expired-action-code" &&
    accountState === EMAIL_VERIFICATION_STATES.VALID_UNUSED_LINK
  ) {
    return EMAIL_VERIFICATION_STATES.EXPIRED_LINK_UNVERIFIED_USER;
  }
  return EMAIL_VERIFICATION_STATES.INVALID_OR_TAMPERED_LINK;
};
