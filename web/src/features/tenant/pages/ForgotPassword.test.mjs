import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, "ForgotPassword.jsx"), "utf8");

test("resend button triggers a real resend instead of resetting the form", () => {
  assert.match(source, /onClick=\{handleResend\}/);
  // The form-reset ("Use a different email") is a distinct, separately labeled
  // action — it must not be the handler wired to the resend button itself.
  assert.doesNotMatch(source, /onClick=\{handleResend\}[\s\S]{0,400}setEmail\(""\)/);
});

test("resend reuses the enumeration-safe Firebase reset call, not an OTP endpoint", () => {
  assert.match(source, /const handleResend = async \(\) => \{[\s\S]*requestPasswordReset\(email\)/);
  assert.doesNotMatch(source, /resendOtp|resend-otp|resendEmailVerification|email-verification\/resend/);
});

test("resend is disabled while in flight or during cooldown, and preserves the email", () => {
  assert.match(source, /disabled=\{resending \|\| resendCooldown > 0\}/);
  assert.match(source, /if \(resendInFlightRef\.current \|\| resendCooldown > 0 \|\| !email\) return;/);
});

test("resend uses a ref guard, not state alone, so a double-click before re-render cannot fire twice", () => {
  // A second click that lands before React commits the `resending` state
  // update still sees the previous render's stale `resending = false` in its
  // closure. Only a synchronously-mutated ref reliably blocks that second
  // call from ever starting a second sendPasswordResetEmail request.
  assert.match(source, /const resendInFlightRef = useRef\(false\);/);
  assert.match(source, /resendInFlightRef\.current = true;\s*setResending\(true\);/);
  assert.match(source, /resendInFlightRef\.current = false;\s*setResending\(false\);/);
});

test("switching to a different email is blocked while a resend is in flight", () => {
  assert.match(source, /disabled=\{resending\}[\s\S]{0,200}setEmailSent\(false\);/);
});

test("cooldown only starts after a confirmed send (success branch), not before the request", () => {
  const bodyOnly = source.slice(source.indexOf("const requestPasswordReset"), source.indexOf("const handleResetPassword"));
  const cooldownCalls = bodyOnly.match(/setResendCooldown\(30\)/g) || [];
  // One in the success path, one in the enumeration-safe "user-not-found" path.
  assert.equal(cooldownCalls.length, 2);
  assert.doesNotMatch(bodyOnly.slice(0, bodyOnly.indexOf("await sendPasswordResetEmail") + 1), /setResendCooldown/);
});

test("a distinct action exists to restart with a different email, separate from resend", () => {
  assert.match(source, /Use a different email/);
});

test("the reset link is built from the validated canonical app URL, not Firebase's implicit default", () => {
  // Without an explicit actionCodeSettings.url, Firebase falls back to
  // whatever's configured as the project's default action URL in the
  // Firebase Console — which is how reset links ended up pointing at a
  // Vercel deployment domain instead of the canonical production one.
  assert.match(
    source,
    /sendPasswordResetEmail\(auth, targetEmail, \{\s*url: EMAIL_ACTION_URL,\s*handleCodeInApp: false,\s*\}\)/,
  );
  assert.match(source, /import \{ EMAIL_ACTION_URL, isAppUrlConfigured \} from "\.\.\/\.\.\/\.\.\/shared\/api\/publicUrls";/);
});

test("the reset URL is never built from window/document/request state", () => {
  assert.doesNotMatch(source, /window\.location|document\.referrer|req\.headers|req\.get\(/);
});

test("an unconfigured canonical app URL blocks sending instead of silently using the wrong domain", () => {
  assert.match(
    source,
    /if \(!isAppUrlConfigured\) \{[\s\S]{0,200}return false;\s*\}/,
  );
});
