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
  assert.match(source, /if \(resending \|\| resendCooldown > 0 \|\| !email\) return;/);
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
