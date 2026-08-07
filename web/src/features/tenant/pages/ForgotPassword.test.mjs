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

test("resend calls the backend password-reset request, not an OTP endpoint", () => {
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
  // call from ever starting a second requestPasswordReset call.
  assert.match(source, /const resendInFlightRef = useRef\(false\);/);
  assert.match(source, /resendInFlightRef\.current = true;\s*setResending\(true\);/);
  assert.match(source, /resendInFlightRef\.current = false;\s*setResending\(false\);/);
});

test("switching to a different email is blocked while a resend is in flight", () => {
  assert.match(source, /disabled=\{resending\}[\s\S]{0,200}setEmailSent\(false\);/);
});

test("cooldown only starts after a confirmed response, not before the request", () => {
  const bodyOnly = source.slice(source.indexOf("const requestPasswordReset"), source.indexOf("const handleResetPassword"));
  const cooldownCalls = bodyOnly.match(/setResendCooldown\(30\)/g) || [];
  // The backend response is uniform/enumeration-safe (see
  // passwordResetController.js), so there is now exactly one success path
  // and therefore exactly one place the cooldown starts.
  assert.equal(cooldownCalls.length, 1);
  assert.doesNotMatch(
    bodyOnly.slice(0, bodyOnly.indexOf("await authApi.requestPasswordReset") + 1),
    /setResendCooldown/,
  );
});

test("a distinct action exists to restart with a different email, separate from resend", () => {
  assert.match(source, /Use a different email/);
});

test("password reset is requested through the backend API, not Firebase's client SDK directly", () => {
  // The backend now generates the Firebase Admin reset link and sends a
  // Lilycrest-branded email through the same SMTP/Resend pipeline as email
  // verification (see server/controllers/passwordResetController.js and
  // server/config/email.js's sendPasswordResetLinkEmail), instead of
  // Firebase's client SDK emailing its own generic-branded template.
  assert.match(source, /await authApi\.requestPasswordReset\(targetEmail\)/);
  assert.match(source, /import \{ authApi \} from "\.\.\/\.\.\/\.\.\/shared\/api\/authApi";/);
  assert.doesNotMatch(source, /sendPasswordResetEmail|from "firebase\/auth"/);
});

test("no distinct user-not-found branch remains — the backend response is already enumeration-safe", () => {
  assert.doesNotMatch(source, /auth\/user-not-found/);
});

test("the reset URL is never built from window/document/request state", () => {
  assert.doesNotMatch(source, /window\.location|document\.referrer|req\.headers|req\.get\(/);
});

test("a backend validation failure (malformed email) is shown distinctly from a generic delivery failure", () => {
  assert.match(source, /error\?\.response\?\.status === 400/);
});

test("cooldown timer is persisted to localStorage and synchronized with server pre-flight status", () => {
  assert.match(source, /localStorage\.setItem\(storageKey, endTime\.toString\(\)\)/);
  assert.match(source, /localStorage\.getItem\(key\)/);
  assert.match(source, /if \(preflightRes\.status === 429\)/);
});
