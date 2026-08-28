# Slot Reservation Fee Payment (Step 4) Hierarchy and Terminology Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor Step 4 of the Room Reservation Flow to eliminate terminology confusion between "deposit" and "reservation fee", unify the credit notice and non-refundable agreement into a single cohesive policy container, and optimize the vertical hierarchy leading into the PayMongo checkout action.

**Architecture:** Update the React component [`ReservationPaymentStep.jsx`](file:///d:/Portfolio/3rdYear/CapstoneSystem/Capstone-Website/web/src/features/tenant/pages/reservation-steps/ReservationPaymentStep.jsx) and its stylesheet [`reservation-flow.css`](file:///d:/Portfolio/3rdYear/CapstoneSystem/Capstone-Website/web/src/features/tenant/styles/reservation-flow.css). Add a dedicated regression test suite [`ReservationPaymentStep.layout.test.mjs`](file:///d:/Portfolio/3rdYear/CapstoneSystem/Capstone-Website/web/src/features/tenant/pages/reservation-steps/ReservationPaymentStep.layout.test.mjs) verifying terminology invariants and hierarchy sequencing.

**Tech Stack:** React 19, Tailwind CSS / HSL Custom CSS Tokens, Lucide-React, Node test runner (`node scripts/run-tests.mjs`).

**Spec:** [`LILYCREST_RESERVATION_FEE_SETTLEMENT_SPEC.md`](file:///d:/Portfolio/3rdYear/CapstoneSystem/LILYCREST_RESERVATION_FEE_SETTLEMENT_SPEC.md) & Design Alignment Session (2026-08-28).

## Global Constraints

- **Terminology Invariant 1**: Always use "Slot Reservation Fee" or "Reservation Fee" — NEVER "Initial Reservation Deposit", "Rental Fee", or raw "Deposit" in reservation contexts.
- **Terminology Invariant 2**: Always use "Move-In Balance" — NEVER "Pre-Move-In Balance".
- **Terminology Invariant 3**: Checkbox policy text MUST be: *"I acknowledge that the **PHP 2,000** reservation fee is non-refundable."*
- **Visual Design Rules**: Strictly no background or button gradients; 1px solid neutral borders (`border-slate-200 dark:border-slate-700` / `1px solid var(--border)`); standalone semantic icons without colored background circles.
- **Hierarchy Sequencing**:
  1. Room & Rate Summary Breakdown
  2. Unified Reservation Policy & Terms Container (Credit Reassurance row + subtle divider + Acknowledgement Checkbox row)
  3. Accepted Payment Channels (`GCash`, `Maya`, `Cards` as trust badges)
  4. Primary CTA Button (`Pay PHP 2,000 Securely` + subtle hint note when disabled)

---

## 🎯 What to Expect from These Changes

In plain terms, here is what will change visually and functionally once this plan is executed:
1. **Clear and Consistent Terms**: The entire screen will uniformly use the term **"Slot Reservation Fee"** instead of mixing "deposit" with "reservation fee", preventing any confusion with the 1-month Security Deposit.
2. **Unified Policy & Terms Box**: The green credit reassurance message (*"100% credited toward your move-in balance"*) and the non-refundable agreement checkbox will be merged into a single, clean slate-bordered container with a subtle divider line.
3. **Smooth, Logical Reading Flow**:
   - First, the applicant reviews the **Room & Fee Summary**.
   - Second, they read the **Unified Reservation Policy & Terms** and check the acknowledgement box.
   - Third, they see the **Accepted Payment Methods** (`GCash`, `Maya`, `Cards`) as trust badges right above the payment button.
   - Fourth, they click the primary button **"Pay PHP 2,000 Securely"**.
4. **Clean Enterprise Styling**: Strictly solid HSL colors, 1px neutral borders (`border-slate-200 dark:border-slate-700`), zero background gradients, and standalone semantic icons.

---

## 📋 Summary Table of Tasks

| Task | Component / File | Purpose / Deliverable | Status |
| :--- | :--- | :--- | :--- |
| **Task 1** | `ReservationPaymentStep.layout.test.mjs` | Automated layout & terminology invariant regression test suite | Pending |
| **Task 2** | `ReservationPaymentStep.jsx` | React component refactoring with unified policy container & refined terminology | Pending |
| **Task 3** | `reservation-flow.css` | CSS styling for unified policy container, divider, trust badges, and dark mode | Pending |
| **Task 4** | Build & Test Suite Verification | Full verification via `npm test` and `npm run build` | Pending |

---

### Task 1: Create Terminology & Hierarchy Regression Tests

**Files:**
- Create: `Capstone-Website/web/src/features/tenant/pages/reservation-steps/ReservationPaymentStep.layout.test.mjs`
- Test: `Capstone-Website/web/src/features/tenant/pages/reservation-steps/ReservationPaymentStep.layout.test.mjs`

**Interfaces:**
- Consumes: `ReservationPaymentStep.jsx`
- Produces: Layout and terminology unit tests validating the required strings and DOM hierarchy sequence.

- [ ] **Step 1: Write the failing test**

Create `ReservationPaymentStep.layout.test.mjs` with assertions ensuring:
- Header and hero labels use "Slot Reservation Fee", not "Initial Reservation Deposit".
- Deductible credit note says "credited toward your move-in balance upon check-in", not "pre-move-in balance".
- Policy text uses "I acknowledge that the PHP 2,000 reservation fee is non-refundable."
- Policy container classes and sequence are structured in the agreed order.

```javascript
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const componentPath = path.resolve(__dirname, "ReservationPaymentStep.jsx");

test("ReservationPaymentStep: adheres strictly to authoritative terminology and hierarchy invariants", () => {
  const code = fs.readFileSync(componentPath, "utf-8");

  // 1. Prohibit legacy confusing terms
  assert.ok(!code.includes("Initial Reservation Deposit"), 'Must not use "Initial Reservation Deposit"');
  assert.ok(!code.includes("pre-move-in balance"), 'Must not use "pre-move-in balance"');
  assert.ok(!code.includes("I understand that the"), 'Must use formal "I acknowledge that the"');

  // 2. Enforce authoritative terms
  assert.ok(code.includes("Slot Reservation Fee"), 'Must use "Slot Reservation Fee"');
  assert.ok(code.includes("move-in balance upon check-in"), 'Must say "move-in balance upon check-in"');
  assert.ok(code.includes("I acknowledge that the"), 'Must use "I acknowledge that the"');

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
Expected: FAIL due to existing terminology and class structure.

- [ ] **Step 3: Commit initial test**

```bash
git add web/src/features/tenant/pages/reservation-steps/ReservationPaymentStep.layout.test.mjs
git commit -m "test(tenant): add layout and terminology invariant test for ReservationPaymentStep"
```

---

### Task 2: Refactor `ReservationPaymentStep.jsx` Component Hierarchy & Terminology

**Files:**
- Modify: `Capstone-Website/web/src/features/tenant/pages/reservation-steps/ReservationPaymentStep.jsx`
- Test: `Capstone-Website/web/src/features/tenant/pages/reservation-steps/ReservationPaymentStep.layout.test.mjs`

**Interfaces:**
- Consumes: Props `reservationData`, `agreedToFeePolicy`, `setAgreedToFeePolicy`, `onPayOnline`, etc.
- Produces: Optimized JSX rendering with unified policy card and reordered trust badges.

- [ ] **Step 1: Update terminology in header, hero banner, summary rows, and notices**

In `ReservationPaymentStep.jsx`:
- Line 168: `<span>Initial Reservation Deposit</span>` -> `<span>Slot Reservation Fee</span>`
- Line 171-172: `"Pay the one-time initial reservation deposit to secure your room. 100% credited toward your pre-move-in balance."` -> `"Pay the one-time reservation fee to secure your room. 100% credited toward your move-in balance."`
- Line 198: `"Your initial reservation deposit of..."` -> `"Your slot reservation fee of..."`
- Line 208: `<span className="rf-uc-hero-label">Initial Reservation Deposit</span>` -> `<span className="rf-uc-hero-label">Slot Reservation Fee</span>`
- Line 212: `<div className="rf-uc-hero-subbadge">100% Credited Toward Pre-Move-In Balance</div>` -> `<div className="rf-uc-hero-subbadge">100% Credited Toward Move-In Balance</div>`
- Line 348: `<span className="rf-uc-total-label">Initial Reservation Deposit</span>` -> `<span className="rf-uc-total-label">Slot Reservation Fee</span>`

- [ ] **Step 2: Unify Credit Notice and Policy Checkbox into `rf-policy-unified-card` and reorder Payment Methods**

Replace the separated credit reassurance box and checkbox markup with:

```jsx
{/* Unified Reservation Policy & Terms Container */}
<div className="rf-policy-unified-card">
  {/* Credit Reassurance Row */}
  <div className="rf-policy-credit-row">
    <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" aria-hidden="true" />
    <span className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
      This <strong>{formatCurrency(reservationFeeAmount)}</strong> reservation fee will be automatically credited toward your move-in balance upon check-in.
    </span>
  </div>

  <div className="rf-policy-divider" aria-hidden="true" />

  {/* Non-Refundable Fee Policy Checkbox Row */}
  <div
    className={`rf-policy-check-row ${agreedToFeePolicy ? "is-checked" : ""} ${
      isLoading || payingOnline ? "is-disabled" : ""
    }`}
    role="checkbox"
    aria-checked={Boolean(agreedToFeePolicy)}
    tabIndex={isLoading || payingOnline ? -1 : 0}
    onKeyDown={(e) => {
      if ((e.key === " " || e.key === "Enter") && !isLoading && !payingOnline) {
        e.preventDefault();
        setAgreedToFeePolicy(!agreedToFeePolicy);
      }
    }}
    onClick={() => {
      if (!isLoading && !payingOnline) {
        setAgreedToFeePolicy(!agreedToFeePolicy);
      }
    }}
  >
    <div className="rf-policy-checkbox-wrapper">
      <input
        type="checkbox"
        id="agreedToFeePolicy"
        checked={Boolean(agreedToFeePolicy)}
        onChange={(e) => setAgreedToFeePolicy(e.target.checked)}
        disabled={isLoading || payingOnline}
        tabIndex={-1}
        className="rf-policy-checkbox"
      />
      <div className="rf-policy-custom-check" aria-hidden="true">
        {agreedToFeePolicy && <Check size={12} strokeWidth={3.5} />}
      </div>
    </div>
    <label htmlFor="agreedToFeePolicy" className="rf-policy-label" onClick={(e) => e.stopPropagation()}>
      <span>
        I acknowledge that the <strong className="whitespace-nowrap">{formatCurrency(reservationFeeAmount)}</strong> reservation fee is non-refundable.
      </span>
    </label>
  </div>
</div>

{/* Accepted Payment Channels (Positioned directly above primary CTA) */}
<div className="rf-payment-methods-bar">
  <span className="rf-payment-methods-label">Accepted Online Methods:</span>
  <div className="rf-payment-methods-pills">
    <span className="rf-pay-pill">GCash</span>
    <span className="rf-pay-pill">Maya</span>
    <span className="rf-pay-pill">Cards</span>
  </div>
</div>

{/* Minimalist State Hint (When unchecked) */}
{!agreedToFeePolicy && (
  <div className="rf-payment-footer-note" id="reservation-payment-help">
    <p className="rf-hint-text-minimal">
      Please check the policy box above to proceed.
    </p>
  </div>
)}

{/* Pay Button */}
<button
  onClick={handlePayClick}
  className={`btn btn-success btn-pay-online-reservation ${payingOnline ? "is-loading" : ""} ${!canPay ? "is-disabled-btn" : ""}`}
  disabled={!canPay}
  aria-describedby="reservation-payment-help"
  title={
    !agreedToFeePolicy
      ? "Please acknowledge the non-refundable fee policy above to proceed"
      : !paymentAvailable
      ? "Payment is locked pending application review"
      : ""
  }
>
  {payingOnline ? (
    <span className="rf-pay-btn-inner rf-pay-btn-icon">
      <RefreshCw size={18} className="rf-spin" aria-hidden="true" />
      <span>Redirecting to PayMongo...</span>
    </span>
  ) : (
    <span className="rf-pay-btn-inner rf-pay-btn-icon">
      <CreditCard size={18} aria-hidden="true" />
      <span className="whitespace-nowrap">{payButtonLabel}</span>
      <ChevronRight size={18} aria-hidden="true" />
    </span>
  )}
</button>
```

- [ ] **Step 3: Run the test to verify JSX updates pass**

Run: `node web/src/features/tenant/pages/reservation-steps/ReservationPaymentStep.layout.test.mjs`
Expected: PASS.

- [ ] **Step 4: Commit component updates**

```bash
git add web/src/features/tenant/pages/reservation-steps/ReservationPaymentStep.jsx
git commit -m "feat(tenant): update ReservationPaymentStep hierarchy and terminology"
```

---

### Task 3: Update CSS Styles in `reservation-flow.css`

**Files:**
- Modify: `Capstone-Website/web/src/features/tenant/styles/reservation-flow.css`
- Test: `Capstone-Website/web/src/shared/lib/designInvariants.test.mjs`

**Interfaces:**
- Consumes: CSS class names `.rf-policy-unified-card`, `.rf-policy-credit-row`, `.rf-policy-divider`, `.rf-policy-check-row`.
- Produces: High-contrast, clean 1px neutral border styling for the unified policy card, hover states, and responsive spacing.

- [ ] **Step 1: Add CSS rules for unified policy card and rows**

In `reservation-flow.css`, replace `.rf-policy-ack-box` styling with cohesive classes:

```css
/* ============ UNIFIED POLICY & TERMS CONTAINER ============ */
.rf-policy-unified-card {
  display: flex;
  flex-direction: column;
  border-radius: 12px;
  border: 1px solid var(--border, #E2E8F0);
  background: var(--surface-muted, #F8FAFC);
  overflow: hidden;
  margin: 4px 0 12px 0;
  transition: border-color 0.2s ease, background-color 0.2s ease;
}

:is(.dark *) .rf-policy-unified-card {
  background: rgba(30, 41, 59, 0.35);
  border-color: var(--border, #334155);
}

.rf-policy-credit-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
}

.rf-policy-divider {
  width: 100%;
  height: 1px;
  background: var(--border, #E2E8F0);
}

:is(.dark *) .rf-policy-divider {
  background: var(--border, #334155);
}

.rf-policy-check-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  cursor: pointer;
  background: transparent;
  transition: background-color 0.15s ease;
}

.rf-policy-check-row:hover {
  background: var(--surface-hover, #F1F5F9);
}

:is(.dark *) .rf-policy-check-row:hover {
  background: rgba(30, 41, 59, 0.55);
}

.rf-policy-check-row.is-checked {
  background: rgba(241, 245, 249, 0.6);
}

:is(.dark *) .rf-policy-check-row.is-checked {
  background: rgba(30, 41, 59, 0.45);
}

.rf-policy-check-row.is-disabled {
  opacity: 0.55;
  cursor: not-allowed;
  pointer-events: none;
}
```

- [ ] **Step 2: Run design invariant tests**

Run: `node web/src/shared/lib/designInvariants.test.mjs`
Expected: PASS (verifies zero gradients, valid HSL/solid tokens, neutral borders).

- [ ] **Step 3: Commit CSS updates**

```bash
git add web/src/features/tenant/styles/reservation-flow.css
git commit -m "style(tenant): add unified policy card styles for Step 4 checkout"
```

---

### Task 4: Automated Build & Full Regression Verification

**Files:**
- Test: `Capstone-Website/web` full test suite and build.

- [ ] **Step 1: Run complete web test suite**

Run: `npm test` in `Capstone-Website/web`
Expected: All tests pass (678+ tests passing).

- [ ] **Step 2: Run web production build check**

Run: `npm run build` in `Capstone-Website/web`
Expected: Vite build succeeds with 0 errors.

- [ ] **Step 3: Perform visual and manual QA audit**

Verify that:
- Step 4 displays "Slot Reservation Fee" in all headers, hero tags, and summary rows.
- The unified policy container renders seamlessly with the credit notice on top and non-refundable checkbox on the bottom.
- Accepted payment methods (`GCash`, `Maya`, `Cards`) sit cleanly between the policy box and the pay button.
- Toggling the checkbox activates/deactivates the button smoothly.
