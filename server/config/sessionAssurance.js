export const SESSION_ASSURANCE_METHODS = Object.freeze({
  FIRST_VERIFIED_LOGIN: "first_verified_login",
  LOGIN_OTP: "login_otp",
  OAUTH: "oauth",
  ADMIN_PASSWORD: "admin_password",
});

export const SESSION_ASSURANCE_VALUES = Object.freeze(
  Object.values(SESSION_ASSURANCE_METHODS),
);

const END_USER_ROLES = new Set(["applicant", "tenant"]);
const PRIVILEGED_ROLES = new Set(["branch_admin", "owner"]);
const ALL_WEB_ROLES = new Set([...END_USER_ROLES, ...PRIVILEGED_ROLES]);

const hasValidOtpEvidence = (session) =>
  session?.otpVerifiedAt instanceof Date &&
  !Number.isNaN(session.otpVerifiedAt.getTime());

export const isSessionAuthorizedForRole = (session, role) => {
  if (!session || !ALL_WEB_ROLES.has(role)) return false;

  switch (session.assuranceMethod) {
    case SESSION_ASSURANCE_METHODS.FIRST_VERIFIED_LOGIN:
      return role === "applicant";
    case SESSION_ASSURANCE_METHODS.LOGIN_OTP:
      return END_USER_ROLES.has(role) && hasValidOtpEvidence(session);
    case SESSION_ASSURANCE_METHODS.OAUTH:
      return true;
    case SESSION_ASSURANCE_METHODS.ADMIN_PASSWORD:
      return PRIVILEGED_ROLES.has(role);
    case null:
      return END_USER_ROLES.has(role) && hasValidOtpEvidence(session);
    default:
      // Missing, malformed, misspelled, and unknown explicit assurance values
      // fail closed even if a stale OTP timestamp is present.
      return false;
  }
};
