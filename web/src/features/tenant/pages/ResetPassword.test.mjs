import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, "ResetPassword.jsx"), "utf8");

// Regression coverage for: submitting a new password could show "Reset link
// unavailable" even though Firebase had already changed the password,
// because the whole non-critical cleanup chain (transient sign-in, backend
// finalize call, sign-out) was wrapped in the same try/catch as the actual
// confirmPasswordReset() call. Any failure in that chain — a network blip,
// a rate limit on /finalize-password-reset, anything — got misclassified
// as an invalid/expired reset link.

test("success is committed immediately after confirmPasswordReset resolves, before any follow-up call", () => {
  const confirmIndex = source.indexOf("await confirmPasswordReset(auth, oobCode, password);");
  assert.ok(confirmIndex > -1, "expected the confirmPasswordReset call");
  const successIndex = source.indexOf('setStatus("success");');
  assert.ok(successIndex > -1, "expected a setStatus(\"success\") call");
  assert.ok(successIndex > confirmIndex, "success must be set after confirmPasswordReset resolves");

  const signInIndex = source.indexOf("await signInWithEmailAndPassword(auth, email, password);");
  assert.ok(signInIndex > -1, "expected the transient sign-in used to obtain a fresh ID token");
  assert.ok(
    successIndex < signInIndex,
    "success must be committed BEFORE the follow-up sign-in/finalize/sign-out chain runs, " +
      "so a failure in that chain cannot downgrade an already-successful reset",
  );
});

test("confirmPasswordReset and the follow-up cleanup chain are in separate try/catch blocks", () => {
  // The bug was a single try/catch spanning both confirmPasswordReset() and
  // the sign-in/finalizePasswordReset/signOut chain. The fix must have two
  // independent catches: one for the reset call itself, one for cleanup.
  const catchBlocks = source.match(/\}\s*catch\b/g) || [];
  assert.ok(catchBlocks.length >= 2, "expected at least two separate catch blocks in the file");

  // The cleanup-chain catch must not set status to "error" or show the
  // "invalid or expired" message — it must be a silent, non-critical catch.
  const cleanupCatchMatch = source.match(
    /await signInWithEmailAndPassword\(auth, email, password\);[\s\S]*?\}\s*catch\s*\{([\s\S]*?)\}\s*finally/,
  );
  assert.ok(cleanupCatchMatch, "expected a catch block immediately following the cleanup chain");
  assert.doesNotMatch(cleanupCatchMatch[1], /setStatus\("error"\)/);
  assert.doesNotMatch(cleanupCatchMatch[1], /invalid or has expired/);
});

test("a weak-password rejection from confirmPasswordReset keeps the form up instead of showing link-unavailable", () => {
  assert.match(source, /error\?\.code === "auth\/weak-password"/);
  const weakPasswordBranch = source.slice(
    source.indexOf('error?.code === "auth/weak-password"'),
    source.indexOf('error?.code === "auth/network-request-failed"'),
  );
  assert.doesNotMatch(weakPasswordBranch, /setStatus\("error"\)/);
});

test("a network failure from confirmPasswordReset is retryable, not classified as an expired link", () => {
  assert.match(source, /error\?\.code === "auth\/network-request-failed"/);
  const networkBranch = source.slice(
    source.indexOf('error?.code === "auth/network-request-failed"'),
    source.indexOf("} else {", source.indexOf('error?.code === "auth/network-request-failed"')),
  );
  assert.doesNotMatch(networkBranch, /setStatus\("error"\)/);
  assert.match(networkBranch, /Check your connection/);
});

test("action-code failures are classified without leaking Firebase errors", () => {
  const catchBody = source.slice(
    source.indexOf("} catch (error) {"),
    source.indexOf("submitInFlightRef.current = false;\n      setSubmitting(false);\n      return;"),
  );
  assert.match(catchBody, /setStatus\(classifyResetActionError\(error\)\)/);
  assert.match(source, /auth\/expired-action-code/);
  assert.match(source, /auth\/invalid-action-code/);
  assert.match(source, /already been used or is no longer valid/);
  assert.match(source, /reset link has expired/);
});

test("the form is only rendered for the verified ready state", () => {
  assert.match(source, /status === "ready" && \(/);
  assert.match(source, /verifyPasswordResetCode\(auth, oobCode\)[\s\S]*setStatus\("ready"\)/);
  assert.match(source, /status !== "ready" \|\| !currentPasswordValid/);
});

test("the visible checklist has five rows and hidden rules still gate submission", () => {
  assert.match(source, /PASSWORD_RULES\.map/);
  assert.match(source, /evaluateNewPassword\(password\)\.valid/);
  assert.doesNotMatch(source, /label:\s*"No spaces/);
  assert.match(source, /maxLength=\{NEW_PASSWORD_MAX_LENGTH\}/);
});

test("double submission is blocked by a synchronous ref guard, not state alone", () => {
  assert.match(source, /const submitInFlightRef = useRef\(false\);/);
  assert.match(source, /status !== "ready"[\s\S]{0,180}submitInFlightRef\.current\) return;/);
  assert.match(source, /submitInFlightRef\.current = true;\s*setSubmitting\(true\);/);
});

test("the resendInProgress guard around the transient sign-in is preserved", () => {
  // Prevents the well-known reset-page redirect race: useAuth's
  // onAuthStateChanged effect and RequireNonAdmin must both skip acting on
  // this transient sign-in.
  assert.match(source, /sessionStorage\.setItem\("resendInProgress", "1"\)/);
  assert.match(source, /sessionStorage\.removeItem\("resendInProgress"\)/);
});

test("the reset code is only ever validated once (no re-validation after submit)", () => {
  const occurrences = source.match(/verifyPasswordResetCode\(/g) || [];
  assert.equal(occurrences.length, 1, "verifyPasswordResetCode must only be called from the initial mount effect");
});

// Regression coverage for: a browser tab that already had an established
// Lilycrest session (SESSION_ESTABLISHED_KEY, sessionStorage) before the
// user ran Forgot Password kept that marker through a successful reset,
// because this flow signs in/out via raw Firebase calls rather than the
// app's authApi.logout() helper (which already clears it on a normal
// sign-out). useAuth's checkAuth() treats a still-set marker as "just
// restore the existing session" and skips the OTP-gated /login call
// entirely — so the very next sign-in, even with the brand-new password,
// silently skipped OTP.

test("clearApplicationSession is imported from the same module authApi.logout() uses", () => {
  assert.match(
    source,
    /import \{ clearApplicationSession \} from "\.\.\/\.\.\/\.\.\/shared\/api\/authSession";/,
  );
});

test("clearApplicationSession is called as part of the success transition, before the transient sign-in", () => {
  const successIndex = source.indexOf('setStatus("success");');
  const clearIndex = source.indexOf("clearApplicationSession();");
  const signInIndex = source.indexOf("await signInWithEmailAndPassword(auth, email, password);");
  assert.ok(clearIndex > -1, "expected a clearApplicationSession() call");
  assert.ok(
    clearIndex > successIndex && clearIndex < signInIndex,
    "clearApplicationSession() must run as part of the success transition, before the transient " +
      "sign-in/finalize/sign-out chain — it must not depend on that chain succeeding",
  );
});

test("clearApplicationSession is unconditional — not inside the try/catch around the transient sign-in", () => {
  const clearIndex = source.indexOf("clearApplicationSession();");
  const tryIndex = source.indexOf("sessionStorage.setItem(\"resendInProgress\", \"1\");");
  assert.ok(clearIndex < tryIndex, "clearApplicationSession() must run before entering the best-effort cleanup try block");
});

test("reset password container is centered vertically and horizontally matching SignUp", () => {
  assert.match(
    source,
    /<div className="flex items-center justify-center p-8 lg:p-12 bg-white overflow-y-auto">\s*<div className="w-full max-w-md my-auto">/,
    "ResetPassword right-hand container must use items-center with an inner my-auto card to match SignUp centering",
  );
  assert.doesNotMatch(
    source,
    /items-start/,
    "ResetPassword must not be top-aligned with items-start",
  );
});

test("welcome landing flow is supported with specialized copy and branding", () => {
  assert.match(
    source,
    /const isWelcomeFlow = searchParams\.get\("type"\) === "welcome";/,
    "must inspect searchParams for type === 'welcome'",
  );
  assert.match(source, /isWelcomeFlow \? "Welcome to<br\/>Lilycrest" : "Create A<br\/>New Password"/);
  assert.match(source, /isWelcomeFlow \? "Set up your account password" : "Secure your Lilycrest account"/);
  assert.match(source, /isWelcomeFlow \? "Set up your password" : "Reset password"/);
  assert.match(source, /isWelcomeFlow\s*\?\s*`Welcome to Lilycrest! Choose a secure password for \$\{email \|\| "your account"\}\.`/);
  assert.match(source, /isWelcomeFlow \? "Setting up\.\.\." : "Updating\.\.\."/);
  assert.match(source, /isWelcomeFlow \? "Set Password & Continue" : "Reset password"/);
  assert.match(source, /isWelcomeFlow \? "Password established successfully\." : "Password reset successfully\."/);
});

