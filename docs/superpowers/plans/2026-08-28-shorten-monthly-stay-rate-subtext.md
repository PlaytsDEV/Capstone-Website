# Shorten Monthly Stay Rate Subtext Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shorten the subtext under "Monthly Stay Rate" in [`ReservationPaymentStep.jsx`](file:///d:/Portfolio/3rdYear/CapstoneSystem/Capstone-Website/web/src/features/tenant/pages/reservation-steps/ReservationPaymentStep.jsx) from 68 characters to ~38 characters so it renders as a single, neat, non-wrapping line.

**Architecture:** Update the JSX conditional template in `ReservationPaymentStep.jsx` to render:
- When appliances exist: `Starts Month 2 · Incl. ₱{amount}/mo appliances`
- When no appliances exist: `Starts Month 2 (excl. utilities)`
Verify with automated regression test [`ReservationPaymentStep.layout.test.mjs`](file:///d:/Portfolio/3rdYear/CapstoneSystem/Capstone-Website/web/src/features/tenant/pages/reservation-steps/ReservationPaymentStep.layout.test.mjs).

**Tech Stack:** React 19, Lucide-React, Node test runner (`node scripts/run-tests.mjs`).

---

## 🎯 What to Expect from These Changes

In plain terms, here is what will change visually:
1. **Single-Line Sleek Layout**: The description under "Monthly Stay Rate" will no longer break into 2 lines. It will fit on 1 crisp line.
2. **Clear Pricing & Timing**: The tenant will clearly see when rent starts (*"Starts Month 2"*) and that their appliance add-ons are included (*"Incl. ₱400/mo appliances"*).
3. **Consistent Row Height**: All summary rows (`Room`, `Bed Slot`, `Intended Move-In Date`, `Lease Duration`, `Monthly Stay Rate`) will have balanced, harmonious vertical spacing.

---

## 📋 Summary Table of Tasks

| Task | File | Purpose |
| :--- | :--- | :--- |
| **Task 1** | `ReservationPaymentStep.layout.test.mjs` | Update automated regression assertions for concise subtext |
| **Task 2** | `ReservationPaymentStep.jsx` | Update JSX subtext template for single-line rendering |
| **Task 3** | Full Test Suite & Build Check | Verify zero regressions via `npm test` |

---

### Task 1: Update Regression Tests

**Files:**
- Modify: `Capstone-Website/web/src/features/tenant/pages/reservation-steps/ReservationPaymentStep.layout.test.mjs`

- [ ] **Step 1: Write test assertion for concise subtext format**

```javascript
assert.ok(
  code.includes("Starts Month 2") &&
  code.includes("Incl. ₱") &&
  !code.includes("Starts on Month 2 (excludes utilities)"),
  "Subtext must use concise 'Starts Month 2 · Incl. ₱{applianceFees}/mo appliances' format"
);
```

- [ ] **Step 2: Run test to verify RED**

Run: `node web/src/features/tenant/pages/reservation-steps/ReservationPaymentStep.layout.test.mjs`

---

### Task 2: Implement Concise Subtext in `ReservationPaymentStep.jsx`

**Files:**
- Modify: `Capstone-Website/web/src/features/tenant/pages/reservation-steps/ReservationPaymentStep.jsx`

- [ ] **Step 1: Update Monthly Stay Rate subtext markup**

```jsx
{/* Monthly Stay Rate Row */}
<div className="rf-uc-summary-row">
  <div className="rf-uc-row-left items-start">
    <Wallet size={15} className="rf-uc-icon mt-0.5" />
    <div>
      <span className="rf-uc-label block">Monthly Stay Rate</span>
      <span className="text-[11px] text-slate-500 dark:text-slate-400 block mt-0.5 whitespace-nowrap">
        {pricingInfo.applianceFees > 0
          ? `Starts Month 2 · Incl. ₱${pricingInfo.applianceFees.toLocaleString()}/mo appliances`
          : "Starts Month 2 (excl. utilities)"}
      </span>
    </div>
  </div>
  <div className="rf-uc-row-right self-start pt-0.5">
    <span className="rf-uc-val-primary whitespace-nowrap">{pricingInfo.formattedMonthlyRate}</span>
  </div>
</div>
```

- [ ] **Step 2: Run test to verify GREEN**

Run: `node web/src/features/tenant/pages/reservation-steps/ReservationPaymentStep.layout.test.mjs`

---

### Task 3: Full Regression Suite Verification

- [ ] **Step 1: Run complete web test suite**

Run: `npm test` in `Capstone-Website/web`
Expected: 678 passing tests.
