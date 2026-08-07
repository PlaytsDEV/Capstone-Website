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
  assert.match(networkBranch, /Network error/);
});

test("any other confirmPasswordReset failure (invalid/expired/used oobCode) still shows link-unavailable", () => {
  const catchBody = source.slice(
    source.indexOf("} catch (error) {"),
    source.indexOf("submitInFlightRef.current = false;\n      setSubmitting(false);\n      return;"),
  );
  assert.match(catchBody, /\} else \{\s*setStatus\("error"\);\s*setErrorMessage\("This reset link is invalid or has expired\."\);/);
});

test("double submission is blocked by a synchronous ref guard, not state alone", () => {
  assert.match(source, /const submitInFlightRef = useRef\(false\);/);
  assert.match(source, /if \(!canSubmit \|\| !oobCode \|\| submitInFlightRef\.current\) return;/);
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
