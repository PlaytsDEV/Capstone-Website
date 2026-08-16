import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const source = fs.readFileSync(
  new URL("./SettingsTab.jsx", import.meta.url),
  "utf8",
);

test("SettingsTab uses realtime theme selection without Save changes or Discard buttons", () => {
  // Theme context is used directly for realtime updates
  assert.match(source, /const\s*\{\s*theme,\s*setTheme\s*\}\s*=\s*useTheme\(\)/);

  // Clicking theme card triggers setTheme immediately
  assert.match(source, /onClick=\{\(\)\s*=>\s*setTheme\(id\)\}/);

  // Save changes and Discard buttons for theme are removed
  assert.doesNotMatch(source, /handleSaveTheme/);
  assert.doesNotMatch(source, /Save changes/);
  assert.doesNotMatch(source, /pendingTheme/);
});

test("SettingsTab provides 3-card theme selector with accessible radiogroup", () => {
  assert.match(source, /role="radiogroup"/);
  assert.match(source, /role="radio"/);
  assert.match(source, /aria-checked=\{active\}/);
  assert.match(source, /id:\s*"light"/);
  assert.match(source, /id:\s*"dark"/);
  assert.match(source, /id:\s*"system"/);
});

const changePasswordSource = fs.readFileSync(
  new URL("./ChangePasswordForm.jsx", import.meta.url),
  "utf8",
);
const authValidationSource = fs.readFileSync(
  new URL("../../../../shared/utils/authValidation.js", import.meta.url),
  "utf8",
);

test("SettingsTab integrates ChangePasswordForm with realtime password strength & criteria validation", () => {
  assert.match(source, /ChangePasswordForm/);
  assert.match(changePasswordSource, /calculatePasswordStrength/);
  assert.match(changePasswordSource, /evaluatePasswordRules/);
  assert.match(authValidationSource, /8\+\s*characters|At least 8 characters/);
  assert.match(authValidationSource, /uppercase letter/i);
  assert.match(authValidationSource, /lowercase letter/i);
  assert.match(authValidationSource, /number/i);
  assert.match(authValidationSource, /special character/i);
  assert.match(changePasswordSource, /Passwords match/);
});

test("SettingsTab includes copy UID and active session security controls", () => {
  assert.match(source, /handleCopyUid/);
  assert.match(source, /navigator\.clipboard\.writeText/);
  assert.match(source, /Sign Out of All Devices/);
  assert.match(source, /getDeviceDetails/);
});

test("SettingsTab uses full width layout consistent with sidebar", () => {
  assert.match(source, /max-width:\s*100%/);
  assert.doesNotMatch(source, /max-width:\s*1040px/);
  assert.doesNotMatch(source, /\.st-container\s*\{[^}]*margin:\s*0\s*auto/);
});
