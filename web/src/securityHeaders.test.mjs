import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("vercel.json contains all 6 required security headers on global route /(.*) with Grade A+ CSP", () => {
  const vercelPath = path.resolve(__dirname, "../vercel.json");
  assert.ok(fs.existsSync(vercelPath), "vercel.json must exist");

  const vercelConfig = JSON.parse(fs.readFileSync(vercelPath, "utf8"));
  assert.ok(Array.isArray(vercelConfig.headers), "headers array must exist");

  const globalRule = vercelConfig.headers.find(
    (h) => h.source === "/(.*)" || h.source === "/:path*",
  );
  assert.ok(globalRule, "A global header rule for /(.*) must exist");

  const headerKeys = new Set(globalRule.headers.map((h) => h.key.toLowerCase()));
  assert.ok(headerKeys.has("strict-transport-security"), "Must have Strict-Transport-Security");
  assert.ok(headerKeys.has("content-security-policy"), "Must have Content-Security-Policy");
  assert.ok(headerKeys.has("x-frame-options"), "Must have X-Frame-Options");
  assert.ok(headerKeys.has("x-content-type-options"), "Must have X-Content-Type-Options");
  assert.ok(headerKeys.has("referrer-policy"), "Must have Referrer-Policy");
  assert.ok(headerKeys.has("permissions-policy"), "Must have Permissions-Policy");

  const cspHeader = globalRule.headers.find(
    (h) => h.key.toLowerCase() === "content-security-policy",
  );
  assert.match(cspHeader.value, /script-src 'self'/, "CSP must contain script-src 'self'");
  assert.doesNotMatch(cspHeader.value, /script-src[^;]*'unsafe-inline'/, "CSP script-src must NOT contain 'unsafe-inline' for Grade A+");
  assert.match(cspHeader.value, /img-src[^;]*googleusercontent\.com/, "CSP must allow Google avatars in img-src");
  assert.match(cspHeader.value, /img-src[^;]*firebasestorage\.googleapis\.com/, "CSP must allow Firebase Storage in img-src");
  assert.doesNotMatch(cspHeader.value, /connect-src[^;]*http:\/\/localhost/, "CSP connect-src must NOT contain unencrypted localhost in production");
  assert.match(cspHeader.value, /frame-src[^;]*google\.com/, "CSP must allow Google Maps frames");
  assert.match(cspHeader.value, /connect-src[^;]*identitytoolkit\.googleapis\.com/, "CSP must allow Firebase auth");
  assert.match(cspHeader.value, /frame-ancestors 'none'/, "CSP must prohibit third-party framing");
});

test("serve.json in public/ matches Grade A+ security headers for local preview parity", () => {
  const servePath = path.resolve(__dirname, "../public/serve.json");
  assert.ok(fs.existsSync(servePath), "public/serve.json must exist");

  const serveConfig = JSON.parse(fs.readFileSync(servePath, "utf8"));
  assert.ok(Array.isArray(serveConfig.headers), "headers array must exist");

  const globalRule = serveConfig.headers.find((h) => h.source === "**/*");
  assert.ok(globalRule, "serve.json must have a **/* rule");

  const cspHeader = globalRule.headers.find(
    (h) => h.key.toLowerCase() === "content-security-policy",
  );
  assert.match(cspHeader.value, /script-src 'self'/, "serve.json must contain script-src 'self'");
  assert.doesNotMatch(cspHeader.value, /script-src[^;]*'unsafe-inline'/, "serve.json script-src must NOT contain 'unsafe-inline' for Grade A+");
});
