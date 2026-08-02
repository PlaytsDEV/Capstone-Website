import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  AUTH_FLOW_STATE,
  getAuthErrorCode,
  isOtpDeliveryAccepted,
  shouldDeferProfileRequest,
} from "./authFlowState.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../../..");
const read = (relativePath) => fs.readFileSync(path.join(webRoot, relativePath), "utf8");

test("auth flow exposes distinct credential, OTP, expiry, and authenticated states", () => {
  assert.equal(new Set(Object.values(AUTH_FLOW_STATE)).size, 5);
  assert.notEqual(
    AUTH_FLOW_STATE.FIREBASE_CREDENTIALS_INVALID,
    AUTH_FLOW_STATE.OTP_INITIALIZATION_REQUIRED,
  );
  assert.notEqual(
    AUTH_FLOW_STATE.OTP_VERIFICATION_PENDING,
    AUTH_FLOW_STATE.OTP_SESSION_EXPIRED,
  );
});

test("standardized OTP errors are not transformed into invalid credentials", () => {
  const required = {
    response: { data: { error: { code: "OTP_SESSION_REQUIRED" } } },
  };
  const expired = {
    response: { data: { error: { code: "OTP_EXPIRED" } } },
  };
  assert.equal(getAuthErrorCode(required), "OTP_SESSION_REQUIRED");
  assert.equal(getAuthErrorCode(expired), "OTP_EXPIRED");
  assert.notEqual(getAuthErrorCode(required), "auth/invalid-credential");
});

test("OTP navigation requires an explicit accepted-delivery contract", () => {
  assert.equal(isOtpDeliveryAccepted({ requiresOtp: true, code: "OTP_REQUIRED" }), true);
  assert.equal(isOtpDeliveryAccepted({ requiresOtp: true }), false);
  assert.equal(isOtpDeliveryAccepted({ code: "OTP_REQUIRED" }), false);
  assert.equal(isOtpDeliveryAccepted({ requiresOtp: false, code: "OTP_REQUIRED" }), false);
});

test("profile requests are deferred through Firebase login and OTP verification", () => {
  assert.equal(shouldDeferProfileRequest({ firebaseUser: null }), true);
  assert.equal(shouldDeferProfileRequest({ firebaseUser: {}, loginInProgress: true }), true);
  assert.equal(shouldDeferProfileRequest({ firebaseUser: {}, otpPending: { email: "user@example.test" } }), true);
  assert.equal(shouldDeferProfileRequest({ firebaseUser: {}, loginInProgress: false, otpPending: null }), false);
});

test("email login initiates OTP and OTP completion fetches profile exactly afterward", () => {
  const signIn = read("src/features/tenant/pages/SignIn.jsx");
  const otp = read("src/features/tenant/pages/OtpVerify.jsx");
  assert.match(signIn, /setLoginInProgress\(\)[\s\S]*signInWithEmailAndPassword/);
  assert.match(signIn, /const loginResponse = await login\(\)[\s\S]*isOtpDeliveryAccepted\(loginResponse\)[\s\S]*setOtpPending[\s\S]*navigate\("\/verify-otp"\)/);
  assert.match(signIn, /OTP_EMAIL_SEND_FAILED[\s\S]*We could not send the verification code/);
  assert.match(otp, /await authApi\.verifyOtp\(code\)[\s\S]*clearOtpPending\(\)[\s\S]*await refreshUser\(\)/);
  assert.doesNotMatch(otp, /await login\(\)/);
});

test("normal applicant success clears stale OTP state and cannot be client-forced into exemption", () => {
  const signIn = read("src/features/tenant/pages/SignIn.jsx");
  const api = read("src/shared/api/authApi.js");
  assert.match(
    signIn,
    /const loginResponse = await login\(\)[\s\S]*isOtpDeliveryAccepted\(loginResponse\)[\s\S]*clearOtpPending\(\);[\s\S]*navigateAfterAuth\(loginResponse\.user/,
  );
  assert.doesNotMatch(signIn, /firstLogin|first_verified_login|exemption/i);
  assert.doesNotMatch(api, /firstLogin|first_verified_login|exemption/i);
});

test("OTP_REQUIRED remains role-agnostic for later applicants and tenants", () => {
  const signIn = read("src/features/tenant/pages/SignIn.jsx");
  assert.match(
    signIn,
    /isOtpDeliveryAccepted\(loginResponse\)[\s\S]*setOtpPending\(\)[\s\S]*navigate\("\/verify-otp"\)/,
  );
});

test("auth initialization deduplicates refreshes and recovers missing OTP sessions", () => {
  const authHook = read("src/shared/hooks/useAuth.js");
  assert.match(authHook, /profileRequestRef\.current/);
  assert.match(authHook, /if \(profileRequestRef\.current\) return profileRequestRef\.current/);
  assert.match(authHook, /if \(sessionInitializationRef\.current\) return sessionInitializationRef\.current/);
  assert.match(authHook, /getAuthErrorCode\(error\) === "OTP_SESSION_REQUIRED"[\s\S]*initializeBackendSession\(\)/);
  assert.match(authHook, /isOtpDeliveryAccepted\(loginResult\)[\s\S]*setOtpPending[\s\S]*window\.location\.replace\("\/verify-otp"\)/);
});

test("failed resend stays on verification and does not start a success cooldown", () => {
  const otp = read("src/features/tenant/pages/OtpVerify.jsx");
  assert.match(otp, /await authApi\.resendOtp\(\)[\s\S]*setResendCooldownEnd/);
  assert.match(otp, /OTP_EMAIL_SEND_FAILED[\s\S]*We could not send the verification code/);
  const failureBranch = otp.slice(otp.indexOf('errCode === "OTP_EMAIL_SEND_FAILED"'));
  assert.doesNotMatch(failureBranch.split("} else {")[0], /setResendCooldownEnd/);
  assert.doesNotMatch(failureBranch.split("} else {")[0], /navigate\(/);
});

test("transport includes browser credentials without changing header-session security", () => {
  const api = read("src/shared/api/authApi.js");
  assert.match(api, /credentials: "include"/);
  assert.match(api, /\.\.\.getSessionHeaders\(\)/);
  assert.match(api, /Authorization: `Bearer \$\{token\}`/);
});
