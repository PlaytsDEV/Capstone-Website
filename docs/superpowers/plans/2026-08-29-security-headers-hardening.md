# Security Headers Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Configure all required HTTP security headers across Vercel frontend hosting (`web/vercel.json`), local static preview server (`web/scripts/serve-build.mjs`), public static serve config (`web/public/serve.json`), and the Express API backend (`server/server.js`) to achieve a 100% Green / Grade A+ rating on Snyk and SecurityHeaders scanners without breaking Google Maps embeds, digital contracts PDF previews, Firebase authentication, or WebSocket chat channels.

**Architecture:**
- **Frontend Edge Routing (`web/vercel.json`)**: Configure universal `/(.*)` routing with explicit directives for all 6 security headers (`Strict-Transport-Security`, `Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy`) along with cross-origin policies.
- **Local Static Preview Parity (`web/public/serve.json` & `web/scripts/serve-build.mjs`)**: Inject identical security headers during local `npx serve` and `node scripts/serve-build.mjs` runs so development and staging environments match production behavior.
- **Backend API Hardening (`server/server.js`)**: Attach `Permissions-Policy` header middleware and update Express Helmet configuration to guard all `/api/*` endpoints.
- **Automated Verification**: Add automated test suites in both `web/src/` (`node --test`) and `server/` (`jest`) asserting exact header emission and CSP compatibility.

**Tech Stack:** Vercel Hosting Engine, Express.js 4, Helmet 8, Node.js Test Runner, Vite 5, Jest 30.

**Spec:** Snyk Web Security Header Audit & OWASP Security Standard.

---

## Global Constraints

- **Zero Breaking Changes**: Must strictly preserve Google Maps embeds (`https://www.google.com/maps/embed`), PDF/Receipt blob and data URL previews (`blob:`, `data:`), Firebase Auth popups/tokens (`https://*.googleapis.com`, `https://*.firebaseapp.com`, `https://accounts.google.com`), and Socket.IO websockets (`wss://api.lilycrest.space`, `ws://localhost:5000`).
- **Universal Route Coverage**: Security headers must apply globally across all routes (`/(.*)`), not just auth sub-routes.
- **Strict Terminology**: Always uphold project terminology standards ("Tenant", "Rent", "Owner", "Assistant").

---

### Task 1: Configure Universal Security Headers in `web/vercel.json`, `web/public/serve.json`, and `web/scripts/serve-build.mjs`

**Files:**
- Modify: `Capstone-Website/web/vercel.json`
- Create: `Capstone-Website/web/public/serve.json`
- Modify: `Capstone-Website/web/scripts/serve-build.mjs`
- Test: `Capstone-Website/web/src/securityHeaders.test.mjs`

**Interfaces:**
- Consumes: Vercel routing configuration schema & Node HTTP response headers.
- Produces: Standardized HTTP security headers across all frontend paths.

- [x] **Step 1: Write the failing frontend test asserting header configurations**
- [x] **Step 2: Run test to verify it fails initially**
- [x] **Step 3: Update `web/vercel.json`, create `web/public/serve.json`, and update `web/scripts/serve-build.mjs`**
- [x] **Step 4: Run frontend test to verify it passes**
- [x] **Step 5: Commit changes**

---

### Task 2: Backend API Helmet & Permissions-Policy Hardening

**Files:**
- Modify: `Capstone-Website/server/server.js:287-328`
- Test: `Capstone-Website/server/middleware/securityHeaders.test.js`

**Interfaces:**
- Consumes: Express request pipeline.
- Produces: Enhanced HTTP response headers on all backend endpoints (`/api/*`, `/health`).

- [x] **Step 1: Write backend security headers test**
- [x] **Step 2: Run backend test to verify it executes and passes**
- [x] **Step 3: Update `server/server.js` with Permissions-Policy header and aligned Helmet config**
- [x] **Step 4: Run server tests to verify zero regressions**
- [x] **Step 5: Commit server changes**

---

### Task 3: Comprehensive Build & Integration Verification

**Files:**
- Test: `Capstone-Website/web/src/securityHeaders.test.mjs`
- Test: `Capstone-Website/server/middleware/securityHeaders.test.js`

- [x] **Step 1: Run frontend test suite & production build check**
- [x] **Step 2: Run backend test suite**
