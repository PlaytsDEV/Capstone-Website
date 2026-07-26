# Workspace Rules - Lilycrest Dormitory Management System (Lilycrest DMS)

## 1. General Principles
- **Backend-First Priority**: Always define and verify backend logic, database schemas, controllers, and API contracts BEFORE updating or connecting frontend components.
- **Preserve Behavior**: Perform non-destructive updates. Preserve existing features, user flows, and utility functions unless explicitly directed otherwise.
- **Empirical Verification**: Never mark a task complete without runtime verification (running dev servers, build checks, or API tests).

## 2. Frontend & UI Guidelines (React / Vite)
- **Minimalist & High-Contrast UX**: Prioritize clean layouts, intuitive workflows, modern typography, HSL color palettes, subtle glassmorphism, and micro-animations.
- **Avoid Generic AI Tropes**: Strictly avoid cliché, formulaic AI/Claude-generated design aesthetics (e.g., repetitive indigo/purple gradient hero cards, cookie-cutter floating pill templates, and generic AI component layouts). Enforce bespoke, brand-tailored visual character, custom HSL color harmonies, and distinct structural UX specific to Lilycrest DMS.
- **Visual Unification**: Maintain consistent card layouts, status badges, occupancy indicators, and ToggleSwitches across all admin, super-admin, and public pages.
- **Resilience & Skeleton Loading**: Wrap single-page routes in per-route error boundaries and use skeleton placeholders (`*Skeleton.jsx`) during asynchronous Suspense fallbacks to eliminate layout shift.
- **Dynamic SEO & Accessibility**: Maintain descriptive page titles, semantic HTML5, explicit form labels, and clear interactive targets.

## 3. Backend, Mobile & Data Reliability (Express.js / MongoDB)
- **Standardized API Contracts**: Enforce standardized API response envelopes (`{ success: true, data: ... }`) and structured error handling across all controller modules.
- **Mobile Compatibility**: Ensure schema or authentication updates maintain full backward compatibility with mobile API endpoints (`/api/mobile/...`).
- **Atomic Operations**: Always use atomic MongoDB operations (`$inc`, `$set`) or transactions for room occupancy, electricity billing, and balance calculations to prevent race conditions.
- **Billing Lifecycle & Prerequisites**: Respect tenant lifecycle conditions (e.g., tenants must have a `checked-in` status before generating monthly billing records).
- **Permissions & Security**: Enforce role-based authorization and granular permission keys (`requirePermission`) on all backend endpoints; maintain Super Admin routing locks.

## 4. Development Workflow & System Controls
- **CI/CD & Git Pre-Commit Hooks**: Ensure pre-commit/pre-push hooks pass (linting, build checks, contract validation) before pushing remote commits.
- **Runtime Health Check Guard**: Maintain `/api/health` verification in frontend initialization to present graceful offline fallbacks if the database or server is unreachable.
- **Environment Configuration**: Keep all ports, DB connection strings, and endpoints strictly environment-driven with zero hardcoded production mocks.
- **Mandatory Plan Review & Approval**: Whenever directed to create a plan (or any plan-related request), generate an Antigravity artifact (e.g., `implementation_plan.md`) and STOP to wait for explicit user review and approval before proceeding with execution.

## 5. Production Hardening & Testing Readiness
- **Input Validation Guard**: Enforce strict request body sanitization and validation on all POST/PUT/PATCH endpoints before executing database logic.
- **Error Trace Sanitization**: Strip internal database stack traces and low-level errors from API error responses in production environments.
- **Secret & Log Security**: Never log or hardcode JWT secrets, database connection strings, or service account keys; replace `console.log` with structured backend logging in production.
- **Automated Regression Suite**: Run unit and integration tests (e.g., `npm test`) for any modified controller or route before committing.
- **Test Database Isolation**: Execute integration tests against isolated test databases or in-memory MongoDB instances to prevent data pollution.

## 6. Autonomous Execution & Self-Correction Rules
- **Autonomous Full-Stack Pass**: When assigned a feature or system optimization, implement all necessary layers (MongoDB Schema -> Controller -> Route -> Frontend API Service -> React View -> Skeletons -> Unit Tests) without stopping mid-way for step-by-step confirmation.
- **Self-Correction & Log Inspection**: If any build, lint, or test command fails, immediately inspect the failure log, formulate a root-cause fix, modify the code, and re-verify independently until zero errors remain.
- **Strict Zero-Intervention Quality Gate**: Never mark a task complete without executing empirical build checks (`npm run build` in `/web`) and test suites (`npm test` in `/server`).
- **Design System Auto-Refinement**: Ensure all newly created or modified UI components inherit custom HSL design tokens, dynamic dark mode transitions, and skeleton fallback states without requiring manual user layout instructions.
- **Parallel Background Execution & Delegation**: Execute long-running test suites (`npm test`) and build verification (`npm run build`) as asynchronous background tasks (`run_command` async / `manage_task`) while generating frontend code, and delegate visual testing to browser subagents to maximize overall execution speed.

