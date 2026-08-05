export const AUTH_FLOW_STATE = Object.freeze({
  FIREBASE_CREDENTIALS_INVALID: "firebase-credentials-invalid",
  OTP_INITIALIZATION_REQUIRED: "otp-initialization-required",
  OTP_VERIFICATION_PENDING: "otp-verification-pending",
  OTP_SESSION_EXPIRED: "otp-session-expired",
  AUTHENTICATED: "authenticated",
});

export const getAuthErrorCode = getApiErrorCode;

export const isOtpDeliveryAccepted = (response) =>
  response?.requiresOtp === true && response?.code === "OTP_REQUIRED";

export const shouldDeferProfileRequest = ({
  firebaseUser,
  loginInProgress,
  otpPending,
}) => !firebaseUser || loginInProgress || Boolean(otpPending);
import { getApiErrorCode } from "./apiError.js";
