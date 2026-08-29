# Room Transfer Security Deposit Preservation & Legacy Deposit Clarity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax for tracking.

**Goal:** Ensure 100% transparency and clarity across all admin and tenant interfaces regarding the 1-month security deposit: guaranteeing that security deposits are strictly preserved and carried over across room transfers, legacy records are clearly explained with an optional admin confirmation tool, and deductions are explicitly communicated as only occurring at final move-out clearance.

**Architecture:** 
- Frontend (TenantBillingTab.jsx, TenantWorkspaceModals.jsx): Enhance the Security Deposit card and Room Transfer preview to explicitly state that the 1-month deposit is carried over intact without deductions, and clarify legacy status notes.
- Backend (	enantWorkspace.js, 	enantActionService.js): Maintain the strict invariant that security deposits are never deducted during room transfer, ensure automated backfill on legacy transfers, and provide an endpoint for optional manual deposit confirmation if needed.
- Tests: Add comprehensive unit and integration tests verifying deposit preservation across room transfers and legacy backfill handling.

**Tech Stack:** React 19, Tailwind CSS, Express.js, MongoDB/Mongoose, Vitest/Node Test Runner.

---

## Global Constraints

- Never deduct from a security deposit during a Room Transfer (deductions only occur at Move-Out Clearance).
- 1-Month Security Deposit requirement matches 1x the approved monthly rent of the active room.
- Legacy records with unrecorded deposits automatically backfill baseline rate upon room transfer.
- Always use standard terminology ("Tenant", "Rent", "Owner", "Assistant").

---

### Task 1: Enhance Security Deposit Transparency in Tenant Billing Tab

**Files:**
- Modify: Capstone-Website/web/src/features/admin/components/tenants/details/TenantBillingTab.jsx
- Test: Capstone-Website/web/src/features/admin/components/transferAddendumUi.phase9.test.mjs

- [ ] **Step 1: Update the Security Deposit card description in TenantBillingTab.jsx**
  Add clear copy clarifying that for legacy accounts, the 1-month deposit requirement is active and carries over during room transfers.
- [ ] **Step 2: Run frontend test to verify changes**
  Run: 
pm --prefix Capstone-Website/web test -- transferAddendumUi.phase9.test.mjs
- [ ] **Step 3: Commit UI improvements**

---

### Task 2: Enhance Room Transfer Modal Deposit Reassurance & Breakdown

**Files:**
- Modify: Capstone-Website/web/src/features/admin/components/TenantWorkspaceModals.jsx

- [ ] **Step 1: Add deposit preservation helper note in TenantWorkspaceModals.jsx**
  Add explicit helper text inside the Security Deposit financial group of the transfer modal: *"Security deposits are carried over intact and never deducted during a room transfer. Deductions only apply during final move-out clearance."*
- [ ] **Step 2: Run transfer modal tests**
  Run: 
pm --prefix Capstone-Website/web test
- [ ] **Step 3: Commit modal changes**

---

### Task 3: Backend Invariant & Test Suite Verification

**Files:**
- Test: Capstone-Website/server/utils/tenantActionService.transferFinancialSettlement.integration.test.js
- Test: Capstone-Website/server/utils/tenantActionService.transferThenRenewMoveOut.integration.test.js

- [ ] **Step 1: Run transfer financial settlement test suite**
  Run: 
pm --prefix Capstone-Website/server test -- utils/tenantActionService.transferFinancialSettlement.integration.test.js
- [ ] **Step 2: Run move-out and transfer test suite**
  Run: 
pm --prefix Capstone-Website/server test -- utils/tenantActionService.transferThenRenewMoveOut.integration.test.js
- [ ] **Step 3: Commit verification**
