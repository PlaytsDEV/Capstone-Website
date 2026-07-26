---
description: Perform a comprehensive health, API parity, visual consistency, and build validation audit across Lilycrest DMS and automatically patch issues
---

# Autonomous Quality Audit & Repair Workflow (`/audit-and-fix`)

Use this workflow to perform system-wide code health, API contract verification, and visual unification audits across both backend and frontend codebases.

## Workflow Execution Steps

### 1. API Contract & Response Envelope Audit
- Scan Express controller files in `/server/src/controllers/` to ensure all endpoints return standardized JSON envelopes (`{ success: true, data: ... }` or `{ success: false, error: ... }`).
- Check that missing data returns proper HTTP status codes (e.g., `404`, `400`, `401`, `403`) rather than crashing or returning `200 OK` with null bodies.
- Verify role permissions and check that `requirePermission` middleware is applied to protected endpoints.

### 2. Frontend Resilience & Layout Shift Audit
- Check single-page routes in `/web/src/` to verify each dynamic route has a corresponding `*Skeleton.jsx` fallback component during asynchronous loading.
- Verify that React routes are wrapped with error boundaries to gracefully handle rendering or network failures.
- Check forms to ensure all input fields have explicit labels, accessibility attributes, and descriptive validation error states.

### 3. Visual Unification & Theme Audit
- Check that UI components reference custom HSL tokens from `index.css` and `ThemeContext`.
- Ensure buttons, badges, status indicators, dynamic cards, and ToggleSwitches maintain uniform visual hierarchy across Super Admin, Admin, and Tenant dashboards.
- Eliminate layout jumps and smooth out light/dark mode color transitions.

### 4. Build & Test Verification
- Run backend tests (`npm test` in `/server`) to detect regression failures.
- Run frontend build (`npm run build` in `/web`) to detect TypeScript/JSX errors, unused imports, or missing dependencies.
- **Auto-Fix Loop**: Inspect error trace logs silently, patch offending files, and re-verify until clean compilation is achieved.

### 5. Final Report
- Output a summary of audited files, patched vulnerabilities, and verification outcomes.
