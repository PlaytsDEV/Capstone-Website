import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  AUTH_FLOW_STATE,
  getAuthErrorCode,
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
  assert.match(signIn, /const loginResponse = await login\(\)[\s\S]*loginResponse\?\.requiresOtp[\s\S]*setOtpPending[\s\S]*navigate\("\/verify-otp"\)/);
  assert.match(otp, /await authApi\.verifyOtp\(code\)[\s\S]*clearOtpPending\(\)[\s\S]*await refreshUser\(\)/);
  assert.doesNotMatch(otp, /await login\(\)/);
});

test("auth initialization deduplicates refreshes and recovers missing OTP sessions", () => {
  const authHook = read("src/shared/hooks/useAuth.js");
  assert.match(authHook, /profileRequestRef\.current/);
  assert.match(authHook, /if \(profileRequestRef\.current\) return profileRequestRef\.current/);
  assert.match(authHook, /if \(sessionInitializationRef\.current\) return sessionInitializationRef\.current/);
  assert.match(authHook, /getAuthErrorCode\(error\) === "OTP_SESSION_REQUIRED"[\s\S]*initializeBackendSession\(\)/);
  assert.match(authHook, /setOtpPending[\s\S]*window\.location\.replace\("\/verify-otp"\)/);
});

test("transport includes browser credentials without changing header-session security", () => {
  const api = read("src/shared/api/authApi.js");
  assert.match(api, /credentials: "include"/);
  assert.match(api, /\.\.\.getSessionHeaders\(\)/);
  assert.match(api, /Authorization: `Bearer \$\{token\}`/);
});
