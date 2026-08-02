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
const verifyEmail = read("src/features/public/pages/VerifyEmail.jsx");

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

test("Firebase-only password identities have an authenticated resume path", () => {
  assert.match(signUp, /auth\/email-already-in-use[\s\S]*setResumeAvailable\(true\)/);
  assert.match(signUp, /handleResumeRegistration[\s\S]*signInWithEmailAndPassword[\s\S]*completePasswordOnboarding/);
  assert.match(signUp, /Resume registration/);
});

test("registration retries generated username collisions without exposing owners", () => {
  assert.match(signUp, /attempt < 5[\s\S]*generateUsername\(firebaseUser\.email, attempt\)/);
  assert.match(signUp, /code !== "USERNAME_TAKEN"/);
});

test("verification delivery success and failure use truthful distinct messages", () => {
  assert.match(signUp, /Account created and verification email sent/);
  assert.match(signUp, /verification email could not be sent/);
  assert.doesNotMatch(signUp, /Account created![\s\S]{0,120}check your inbox/);
});

test("signup stores no Firebase token and prints no sensitive error object", () => {
  assert.doesNotMatch(signUp, /localStorage\.setItem\(["']authToken/);
  assert.doesNotMatch(signUp, /sessionStorage\.setItem\(["']lilycrest_pending_email/);
  assert.doesNotMatch(signUp, /console\.error/);
  assert.doesNotMatch(verifyEmail, /console\.error/);
});

test("social completion requires backend login before navigation", () => {
  assert.match(signUp, /await loginBackend\(\)[\s\S]*appNavigate\("\/applicant\/check-availability"\)/);
  assert.doesNotMatch(signUp, /await loginBackend\(\)[\s\S]{0,100}proceed anyway/);
});
