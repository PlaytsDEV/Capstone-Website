import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, 'SignIn.jsx'), 'utf8');

test('handleEmailPasswordLogin always resets submitting in finally block', () => {
  // Ensure setSubmitting(false) is present in the finally block of handleEmailPasswordLogin
  assert.match(
    source,
    /finally\s*\{[\s\S]*?clearLoginInProgress\(\);[\s\S]*?setGlobalLoading\(false\);[\s\S]*?setSubmitting\(false\);[\s\S]*?\}/,
  );
});

test('handleEmailPasswordLogin catches error, clears password, sets credentialError, and focuses password input', () => {
  // Ensure password is reset and focused on failure with credentialError set
  assert.match(source, /setFormData\(\(prev\) => \(\{ \.\.\.prev, password: "" \}\)\)/);
  assert.match(source, /setCredentialError\(true\)/);
  assert.match(source, /document\.getElementById\(["']password["']\)\?\.focus\(\)/);
});

test('SignIn applies hasError to both Email and Password fields when credentialError is active', () => {
  assert.match(source, /<FloatingInput[\s\S]*?name="email"[\s\S]*?hasError=\{credentialError\}/);
  assert.match(source, /<FloatingInput[\s\S]*?name="password"[\s\S]*?hasError=\{credentialError\}/);
});

test('handleChange clears credentialError as soon as user types', () => {
  assert.match(source, /if\s*\(credentialError\)\s*\{\s*setCredentialError\(false\);\s*\}/);
});
