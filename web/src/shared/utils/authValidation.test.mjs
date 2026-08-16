import assert from "node:assert/strict";
import test from "node:test";
import {
  validateEmail,
  validatePassword,
  getFirebaseErrorMessage,
  evaluatePasswordRules,
  calculatePasswordStrength,
} from "./authValidation.js";

test("validateEmail gives plain-language guidance, not technical jargon", () => {
  assert.equal(validateEmail(""), "Email address is required");
  assert.match(validateEmail("not-an-email"), /valid email address/i);
  assert.doesNotMatch(validateEmail("not-an-email") || "", /regex|format|domain/i);
  assert.equal(validateEmail("name@example.com"), null);
});

test("validatePassword explains what's missing in plain language", () => {
  assert.equal(validatePassword(""), "Password is required");
  assert.match(validatePassword("short"), /at least 8 characters/i);
  assert.equal(validatePassword("Str0ng!Pass"), null);
});

test("evaluatePasswordRules tests all 6 requirements accurately", () => {
  const empty = evaluatePasswordRules("");
  assert.equal(empty.allPassed, false);

  const partial = evaluatePasswordRules("Pass1234");
  assert.equal(partial.allPassed, false);
  const specialRule = partial.results.find((r) => r.id === "special");
  assert.equal(specialRule.passed, false);

  const full = evaluatePasswordRules("Str0ng!Pass2026");
  assert.equal(full.allPassed, true);
  assert.equal(full.results.every((r) => r.passed), true);

  const withSpaces = evaluatePasswordRules("Str0ng! Pass");
  const spaceRule = withSpaces.results.find((r) => r.id === "no-spaces");
  assert.equal(spaceRule.passed, false);
  assert.equal(withSpaces.allPassed, false);
});

test("calculatePasswordStrength calculates tiers and labels appropriately", () => {
  assert.equal(calculatePasswordStrength("").score, 0);
  assert.equal(calculatePasswordStrength("abc").level, "weak");
  assert.equal(calculatePasswordStrength("Password123").level, "medium");
  assert.equal(calculatePasswordStrength("P@ssw0rd2026!").level, "strong");
});

test("getFirebaseErrorMessage never leaks raw backend text on unmapped codes", () => {
  const error = { code: "auth/some-unmapped-future-code", response: { data: { error: "Internal: uid=abc123 stack" } } };
  const message = getFirebaseErrorMessage(error, "signup");
  assert.doesNotMatch(message, /uid=|stack|Internal:/);
  assert.match(message, /could not complete your registration/i);
});

test("getFirebaseErrorMessage maps duplicate-email signup to a sign-in prompt", () => {
  const message = getFirebaseErrorMessage({ code: "auth/email-already-in-use" }, "signup");
  assert.match(message, /already exists/i);
  assert.match(message, /sign in/i);
});
