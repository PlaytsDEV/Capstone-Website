import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

// This module reads import.meta.env, which only exists under Vite (dev
// server or build) — not under plain `node --test`. Like the other
// Vite-env-dependent modules in this codebase (see baseUrl.js), it's
// verified by static source assertions rather than execution.
const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, "publicUrls.js"), "utf8");

test("the canonical app URL comes only from VITE_APP_URL, never window/document/request state", () => {
  assert.match(source, /import\.meta\.env\.VITE_APP_URL/);
  // Strip comments/docblocks so this only inspects the executable code —
  // the docblock itself names window.location/document.referrer as the
  // things NOT to use, which would otherwise false-positive this check.
  const codeOnly = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  assert.doesNotMatch(codeOnly, /window\.location|document\.referrer|document\.location/);
});

test("a missing VITE_APP_URL in a production build resolves to empty, not a fallback host", () => {
  assert.match(source, /export const APP_URL = envAppUrl \|\| \(isProd \? "" : "http:\/\/localhost:5173"\);/);
});

test("EMAIL_ACTION_URL is only ever built from the validated APP_URL, and is empty when unconfigured", () => {
  assert.match(source, /export const EMAIL_ACTION_URL = APP_URL \? `\$\{APP_URL\}\/auth-action` : "";/);
});

test("consumers can detect the unconfigured case to fail closed instead of guessing a domain", () => {
  assert.match(source, /export const isAppUrlConfigured = Boolean\(APP_URL\);/);
});
