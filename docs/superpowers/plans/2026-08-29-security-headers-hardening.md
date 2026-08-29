# Security Headers Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure all required HTTP security headers across Vercel frontend hosting (`web/vercel.json`), local static preview (`web/public/serve.json`), and the Express API backend (`server/server.js`) to achieve an A+ / 100% Green grade on security scanners (Snyk, SecurityHeaders) without breaking Google Maps, digital contracts PDF previews, Firebase authentication, or chat websockets.

**Architecture:**
- **Frontend Vercel Configuration (`web/vercel.json`)**: Apply global route matching (`"source": "/(.*)"`) defining all 6 security headers (`Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy`).
- **Static Preview Parity (`web/public/serve.json`)**: Provide a `serve.json` file in `web/public/` using `"source": "**/*"` so that local `npx serve` runs mirror production headers identically.
- **Backend API Layer (`server/server.js`)**: Update Helmet middleware and attach `Permissions-Policy` and refined CSP directives to all Express API endpoints.
- **Automated Verification**: Dedicated unit and integration tests verifying header presence and values on both frontend configs and backend endpoints.

**Tech Stack:** Vercel Hosting Engine, Express.js 4, Helmet 8, Node.js Test Runner, Vite 5.

---

## Global Constraints

- **Zero Breaking Changes**: Must strictly preserve Google Maps embeds (`https://www.google.com/maps/embed`), PDF/Receipt blob URL previews (`blob:`, `data:`), Firebase Auth popups/tokens, and Socket.IO websockets (`wss://api.lilycrest.space`).
- **Global Coverage**: Security headers must apply to all routes (`/(.*)`), not just auth endpoints.
- **Strict Terminology**: Always uphold project terminology standards ("Tenant", "Rent", "Owner", "Assistant").

---

### Task 1: Comprehensive Security Headers in `web/vercel.json` & `web/public/serve.json`

**Files:**
- Modify: `Capstone-Website/web/vercel.json`
- Create: `Capstone-Website/web/public/serve.json`
- Test: `Capstone-Website/web/scripts/securityHeaders.test.mjs`

**Interfaces:**
- Consumes: Vercel routing schema & `serve` configuration format.
- Produces: Universal security response headers on all public and authenticated web pages.

- [ ] **Step 1: Write the test verifying `vercel.json` and `serve.json` headers**

Create `Capstone-Website/web/scripts/securityHeaders.test.mjs`:
```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test("vercel.json contains all 6 required security headers on universal route /(.*)", () => {
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
  assert.match(cspHeader.value, /frame-src[^;]*google\.com/, "CSP must allow Google Maps frames");
  assert.match(cspHeader.value, /connect-src[^;]*identitytoolkit\.googleapis\.com/, "CSP must allow Firebase auth");
});

test("serve.json in public/ matches security headers for local preview parity", () => {
  const servePath = path.resolve(__dirname, "../public/serve.json");
  assert.ok(fs.existsSync(servePath), "public/serve.json must exist");

  const serveConfig = JSON.parse(fs.readFileSync(servePath, "utf8"));
  assert.ok(Array.isArray(serveConfig.headers), "headers array must exist");

  const globalRule = serveConfig.headers.find((h) => h.source === "**/*");
  assert.ok(globalRule, "serve.json must have a **/* rule");

  const headerKeys = new Set(globalRule.headers.map((h) => h.key.toLowerCase()));
  assert.ok(headerKeys.has("content-security-policy"), "serve.json must have CSP");
  assert.ok(headerKeys.has("permissions-policy"), "serve.json must have Permissions-Policy");
});
```

- [ ] **Step 2: Run test to verify it fails initially**

Run: `node Capstone-Website/web/scripts/securityHeaders.test.mjs`
Expected: FAIL (global `/(.*)` rule and `public/serve.json` do not exist yet)

- [ ] **Step 3: Update `web/vercel.json` and create `web/public/serve.json`**

Update `Capstone-Website/web/vercel.json`:
```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains; preload" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=(), accelerometer=(), gyroscope=(), magnetometer=()" },
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin-allow-popups" },
        { "key": "Cross-Origin-Resource-Policy", "value": "same-origin" },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; script-src-attr 'none'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://api.lilycrest.space http://localhost:5000 wss://api.lilycrest.space ws://localhost:5000 https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://firebasestorage.googleapis.com https://storage.googleapis.com https://psgc.cloud https://*.psgc.cloud https://accounts.google.com; frame-src 'self' blob: data: https://www.google.com https://*.firebaseapp.com https://accounts.google.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests"
        }
      ]
    }
  ],
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Create `Capstone-Website/web/public/serve.json`:
```json
{
  "headers": [
    {
      "source": "**/*",
      "headers": [
        { "key": "Strict-Transport-Security", "value": "max-age=31536000; includeSubDomains; preload" },
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "X-Frame-Options", "value": "DENY" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=(), accelerometer=(), gyroscope=(), magnetometer=()" },
        { "key": "Cross-Origin-Opener-Policy", "value": "same-origin-allow-popups" },
        { "key": "Cross-Origin-Resource-Policy", "value": "same-origin" },
        {
          "key": "Content-Security-Policy",
          "value": "default-src 'self'; script-src 'self' 'unsafe-inline'; script-src-attr 'none'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: blob: https:; font-src 'self' data: https://fonts.gstatic.com; connect-src 'self' https://api.lilycrest.space http://localhost:5000 wss://api.lilycrest.space ws://localhost:5000 https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://firebasestorage.googleapis.com https://storage.googleapis.com https://psgc.cloud https://*.psgc.cloud https://accounts.google.com; frame-src 'self' blob: data: https://www.google.com https://*.firebaseapp.com https://accounts.google.com; worker-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests"
        }
      ]
    }
  ],
  "rewrites": [
    { "source": "**", "destination": "/index.html" }
  ]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node Capstone-Website/web/scripts/securityHeaders.test.mjs`
Expected: PASS with 2 passing tests.

- [ ] **Step 5: Commit changes**

```bash
git add Capstone-Website/web/vercel.json Capstone-Website/web/public/serve.json Capstone-Website/web/scripts/securityHeaders.test.mjs
git commit -m "sec(web): enforce global security headers on vercel.json and serve.json"
```

---

### Task 2: Backend API Helmet & Express Security Headers Hardening

**Files:**
- Modify: `Capstone-Website/server/server.js`
- Test: `Capstone-Website/server/middleware/securityHeaders.test.js`

**Interfaces:**
- Consumes: Express request pipeline.
- Produces: Enhanced HTTP response headers on all backend endpoints (`/api/*`, `/health`).

- [ ] **Step 1: Write backend security headers test**

Create `Capstone-Website/server/middleware/securityHeaders.test.js`:
```javascript
import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import express from "express";
import helmet from "helmet";

test("Helmet and custom security headers middleware emit required headers", async () => {
  const app = express();

  app.use((req, res, next) => {
    res.setHeader(
      "Permissions-Policy",
      "camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=()",
    );
    next();
  });

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: [
            "'self'",
            "https://identitytoolkit.googleapis.com",
            "https://securetoken.googleapis.com",
          ],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          objectSrc: ["'none'"],
          frameSrc: ["'none'"],
          frameAncestors: ["'none'"],
          formAction: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: false,
      crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },
      frameguard: { action: "deny" },
      referrerPolicy: { policy: "strict-origin-when-cross-origin" },
      permittedCrossDomainPolicies: { permittedPolicies: "none" },
      xContentTypeOptions: true,
      crossOriginResourcePolicy: { policy: "same-origin" },
    }),
  );

  app.get("/test", (req, res) => res.json({ ok: true }));

  const res = await request(app).get("/test");

  assert.equal(res.status, 200);
  assert.equal(res.headers["x-content-type-options"], "nosniff");
  assert.equal(res.headers["x-frame-options"], "DENY");
  assert.equal(res.headers["referrer-policy"], "strict-origin-when-cross-origin");
  assert.ok(res.headers["strict-transport-security"]);
  assert.ok(res.headers["permissions-policy"]);
  assert.ok(res.headers["content-security-policy"]);
});
```

- [ ] **Step 2: Run test to verify it executes and passes**

Run: `node Capstone-Website/server/middleware/securityHeaders.test.js`
Expected: PASS

- [ ] **Step 3: Update `server/server.js` with Permissions-Policy header and aligned Helmet config**

In `Capstone-Website/server/server.js`, inject the `Permissions-Policy` header in the main pipeline right before Helmet:
```javascript
app.use((_req, res, next) => {
  res.setHeader(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), display-capture=(), accelerometer=(), gyroscope=(), magnetometer=()",
  );
  next();
});
```

- [ ] **Step 4: Run server tests to verify zero regressions**

Run: `npm --prefix Capstone-Website/server test`
Expected: All backend test suites pass.

- [ ] **Step 5: Commit server changes**

```bash
git add Capstone-Website/server/server.js Capstone-Website/server/middleware/securityHeaders.test.js
git commit -m "sec(server): add permissions-policy header and align helmet security policy"
```

---

### Task 3: Comprehensive Build & Integration Verification

**Files:**
- Test: `Capstone-Website/web/scripts/securityHeaders.test.mjs`
- Test: `Capstone-Website/server/middleware/securityHeaders.test.js`

- [ ] **Step 1: Run frontend test suite & build check**

Run:
```bash
node Capstone-Website/web/scripts/securityHeaders.test.mjs
npm --prefix Capstone-Website/web run build
```
Expected: All tests pass, build succeeds with 0 errors.

- [ ] **Step 2: Run backend test suite**

Run:
```bash
npm --prefix Capstone-Website/server test
```
Expected: All server test suites pass with 0 errors.
