---
description: Automatically design, build, test, and verify an end-to-end Lilycrest DMS feature across backend, frontend, and tests without manual intervention
---

# Autonomous Feature Pipeline Workflow (`/auto-feature`)

Use this workflow when requested to implement a complete feature, end-to-end milestone, or module for the Lilycrest Dormitory Management System.

## Workflow Execution Steps

### Phase 1: Architecture & Parity Research
1. Read the target feature specification or user request thoroughly.
2. Inspect existing models in `/server/src/models/` and controllers in `/server/src/controllers/`.
3. Inspect corresponding API services in `/web/src/features/...` and UI routes in `/web/src/routes/` or `/web/src/features/...`.
4. Verify database schema rules and permission keys (`requirePermission`) needed for role access.

### Phase 2: Backend First Implementation
1. **Schema & Model**: Define/update Mongoose schemas using atomic update patterns (`$inc`, `$set`) or proper indexes.
2. **Controllers**: Implement standardized Express controllers with `{ success: true, data: ... }` response envelopes and defensive input validation.
3. **Routes & Middleware**: Add backend routes in `/server/src/routes/` with `requireAuth` and granular `requirePermission` middlewares.
4. **Mobile Parity**: Ensure `/api/mobile/...` endpoints remain compatible if shared logic is touched.

### Phase 3: Frontend Integration & Visual Excellence
1. **API Service**: Create/update modular HTTP service calls in `/web/src/features/[feature]/services/`.
2. **UI & State**: Create React components using clean layout hierarchy, bespoke HSL theme variables, and subtle micro-animations (strictly avoiding generic AI template styling).
3. **Skeletons & Error Boundaries**: Build per-component `*Skeleton.jsx` placeholders and wrap routes in error boundaries to prevent layout shift during loading.
4. **Responsive Layouts**: Ensure dark/light mode transitions are smooth and dynamic.

### Phase 4: Automated Testing & Self-Correction
1. **Backend Tests**: Run server unit and integration tests (`npm test` in `/server`).
2. **Frontend Build**: Execute Vite production compilation (`npm run build` in `/web`).
3. **Self-Correction Loop**: If any build check or test fails:
   - Read the exact error traceback silently.
   - Formulate root-cause resolution.
   - Apply fixes to code.
   - Re-run test/build check until 100% clean pass.

### Phase 5: Verification & Commit
1. Run pre-commit checks (`git status`, lint checks).
2. Commit changes using conventional commit syntax (e.g., `feat(billing): add automated utility charge distribution`).
3. Summarize completion concisely for the user.
