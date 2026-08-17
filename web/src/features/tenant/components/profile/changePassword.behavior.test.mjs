import assert from "node:assert/strict";
import test from "node:test";
import {
  PASSWORD_RULES,
  evaluatePasswordRules,
  calculatePasswordStrength,
  getFirebaseErrorMessage,
} from "../../../../shared/utils/authValidation.js";

test("PASSWORD_RULES contains exactly the five visible security criteria", () => {
  assert.equal(PASSWORD_RULES.length, 5);
  const ids = PASSWORD_RULES.map((r) => r.id);
  assert.deepEqual(ids, ["length", "uppercase", "lowercase", "number", "special"]);
});

test("evaluatePasswordRules verifies length rule (>= 8 characters)", () => {
  const short = evaluatePasswordRules("Ab1!");
  const lengthRule = short.results.find((r) => r.id === "length");
  assert.equal(lengthRule.passed, false);

  const validLength = evaluatePasswordRules("Ab1!5678");
  const validLengthRule = validLength.results.find((r) => r.id === "length");
  assert.equal(validLengthRule.passed, true);
});

test("evaluatePasswordRules verifies uppercase character rule", () => {
  const noUpper = evaluatePasswordRules("lowercase123!");
  const upperRule = noUpper.results.find((r) => r.id === "uppercase");
  assert.equal(upperRule.passed, false);

  const withUpper = evaluatePasswordRules("Lowercase123!");
  const upperRulePassed = withUpper.results.find((r) => r.id === "uppercase");
  assert.equal(upperRulePassed.passed, true);
});

test("evaluatePasswordRules verifies lowercase character rule", () => {
  const noLower = evaluatePasswordRules("UPPERCASE123!");
  const lowerRule = noLower.results.find((r) => r.id === "lowercase");
  assert.equal(lowerRule.passed, false);

  const withLower = evaluatePasswordRules("UPPERCASe123!");
  const lowerRulePassed = withLower.results.find((r) => r.id === "lowercase");
  assert.equal(lowerRulePassed.passed, true);
});

test("evaluatePasswordRules verifies numerical digit rule", () => {
  const noNumber = evaluatePasswordRules("Password!");
  const numberRule = noNumber.results.find((r) => r.id === "number");
  assert.equal(numberRule.passed, false);

  const withNumber = evaluatePasswordRules("Password123!");
  const numberRulePassed = withNumber.results.find((r) => r.id === "number");
  assert.equal(numberRulePassed.passed, true);
});

test("evaluatePasswordRules verifies special character rule", () => {
  const noSpecial = evaluatePasswordRules("Password123");
  const specialRule = noSpecial.results.find((r) => r.id === "special");
  assert.equal(specialRule.passed, false);

  const withSpecial = evaluatePasswordRules("Password123@#");
  const specialRulePassed = withSpecial.results.find((r) => r.id === "special");
  assert.equal(specialRulePassed.passed, true);
});

test("evaluatePasswordRules rejects passwords containing spaces", () => {
  const withSpace = evaluatePasswordRules("Strong Pass 123!");
  assert.equal(withSpace.allPassed, false);

  const noSpace = evaluatePasswordRules("StrongPass123!");
  assert.equal(noSpace.allPassed, true);
});

test("calculatePasswordStrength grades password appropriately across all tiers", () => {
  // Empty
  assert.equal(calculatePasswordStrength("").level, "none");
  assert.equal(calculatePasswordStrength("").score, 0);

  // Short passwords are weak
  assert.equal(calculatePasswordStrength("Short1!").level, "weak");

  // Moderate password
  const fair = calculatePasswordStrength("pass12345");
  assert.equal(fair.level, "fair");

  const medium = calculatePasswordStrength("Pass12345");
  assert.equal(medium.level, "medium");

  // Strong password (all 6 requirements met)
  const strong = calculatePasswordStrength("StrongPass123!");
  assert.equal(strong.level, "strong");
  assert.equal(strong.score >= 85, true);

  // Very strong password (all 6 requirements + length >= 12)
  const veryStrong = calculatePasswordStrength("SuperStrongPass2026!#");
  assert.equal(veryStrong.level, "strong");
  assert.equal(veryStrong.score, 100);
  assert.equal(veryStrong.label, "Very Strong");
});

test("getFirebaseErrorMessage translates password errors gracefully", () => {
  assert.match(getFirebaseErrorMessage({ code: "auth/wrong-password" }), /incorrect/i);
  assert.match(getFirebaseErrorMessage({ code: "auth/weak-password" }), /contain at least 8 characters/i);
  assert.match(getFirebaseErrorMessage({ code: "auth/too-many-requests" }), /too many attempts/i);
});
