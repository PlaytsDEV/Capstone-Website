import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webSrcDir = path.resolve(__dirname, "../../");

describe("Public Route Auth and Asset Isolation", () => {
  test("App.js properly nests FirebaseAuthProvider and AuthProvider for session synchronization", () => {
    const appJsPath = path.join(webSrcDir, "App.js");
    const appContent = fs.readFileSync(appJsPath, "utf-8");
    const hasProperNesting = /<FirebaseAuthProvider>\s*<AuthProvider>\s*<ThemeProvider>/s.test(appContent);
    assert.strictEqual(hasProperNesting, true, "App.js must wrap AuthProvider in FirebaseAuthProvider for full Firebase session reactivity.");
  });

  test("FirebaseAuthContext provides safe non-blocking default when unwrapped", () => {
    const contextPath = path.join(webSrcDir, "shared/hooks/FirebaseAuthContext.js");
    const contextContent = fs.readFileSync(contextPath, "utf-8");
    assert.match(contextContent, /loading:\s*false/, "Default FirebaseAuthContext value should have loading: false so un-wrapped public routes are not blocked.");
  });
});
