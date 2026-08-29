import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const webRoot = path.resolve(here, "../../../..");
const read = (relative) => fs.readFileSync(path.join(webRoot, relative), "utf8");
const signIn = read("src/features/tenant/pages/SignIn.jsx");

test("SignIn handleSocialLogin notifies user and redirects to SignUp when Google account is not registered (404)", () => {
  // 1. Must check for 404 / unregistered backend status
  assert.match(signIn, /status === 404/);

  // 2. Must display clear notification toast informing the user to sign up first
  assert.match(
    signIn,
    /This Google account is not registered yet\. Please sign up first\./,
  );

  // 3. Must safely sign out / recover auth failure to avoid orphan sessions
  assert.match(signIn, /await auth\.signOut\(\)|await recoverFromAuthFailure\(auth/);

  // 4. Must redirect to /signup
  assert.match(signIn, /navigate\(["']\/signup["']/);

  // 5. Must support redirect auth fallback
  assert.match(signIn, /signInWithRedirect/);
  assert.match(signIn, /getRedirectResult/);
});
