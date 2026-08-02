import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { recoverFromAuthFailure } from "../utils/identitySafety.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const signUp = fs.readFileSync(path.resolve(here, "../../features/public/pages/SignUp.jsx"), "utf8");
const signIn = fs.readFileSync(path.resolve(here, "../../features/tenant/pages/SignIn.jsx"), "utf8");

test("frontend auth failures never delete Firebase identities", () => {
  for (const [name, source] of [["SignUp", signUp], ["SignIn", signIn]]) {
    assert.doesNotMatch(source, /(?:currentUser|firebaseUser|\bu\b|\buser\b)\.delete\s*\(/, `${name} contains identity deletion`);
    assert.match(source, /recoverFromAuthFailure\(auth/, `${name} must preserve identity and sign out locally`);
  }
});

test("404, 403, 409, 500, timeout, and registration failures never delete the Firebase user", async () => {
  for (const failure of [
    { response: { status: 404 } }, { response: { status: 403 } },
    { response: { status: 409 } }, { response: { status: 500 } },
    Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }),
    Object.assign(new Error("registration failed"), { code: "BACKEND_REGISTRATION_FAILED" }),
  ]) {
    let deletes = 0;
    let signOuts = 0;
    const auth = {
      currentUser: { delete: async () => { deletes += 1; } },
      signOut: async () => { signOuts += 1; },
    };
    await recoverFromAuthFailure(auth, failure);
    assert.equal(signOuts, 1);
    assert.equal(deletes, 0);
  }
});

test("provider and backend failures retain recoverable status handling", () => {
  assert.match(signIn, /status === 404/);
  assert.match(signIn, /status === 403/);
  assert.match(signIn, /getFirebaseErrorMessage\(error, "login"\)/);
  assert.match(signUp, /loginError\.response\?\.status === 404/);
  assert.match(signUp, /errCode === "EMAIL_TAKEN"/);
});
