/**
 * Centralized error-message normalizer for the registration flow.
 *
 * Every backend, Axios/fetch, Firebase, and OTP/verification error that can
 * surface during sign-up funnels through here so the user only ever sees
 * plain-language copy. Raw codes/messages are logged to the console for
 * debugging but never rendered in the UI.
 */
import { getFirebaseErrorMessage } from "./authValidation.js";

const GENERIC_REGISTRATION_FAILURE =
  "We could not complete your registration. Please check your information and try again.";

/** Backend error `code` → user-facing copy. */
const BACKEND_CODE_MESSAGES = {
  VALIDATION_ERROR:
    "Some of the information you entered isn't valid. Please review the highlighted fields and try again.",
  MISSING_REQUIRED_FIELDS: "Please fill in all required fields before continuing.",
  INVALID_BRANCH: "Please choose a valid branch from the list.",
  USERNAME_TAKEN: "That username just became unavailable. Please try again.",
  EMAIL_TAKEN: "An account already exists with this email address. Please sign in instead.",
  IDENTITY_CONFLICT:
    "This account requires identity verification before it can be linked. Please use your original sign-in method or contact support.",
  USER_NOT_FOUND: "We could not find an account with those details.",
  ACCOUNT_INACTIVE: "This account is inactive. Please contact support for help.",
  EMAIL_NOT_VERIFIED: "Please verify your email address before continuing.",
  DEVICE_ID_REQUIRED: "We could not verify your device. Please refresh the page and try again.",
  OTP_REQUIRED: "Please enter the verification code that was sent to you.",
  OTP_SESSION_REQUIRED: "Your verification session has expired. Please request a new code.",
  OTP_SESSION_INVALID: "Your verification session has expired. Please request a new code.",
  OTP_EXPIRED: "This verification code has expired. Please request a new one.",
  OTP_INVALID: "That verification code is incorrect. Please check the code and try again.",
  OTP_ATTEMPTS_EXCEEDED:
    "You have entered the wrong code too many times. Please request a new one.",
  OTP_RESEND_COOLDOWN: "Please wait a moment before requesting another code.",
  OTP_EMAIL_SEND_FAILED: "We could not send the verification code. Please try again later.",
  OTP_NOT_REQUIRED: "A verification code isn't required right now.",
  VERIFICATION_EMAIL_SEND_FAILED:
    "We could not send the verification link right now. Please try again from the verification screen.",
  EMAIL_PROVIDER_NOT_CONFIGURED:
    "The verification email service is temporarily unavailable. Please try again shortly.",
  RATE_LIMIT_EXCEEDED: "You have requested too many codes. Please wait before trying again.",
  RATE_LIMITED: "You have requested too many codes. Please wait before trying again.",
};

const NETWORK_PATTERN = /network|failed to fetch|ECONNREFUSED|ECONNABORTED|ETIMEDOUT|ERR_INTERNET/i;

const getBackendCode = (error) =>
  error?.code ||
  error?.response?.data?.code ||
  error?.response?.data?.error?.code ||
  null;

/**
 * Convert any registration-flow error into safe, friendly copy.
 * @param {unknown} error - Firebase error, Error from authApi/httpClient, or plain object
 * @param {"signup"|"otp"} context - which flow the error came from, for Firebase copy
 * @returns {string} user-facing message, never containing raw codes/stack traces
 */
export function getRegistrationErrorMessage(error, context = "signup") {
  if (!error) return GENERIC_REGISTRATION_FAILURE;

  if (typeof error?.code === "string" && error.code.startsWith("auth/")) {
    return getFirebaseErrorMessage(error, context);
  }

  const backendCode = getBackendCode(error);
  if (backendCode && BACKEND_CODE_MESSAGES[backendCode]) {
    return BACKEND_CODE_MESSAGES[backendCode];
  }

  const status = error?.response?.status;
  if (status && status >= 500) {
    return "Something went wrong on our end. Please try again in a moment.";
  }

  if (
    NETWORK_PATTERN.test(error?.message || "") ||
    error?.name === "TypeError" ||
    status === 0
  ) {
    return "We could not connect to the server. Check your internet connection and try again.";
  }

  // Keep technical detail out of the UI, but not out of the console.
  if (typeof console !== "undefined" && console.warn) {
    console.warn("[registration] Unmapped error:", backendCode || error?.code, error?.message);
  }

  return GENERIC_REGISTRATION_FAILURE;
}

export default getRegistrationErrorMessage;
