import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../../../..");
const read = (relative) => fs.readFileSync(path.join(webRoot, relative), "utf8");
const signIn = read("src/features/tenant/pages/SignIn.jsx");

test("SignIn handleSocialLogin auto-onboards Google users when backend returns 404", () => {
  // Must automatically register the user in the backend when 404 occurs during social sign in
  assert.match(signIn, /authApi\.register/);
  // Must not simply show dead-end warning and bail
  assert.doesNotMatch(signIn, /This Google account isn't registered yet\. Please sign up first\./);
  // Must preserve Firebase identity token during 404 auto-registration instead of prematurely signing out
  assert.match(
    signIn,
    /catch\s*\(\s*loginError\s*\)\s*\{\s*const status = loginError\.response\?\.status;[\s\S]*?if\s*\(\s*status === 404/,
  );
  // Must forward linked Google phone number if present
  assert.match(signIn, /phone:\s*firebaseUser\.phoneNumber\s*\|\|\s*""/);
  // Must provide timestamp-backed collision fallback for deterministic uniqueness
  assert.match(signIn, /Date\.now\(\)\.toString\(36\)/);
});
