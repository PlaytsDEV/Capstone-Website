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

test("Resume Registration has been fully removed from the sign-up page", () => {
  assert.doesNotMatch(signUp, /Resume registration/i);
  assert.doesNotMatch(signUp, /resumeAvailable/);
  assert.doesNotMatch(signUp, /handleResumeRegistration/);
  assert.doesNotMatch(signUp, /signInWithEmailAndPassword/);
});

test("a Firebase-only duplicate identity is sent to sign in, not offered a resume option", () => {
  assert.match(signUp, /auth\/email-already-in-use[\s\S]*appNavigate\("\/signin"/);
  assert.match(signUp, /An account already exists with this email address\. Please sign in instead\./);
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
