# Friendly UX & Typography Refinement for Step 4 Checkout Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Step 4 Checkout Card in [`ReservationPaymentStep.jsx`](file:///d:/Portfolio/3rdYear/CapstoneSystem/Capstone-Website/web/src/features/tenant/pages/reservation-steps/ReservationPaymentStep.jsx) and [`reservation-flow.css`](file:///d:/Portfolio/3rdYear/CapstoneSystem/Capstone-Website/web/src/features/tenant/styles/reservation-flow.css) into a warm, approachable, and friendly reservation summary by softening all-caps labels to Title Case, removing redundant cutoff lines, and explicitly labeling the total line as "Total Due Today: PHP 2,000" with "Slot Reservation Fee" subtext.

**Architecture:** Update React JSX in `ReservationPaymentStep.jsx` and CSS classes in `reservation-flow.css`. Maintain test coverage in [`ReservationPaymentStep.layout.test.mjs`](file:///d:/Portfolio/3rdYear/CapstoneSystem/Capstone-Website/web/src/features/tenant/pages/reservation-steps/ReservationPaymentStep.layout.test.mjs).

**Tech Stack:** React 19, Tailwind CSS / HSL Custom CSS Tokens, Lucide-React, Node test runner (`node scripts/run-tests.mjs`).

**Spec:** Friendly UX Alignment (2026-08-28) & [`LILYCREST_RESERVATION_FEE_SETTLEMENT_SPEC.md`](file:///d:/Portfolio/3rdYear/CapstoneSystem/LILYCREST_RESERVATION_FEE_SETTLEMENT_SPEC.md).

## Global Constraints

- **Typography Invariant 1**: Summary row labels must use Title Case (`Room`, `Bed Slot`, `Intended Move-In Date`, `Lease Duration`, `Monthly Stay Rate`) — no rigid `text-transform: uppercase`.
- **Payment Invariant 2**: Total line must explicitly read `"Total Due Today"` with subtext `"Slot Reservation Fee"` to avoid any confusion with future monthly rent.
- **Visual Design Rules**: Strictly flat solid HSL colors, 1px neutral borders (`border-slate-200 dark:border-slate-700` / `1px solid var(--border)`), no background gradients, no colored outlines, and no cutoff divider lines under payment channels.

---

## 🎯 What to Expect from These Changes

In plain terms, here is what will change visually and functionally once this plan is executed:
1. **Warm and Approachable Typography**: The summary row labels will no longer look like a harsh tax invoice. They will use natural, friendly Title Case (`Room`, `Bed Slot`, `Intended Move-In Date`, `Lease Duration`, `Monthly Stay Rate`).
2. **Instant "Due Today" Clarity**: The total row will clearly say **"Total Due Today: PHP 2,000"** with a gentle note below it saying *"Slot Reservation Fee"*. Applicants will immediately know that only ₱2,000 is due now, not the ₱6,700 monthly stay rate.
3. **De-Cluttered Layout**: The extra horizontal cut-off line beneath the payment channels will be removed so that `GCash`, `Maya`, and `Cards` act as clean trust badges flowing directly into the green payment button.
4. **Symmetrical, Balanced Surfaces**: The Summary container and Policy container will share matching rounded corners (`rounded-xl`) and subtle 1px slate borders for visual harmony.

---

## 📋 Summary Table of Tasks

| Task | Component / File | Purpose / Deliverable | Status |
| :--- | :--- | :--- | :--- |
| **Task 1** | `ReservationPaymentStep.layout.test.mjs` | Automated regression tests for Title Case labels and "Total Due Today" | Pending |
| **Task 2** | `ReservationPaymentStep.jsx` | React component updates (Title Case labels, "Total Due Today" total row) | Pending |
| **Task 3** | `reservation-flow.css` | CSS updates (remove uppercase transform, remove cutoff border-bottom) | Pending |
| **Task 4** | Build & Test Suite Verification | Full verification via `npm test` and `npm run build` | Pending |

---

### Task 1: Update Terminology & Friendliness Regression Tests

**Files:**
- Modify: `Capstone-Website/web/src/features/tenant/pages/reservation-steps/ReservationPaymentStep.layout.test.mjs`
- Test: `Capstone-Website/web/src/features/tenant/pages/reservation-steps/ReservationPaymentStep.layout.test.mjs`

**Interfaces:**
- Consumes: `ReservationPaymentStep.jsx`
- Produces: Assertions for Title Case labels and "Total Due Today" total row.

- [ ] **Step 1: Write the updated test assertions**

Update `ReservationPaymentStep.layout.test.mjs`:

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const componentPath = path.resolve(__dirname, "ReservationPaymentStep.jsx");

test("ReservationPaymentStep: adheres strictly to friendly typography and hierarchy invariants", () => {
  const code = fs.readFileSync(componentPath, "utf-8");

  // 1. Prohibit legacy confusing terms
  assert.ok(!code.includes("Initial Reservation Deposit"), 'Must not use "Initial Reservation Deposit"');
  assert.ok(!code.includes("pre-move-in balance"), 'Must not use "pre-move-in balance"');
  assert.ok(!code.includes("I understand that the"), 'Must use formal "I acknowledge that the"');

  // 2. Enforce friendly Title Case labels & Total Due Today
  assert.ok(code.includes("Total Due Today"), 'Total row must clearly state "Total Due Today"');
  assert.ok(code.includes("Slot Reservation Fee"), 'Must retain "Slot Reservation Fee" as sub-descriptor');
  assert.ok(code.includes("Accepted Payment Methods:"), 'Payment methods label must be "Accepted Payment Methods:"');
  assert.ok(code.includes("Bed Slot"), 'Bed label should be friendly "Bed Slot"');
  assert.ok(code.includes("Lease Duration"), 'Lease label should be "Lease Duration"');

  // 3. Enforce unified policy container structure
  assert.ok(code.includes("rf-policy-unified-card"), 'Must wrap policy rows in "rf-policy-unified-card"');
  assert.ok(code.includes("rf-policy-credit-row"), 'Must have "rf-policy-credit-row"');
  assert.ok(code.includes("rf-policy-divider"), 'Must have "rf-policy-divider"');
  assert.ok(code.includes("rf-policy-check-row"), 'Must have "rf-policy-check-row"');

  // 4. Enforce sequence: Unified Policy -> Payment Methods Bar -> Pay Button
  const policyIndex = code.indexOf("rf-policy-unified-card");
  const methodsIndex = code.indexOf("rf-payment-methods-bar");
  const buttonIndex = code.indexOf("btn-pay-online-reservation");

  assert.ok(policyIndex > 0, "Policy card must exist");
  assert.ok(methodsIndex > policyIndex, "Payment methods must appear after policy container");
  assert.ok(buttonIndex > methodsIndex, "Pay button must appear after payment methods");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node web/src/features/tenant/pages/reservation-steps/ReservationPaymentStep.layout.test.mjs`
Expected: FAIL on missing "Total Due Today" / "Accepted Payment Methods:".

---

### Task 2: Refactor `ReservationPaymentStep.jsx` for Friendly Typography & "Total Due Today"

**Files:**
- Modify: `Capstone-Website/web/src/features/tenant/pages/reservation-steps/ReservationPaymentStep.jsx`
- Test: `Capstone-Website/web/src/features/tenant/pages/reservation-steps/ReservationPaymentStep.layout.test.mjs`

**Interfaces:**
- Consumes: `ReservationPaymentStep.jsx`
- Produces: Friendly Title Case labels and clear "Total Due Today" total row.

- [ ] **Step 1: Update JSX labels and total row in `ReservationPaymentStep.jsx`**

- Line 237: `<span className="rf-uc-label">Bed Slot</span>`
- Line 249: `<span className="rf-uc-label">Intended Move-In Date</span>`
- Line 261: `<span className="rf-uc-label">Lease Duration</span>`
- Line 331: `<span className="rf-uc-label">Monthly Stay Rate</span>`
- Line 346-353:
```jsx
<div className="rf-uc-summary-row rf-uc-total-row">
  <div className="rf-uc-row-left">
    <div>
      <span className="rf-uc-total-label block">Total Due Today</span>
      <span className="text-[11px] text-slate-500 dark:text-slate-400 font-normal block">
        Slot Reservation Fee
      </span>
    </div>
  </div>
  <div className="rf-uc-row-right">
    <span className="rf-uc-total-amount whitespace-nowrap">{formatCurrency(reservationFeeAmount)}</span>
  </div>
</div>
```
- Line 425: `<span className="rf-payment-methods-label">Accepted Payment Methods:</span>`

- [ ] **Step 2: Run test to verify JSX updates pass**

Run: `node web/src/features/tenant/pages/reservation-steps/ReservationPaymentStep.layout.test.mjs`
Expected: PASS.

---

### Task 3: Refactor `reservation-flow.css` for Soft Labels & Clean Spacing

**Files:**
- Modify: `Capstone-Website/web/src/features/tenant/styles/reservation-flow.css`
- Test: `Capstone-Website/web/src/shared/lib/designInvariants.test.mjs`

**Interfaces:**
- Consumes: CSS classes `.rf-uc-label`, `.rf-payment-methods-bar`, `.rf-payment-methods-label`.
- Produces: Approchable Title Case typography, removal of unnecessary border cutoff lines.

- [ ] **Step 1: Update CSS rules in `reservation-flow.css`**

- Remove `text-transform: uppercase` and tracking from `.rf-uc-label`:
```css
.rf-uc-label {
  font-weight: 600;
  font-size: 13px;
  color: var(--muted-foreground, #64748B);
}
```
- Update `.rf-payment-methods-bar` to remove `border-bottom: 1px solid var(--rf-border);` and soften label:
```css
.rf-payment-methods-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  border-bottom: none;
  padding-bottom: 0;
}

.rf-payment-methods-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted-foreground, #64748B);
  white-space: nowrap;
}
```

- [ ] **Step 2: Run design invariants test**

Run: `node web/src/shared/lib/designInvariants.test.mjs`
Expected: PASS.

---

### Task 4: Automated Build & Full Regression Verification

**Files:**
- Test: `Capstone-Website/web` full test suite and build check.

- [ ] **Step 1: Run complete web test suite**

Run: `npm test` in `Capstone-Website/web`
Expected: All 678+ tests pass.

- [ ] **Step 2: Run web production build check**

Run: `npm run build` in `Capstone-Website/web`
Expected: Vite build succeeds with 0 errors.
