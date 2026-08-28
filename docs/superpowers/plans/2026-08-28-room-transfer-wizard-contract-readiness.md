# Room Transfer 3-Step Guided Wizard & Legal Contract Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Room Transfer workflow in the Admin Workspace into a robust 3-step guided wizard that prepares the legal replacement contract, verifies the wet-signed document upload, records electricity meter readings, and executes the physical room transfer with prorated rent cutover atomically.

**Architecture:** 
- Frontend `TransferTenantModal` is expanded into an interactive 3-step wizard (Step 1: Room Selection & Contract Generation -> Step 2: Paperwork Review & Wet-Signed PDF Upload -> Step 3: Departure/Arrival Meter Readings & Physical Cutover).
- `reservationApi.js` connects to the backend `POST /api/reservations/:reservationId/transfer/prepare-contract` endpoint.
- `tenantActionService.js` and `contractService.js` ensure deposit carryover, prorated rent calculation, and atomic contract transition (`predecessor -> replaced`, `successor -> active`), while cancellation cleanly voids pending replacement drafts and releases destination bed locks.

**Tech Stack:** React 18, Vite, Lucide React, Tailwind CSS / HSL CSS tokens, Express.js, MongoDB / Mongoose, Jest / Vitest.

**Spec:** Documented in conversation transcript and verified against `server/services/contractRoomTransferActivationService.js`, `server/services/billing/roomTransferSettlement.js`, and `server/utils/tenantActionService.js`.

---

## Global Constraints

- **Strict Terminology**: Always use "Tenant" (never "Resident"), "Rent" (never "Rental Fee"), "Owner" (never "Super Admin"), and "Assistant" (never "Copilot").
- **UI Design System**: Solid HSL color tokens, strictly no background gradients, clean 1px neutral borders (`1px solid var(--border)` / `border-slate-200 dark:border-slate-700`), no colorful badge backgrounds or colored outlines.
- **Deposit & Advance Invariant**: Existing security deposits and advance rent carry over automatically; rental rate adjustments during mid-cycle moves are settled via prorated billing adjustment upon transfer confirmation.
- **Atomic Operations**: Physical room mutations (vacate old bed, occupy new bed, record meter anchor) and legal contract cutover must remain within the same MongoDB transaction session.

---

## What to Expect from These Changes

1. **Step 1 (Target Room & Contract Prep)**: The administrator selects the destination room and bed. The system computes the prorated rental rate and carries over the security deposit. Clicking "Prepare Replacement Contract" generates the official draft replacement contract without throwing `ROOM_TRANSFER_CONTRACT_NOT_PREPARED`.
2. **Step 2 (Sign & Upload Signed Contract)**: The administrator can download/print the draft PDF for the tenant to wet-sign. A quick-upload dropzone allows uploading the signed PDF directly in the modal, immediately marking the replacement contract as published.
3. **Step 3 (Meter Readings & Confirmation)**: Once the contract is verified, the administrator inputs the departure and opening electricity meter readings and clicks "Confirm Transfer", completing the move seamlessly.
4. **Cancellation Safety**: Dismissing or cancelling the pending transfer voids the unactivated replacement contract draft and releases the destination bed lock.

---

## Task Breakdown

### Task 1: Frontend API Client & Reservation Bridge

**Files:**
- Modify: `web/src/shared/api/reservationApi.js:400-430`
- Test: `web/src/shared/api/reservationApi.test.mjs`

**Interfaces:**
- Produces: `reservationApi.prepareTransferContract(reservationId, data)` -> `POST /api/reservations/:reservationId/transfer/prepare-contract`
- Produces: `reservationApi.cancelTransfer(reservationId)` -> `POST /api/reservations/:reservationId/cancel-transfer`

- [ ] **Step 1: Write the failing test for `reservationApi.prepareTransferContract`**

```javascript
// web/src/shared/api/reservationApi.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { reservationApi } from "./reservationApi.js";

test("reservationApi exports prepareTransferContract and cancelTransfer functions", () => {
  assert.equal(typeof reservationApi.prepareTransferContract, "function");
  assert.equal(typeof reservationApi.cancelTransfer, "function");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node web/src/shared/api/reservationApi.test.mjs`  
Expected: FAIL (functions not defined or missing export).

- [ ] **Step 3: Implement `prepareTransferContract` and verify `cancelTransfer` in `reservationApi.js`**

```javascript
// web/src/shared/api/reservationApi.js
  /**
   * Prepares the replacement Contract for a planned room transfer (admin only)
   */
  prepareTransferContract: (reservationId, data) =>
    authFetch(`/reservations/${reservationId}/transfer/prepare-contract`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  /**
   * Cancel an approved or pending room transfer and release target room lock
   */
  cancelTransfer: (reservationId) =>
    authFetch(`/reservations/${reservationId}/cancel-transfer`, {
      method: "POST",
    }),
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node web/src/shared/api/reservationApi.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/shared/api/reservationApi.js web/src/shared/api/reservationApi.test.mjs
git commit -m "feat(api): add prepareTransferContract and cancelTransfer endpoints to reservationApi"
```

---

### Task 2: Backend Transfer Cancellation & Contract Voiding Safety

**Files:**
- Modify: `server/utils/tenantActionService.js:1387-1416`
- Modify: `server/controllers/reservations/tenancyActionsController.js:957-1045`
- Test: `server/services/contractRoomTransferActivationService.integration.test.js`

**Interfaces:**
- Consumes: `cancelTransferStayWorkflow(reservationId, actorId)`
- Produces: Voids any pending successor `Contract` (`contractPurpose: "replacement"`, `status: "generated"|"ready_for_generation"|"published"`) with reason `"Transfer cancelled by admin/tenant"`.

- [ ] **Step 1: Write integration test for cancelling pending transfer contract**

```javascript
// In server/services/contractRoomTransferActivationService.integration.test.js
test("cancelTransferStayWorkflow voids unactivated replacement contract and releases target bed", async () => {
  // test implementation verifying Contract status becomes 'cancelled'
});
```

- [ ] **Step 2: Run test to verify failure**

Run: `npm test -- server/services/contractRoomTransferActivationService.integration.test.js`  
Expected: FAIL.

- [ ] **Step 3: Update `cancelTransferStayWorkflow` in `server/utils/tenantActionService.js`**

Ensure that when a transfer is cancelled, any replacement contracts chained to the stay with status not yet active are transitioned to `cancelled` and target bed locks are released.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- server/services/contractRoomTransferActivationService.integration.test.js`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/utils/tenantActionService.js server/controllers/reservations/tenancyActionsController.js server/services/contractRoomTransferActivationService.integration.test.js
git commit -m "fix(backend): void unactivated replacement contract on room transfer cancellation"
```

---

### Task 3: 3-Step Guided Transfer Wizard Component (`TransferTenantModal`)

**Files:**
- Modify: `web/src/features/admin/components/TenantWorkspaceModals.jsx:676-1050`
- Modify: `web/src/features/admin/styles/admin-tenants.css` (if stepper or upload dropzone styling tweaks needed)
- Test: `web/src/features/admin/components/TransferTenantModal.test.mjs`

**Interfaces:**
- Consumes: `reservationApi.prepareTransferContract`, `contractApi.uploadSignedContract` / `uploadFinalNotarizedContract`, `reservationApi.transfer`
- Produces: Complete 3-step UI wizard (`Step 1: Target Room & Prepare Contract`, `Step 2: Sign & Upload Document`, `Step 3: Meter Readings & Confirmation`).

- [ ] **Step 1: Write component unit test for stepper progression and contract gate**

```javascript
// web/src/features/admin/components/TransferTenantModal.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
// Validate wizard steps array and contract readiness validation logic
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node web/src/features/admin/components/TransferTenantModal.test.mjs`  
Expected: FAIL.

- [ ] **Step 3: Implement 3-Step Wizard in `TransferTenantModal`**

1. **Step 1 ("Target Room & Contract Prep")**:
   - Destination Room & Bed selector.
   - Financial Summary callout: displays new monthly rent, carryover security deposit, and estimated prorated rent adjustment.
   - Button: **"Prepare Replacement Contract"** (calls `reservationApi.prepareTransferContract`, receives `contractId` and `contractNumber`, then transitions to Step 2).
2. **Step 2 ("Sign & Upload Contract")**:
   - Contract summary banner showing contract number and `generated` status.
   - Actions: **"Download / Print Contract"** and direct file upload dropzone for the signed PDF (`contractApi.uploadFinalNotarizedContract`).
   - If contract is already published or upload completes: shows green check status and enables **"Next: Meter Readings"**.
3. **Step 3 ("Meter Readings & Review")**:
   - Departure room final meter reading & Target room opening meter reading with baseline checks.
   - Settlement calculation summary.
   - Button: **"Confirm Transfer"** (calls `onSubmit` -> `reservationApi.transfer`).

- [ ] **Step 4: Run component test to verify it passes**

Run: `node web/src/features/admin/components/TransferTenantModal.test.mjs`  
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/features/admin/components/TenantWorkspaceModals.jsx web/src/features/admin/components/TransferTenantModal.test.mjs
git commit -m "feat(ui): implement 3-step guided transfer wizard with contract preparation and wet-signed upload"
```

---

### Task 4: Workspace Integration, Query Invalidation & Error Handling

**Files:**
- Modify: `web/src/features/admin/pages/TenantsWorkspacePage.jsx:1250-1280`
- Modify: `web/src/features/admin/components/TenantDetailModal.jsx:1184-1224`

**Interfaces:**
- Coordinates `TransferTenantModal` callbacks, notifications, and React Query invalidation across both Tenants Directory and Tenant Details views.

- [ ] **Step 1: Verify modal invocation props in `TenantsWorkspacePage.jsx` and `TenantDetailModal.jsx`**
- [ ] **Step 2: Ensure cancellation properly invokes `reservationApi.cancelTransfer` when a prepared contract is abandoned**
- [ ] **Step 3: Run full web build and tests**

Run: `npm run build` in `web/`  
Expected: Build passes with zero syntax or bundle errors.

- [ ] **Step 4: Commit**

```bash
git add web/src/features/admin/pages/TenantsWorkspacePage.jsx web/src/features/admin/components/TenantDetailModal.jsx
git commit -m "feat(workspace): integrate 3-step room transfer wizard with query invalidation and cancellation handling"
```

---

## Verification & Manual QA Checklist

1. **Where to Go**: Navigate to `/admin/tenants` (Tenants Directory) or open a tenant detail dialog.
2. **Step-by-Step Actions**:
   - Locate an active, moved-in tenant.
   - Click the **"Transfer Room"** action.
   - **Step 1**: Choose an available room and bed. Observe the carryover deposit note and prorated rent preview. Click **"Prepare Replacement Contract"**.
   - **Step 2**: Observe that the contract is generated. Click **"Download / Print"** to verify the PDF. Upload the signed test PDF. Observe the verified status badge.
   - **Step 3**: Enter the departure meter reading and new room meter reading. Click **"Confirm Transfer"**.
3. **Expected Behavior**:
   - The tenant is successfully transferred to the target room and bed.
   - The new replacement contract becomes `active` (`isCurrent: true`), and the previous contract becomes `replaced`.
   - A prorated settlement bill is generated for any rent difference.
   - No `ROOM_TRANSFER_CONTRACT_NOT_PREPARED` errors occur.
4. **Boundary / Edge Cases**:
   - Click "Cancel" while in Step 2 -> verify that the prepared draft is voided and the destination bed remains available.
