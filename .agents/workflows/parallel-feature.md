---
description: Build and verify a full-stack feature in high-speed parallel mode using background tasks and subagents
---

# Parallel Execution Feature Workflow (`/parallel-feature`)

Use this workflow to implement and verify full-stack features using concurrent background tasks, subagents, and parallel verification loops for maximum speed.

## Execution Architecture

```
                      ┌─── Backend API & Controller Design ───┐
                      │                                       │
  [User Request] ─────┼─── Frontend Service & React UI ───────┼───► [Aggregate Logs & Auto-Fix] ───► [Commit]
                      │                                       │
                      └─── Async Tests & Build Verification ──┘
```

## Workflow Execution Steps

### Phase 1: Concurrent Research & Planning
1. Concurrently inspect database schemas in `/server/src/models/` and UI component routes in `/web/src/`.
2. Define the API contract envelope `{ success: true, data: ... }` and required permission keys (`requirePermission`).

### Phase 2: Parallel Build & Generation
1. **Backend Layer**: Update MongoDB models, Express controllers, and routes in `/server/`.
2. **Frontend Layer**: Simultaneously create modular HTTP services in `/web/src/features/...`, React views with bespoke HSL styling tokens, and `*Skeleton.jsx` fallback components.

### Phase 3: Asynchronous Test Execution
1. Launch backend test suite (`npm test` in `/server`) as an **asynchronous background task**.
2. Simultaneously launch frontend production compilation (`npm run build` in `/web`) as an **asynchronous background task**.
3. Do NOT pause or block while waiting; continue finalizing styling, accessibility labels, or documentation.

### Phase 4: Subagent Visual Verification
1. Spawn a **browser subagent** (`browser_subagent`) to test UI rendering, layout responsiveness, and dark/light mode transitions in parallel.

### Phase 5: Log Aggregation & Auto-Fix
1. Inspect output logs from background tasks silently upon completion.
2. If any test or build check fails:
   - Identify the root cause immediately from log tracebacks.
   - Patch offending backend controllers or React components.
   - Re-trigger background verification until 100% clean pass.

### Phase 6: Commit & Hand-Off
1. Stage modified files and create a conventional commit (e.g., `feat(parallel): add high-speed parallel feature implementation`).
2. Summarize completion for the user.
