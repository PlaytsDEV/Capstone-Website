import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { generateUsername } from "../utils/authValidation.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../../..");
const read = (relative) => fs.readFileSync(path.join(webRoot, relative), "utf8");
const signUp = read("src/features/public/pages/SignUp.jsx");
const authAction = read("src/features/tenant/pages/AuthAction.jsx");

test("generated registration usernames always match the backend contract", () => {
  for (const email of [
    "a@example.test",
    `${"very-long-local-part".repeat(8)}@example.test`,
    "symbols.+unicode@example.test",
    "@example.test",
  ]) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const username = generateUsername(email, attempt);
      assert.match(username, /^[a-z0-9_-]{3,30}$/);
    }
  }
});

test("Resume Registration has no user-facing button, route, or discoverable state", () => {
  assert.doesNotMatch(signUp, /Resume registration/i);
  assert.doesNotMatch(signUp, /resumeAvailable/);
  assert.doesNotMatch(signUp, /handleResumeRegistration/);
  // signInWithEmailAndPassword is still used internally to reconcile an
  // interrupted signup, but must never be wired to a discoverable button.
  assert.doesNotMatch(signUp, /auth-btn-secondary/);
});

test("a duplicate Firebase identity is reconciled automatically, never through a resume button", () => {
  // auth/email-already-in-use routes straight into automatic reconciliation
  assert.match(signUp, /auth\/email-already-in-use[\s\S]*reconcileExistingFirebaseIdentity/);
  // reconciliation re-authenticates with the password already on the form
  assert.match(signUp, /reconcileExistingFirebaseIdentity[\s\S]*signInWithEmailAndPassword/);
  // only a backend-confirmed missing profile (an interrupted signup) is
  // auto-completed; any other outcome sends the user to sign in
  assert.match(signUp, /USER_NOT_FOUND[\s\S]*completePasswordOnboarding/);
  assert.match(signUp, /An account already exists with this email address\. Please sign in instead\./);
});

test("identity conflicts are never silently auto-completed during reconciliation", () => {
  assert.match(signUp, /IDENTITY_CONFLICT[\s\S]{0,400}identity verification/);
});

test("registration retries generated username collisions without exposing owners", () => {
  assert.match(signUp, /attempt < 5[\s\S]*generateUsername\(firebaseUser\.email, attempt\)/);
  assert.match(signUp, /code !== "USERNAME_TAKEN"/);
});

test("verification delivery success and failure use truthful distinct messages", () => {
  assert.match(signUp, /authApi\.sendEmailVerification/);
  assert.match(signUp, /auth-action\?state=sent/);
  assert.match(signUp, /auth-action\?state=send-failed/);
  assert.doesNotMatch(signUp, /Account created![\s\S]{0,120}check your inbox/);
});

test("signup stores no Firebase token and prints no sensitive error object", () => {
  assert.doesNotMatch(signUp, /localStorage\.setItem\(["']authToken/);
  assert.doesNotMatch(signUp, /sessionStorage\.setItem\(["']lilycrest_pending_email/);
  assert.doesNotMatch(signUp, /console\.error/);
  assert.doesNotMatch(authAction, /console\.error/);
});

test("social completion requires backend login before navigation", () => {
  assert.match(signUp, /await loginBackend\(\)[\s\S]*appNavigate\("\/applicant\/check-availability"\)/);
  assert.doesNotMatch(signUp, /await loginBackend\(\)[\s\S]{0,100}proceed anyway/);
});
