export const SESSION_ASSURANCE_METHODS = Object.freeze({
  FIRST_VERIFIED_LOGIN: "first_verified_login",
  LOGIN_OTP: "login_otp",
  OAUTH: "oauth",
  ADMIN_PASSWORD: "admin_password",
});

export const SESSION_ASSURANCE_VALUES = Object.freeze(
  Object.values(SESSION_ASSURANCE_METHODS),
);

export const isSessionAuthorizedForRole = (session, role) => {
  if (!session) return false;
  if (session.otpVerifiedAt) return true;
  if (session.assuranceMethod === SESSION_ASSURANCE_METHODS.OAUTH) return true;
  return (
    role === "applicant" &&
    session.assuranceMethod === SESSION_ASSURANCE_METHODS.FIRST_VERIFIED_LOGIN
  );
};
