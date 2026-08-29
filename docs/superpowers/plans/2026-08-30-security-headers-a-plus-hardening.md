# Security Headers Grade A+ Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade the security rating on Snyk and SecurityHeaders scanners from Grade A to **Grade A+** by removing `'unsafe-inline'` from the `script-src` directive in `Content-Security-Policy` across `web/vercel.json`, `web/public/serve.json`, `web/scripts/serve-build.mjs`, and `server/server.js` while maintaining full functionality of the Vite-bundled React app.

**Architecture:**
- **Strict `script-src 'self'` Directive**: Restrict script execution exclusively to same-origin bundled scripts (`/assets/*.js`), eliminating the scanner warning for `'unsafe-inline'`.
- **Preserved `style-src` and Whitelists**: Retain `'unsafe-inline'` in `style-src` for Tailwind CSS dynamic styling and preserve Google Maps, PDF blobs, Firebase Auth, and WebSocket endpoints.
- **Synchronized Testing**: Update frontend and backend test suites to strictly assert that `script-src` contains only `'self'` without `'unsafe-inline'`.

**Tech Stack:** Vercel Hosting, Express.js 4, Helmet 8, Node.js Test Runner, Vite 5, Jest 30.

**Spec:** Snyk Web Security Header Audit & SecurityHeaders.com Grade A+ Evaluation Standard.

---

## Global Constraints

- **Zero Functional Regressions**: Must strictly maintain Google Maps interactive embeds, digital contract/receipt PDF generation and previews, Firebase authentication, and real-time chat websockets.
- **Strict `script-src`**: `script-src` must strictly be `'self'` (no `'unsafe-inline'` or `'unsafe-eval'`).
- **Always Uphold Terminology**: Keep standard project terminology ("Tenant", "Rent", "Owner", "Assistant").

---

### Task 1: Refine Frontend `script-src` to `'self'` in `web/vercel.json`, `web/public/serve.json`, and `web/scripts/serve-build.mjs`

**Files:**
- Modify: `Capstone-Website/web/vercel.json`
- Modify: `Capstone-Website/web/public/serve.json`
- Modify: `Capstone-Website/web/scripts/serve-build.mjs`
- Modify: `Capstone-Website/web/src/securityHeaders.test.mjs`

**Interfaces:**
- Consumes: Vercel routing configuration & Node HTTP static file server.
- Produces: Grade A+ compliant CSP header emitting `script-src 'self'` without `'unsafe-inline'`.

- [x] **Step 1: Update `web/src/securityHeaders.test.mjs` to assert `script-src 'self'` without `'unsafe-inline'`**
- [x] **Step 2: Run test to verify it fails initially against current `'unsafe-inline'` configuration**
- [x] **Step 3: Update `web/vercel.json`, `web/public/serve.json`, and `web/scripts/serve-build.mjs`**
- [x] **Step 4: Run test to verify it passes**
- [x] **Step 5: Commit frontend changes**

---

### Task 2: Align Express Backend API Helmet CSP Configuration

**Files:**
- Modify: `Capstone-Website/server/server.js:295-310`
- Modify: `Capstone-Website/server/middleware/securityHeaders.test.js`

**Interfaces:**
- Consumes: Express request pipeline.
- Produces: Backend CSP header strictly adhering to `script-src 'self'`.

- [x] **Step 1: Update `server/middleware/securityHeaders.test.js`**
- [x] **Step 2: Run backend test to verify it passes**
- [x] **Step 3: Commit server changes**

---

### Task 3: Comprehensive Build & Regression Validation

**Files:**
- Test: `Capstone-Website/web/src/securityHeaders.test.mjs`
- Test: `Capstone-Website/server/middleware/securityHeaders.test.js`

- [x] **Step 1: Run frontend test suite & production build check**
- [x] **Step 2: Run backend test suite**
