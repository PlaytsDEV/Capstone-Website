# 100% Code Review Polish & Invariant Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Achieve a 100/100 score across all five code review axes by refactoring alert banners in `ReservationDetailsModal.jsx` to use neutral 1px solid borders, updating the Move-In auto-settle payment method fallback in `reservationLifecycleController.js` to `"offline_cash"`, increasing batch rent billing chunk size to 10 in `rentBillingController.js`, and removing redundant document saves in `billSettlement.js`.

**Architecture:** 
- In `ReservationDetailsModal.jsx`, replace inline `#FDE68A` and `#FECACA` border and background styles on the Move-In locked alert containers with standard neutral Tailwind tokens (`border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-lg p-3`), letting semantic color reside solely in the SVG icon and text.
- In `reservationLifecycleController.js`, normalize incoming payment methods and enforce `"offline_cash"` fallback to align with `PAYMENT_METHODS` in `server/config/paymentMethods.js` and `Bill.js`.
- In `rentBillingController.js`, increase `CHUNK_SIZE` from 5 to 10 in `generateBatchRentBills` for doubled parallel throughput.
- In `billSettlement.js`, streamline `settleInitialMoveInOnCheckIn` to rely on `applyBillPayment` and avoid duplicate `bill.save()` operations.

**Tech Stack:** React, Tailwind CSS / Custom HSL tokens, Node.js (ES Modules), Express.js, MongoDB/Mongoose, Jest.

**Spec:** [LILYCREST_WEB_BILLING_DETAILED_FLOW.md](file:///d:/Portfolio/3rdYear/CapstoneSystem/LILYCREST_WEB_BILLING_DETAILED_FLOW.md)

## Global Constraints
- Strictly enforce Terminology Invariants: **Tenant** (never Resident), **Assistant** (never Copilot), **Owner** (never Super Admin), **Rent** (never Rental Fee).
- Strictly adhere to Design Token Invariants: Flat plain colors, neutral 1px solid borders (`1px solid var(--border)` / `border-slate-200 dark:border-slate-700`), strictly NO gradients, and NO colored border outlines on alert banners or status cards.
- Strictly enforce valid payment method enums from `PAYMENT_METHODS` (`offline_cash`, `offline_bank_transfer`, `gcash`, `paymongo`, etc.) and prohibit raw `"cash"`.

---

### What to Expect from These Changes

- **Visual & Interface Outcomes**: Alert cards in the Reservation Details Modal will look crisp, modern, and aligned with enterprise flat design tokens. They will feature clean neutral 1px borders without yellow or red tinted outlines.
- **Functional Outcomes**: Move-in check-in will automatically settle initial bills using the valid `"offline_cash"` enum without triggering schema validation failures. Batch rent bill generation will process 10 tenants concurrently per chunk.
- **Workflow Outcomes**: Admins experience faster bulk billing and zero payment method reconciliation failures.

---

### Task 1: Refactor Alert Banners in Reservation Details Modal to Neutral Design Tokens

**Files:**
- Modify: `web/src/features/admin/components/ReservationDetailsModal.jsx:2120-2170`
- Test: `web/src/features/admin/components/ReservationDetailsModal.cancellationLock.test.mjs`

**Interfaces:**
- Consumes: Tailwind classes and HSL design tokens
- Produces: Accessible, neutral 1px border alert containers with semantic icons

- [ ] **Step 1: Update `ReservationDetailsModal.jsx` alert banner markup**

Replace lines ~2125-2165 in `web/src/features/admin/components/ReservationDetailsModal.jsx`:

```jsx
                        {cancellationPending && (
                          <div className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs shadow-2xs">
                            <AlertTriangle size={15} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                            <span className="text-slate-700 dark:text-slate-300 leading-relaxed">
                              <strong className="text-slate-900 dark:text-slate-100">Move-In Locked:</strong> A tenant cancellation request is pending review. Review and resolve (Approve or Reject) the cancellation request above before moving in the tenant.
                            </span>
                          </div>
                        )}
                        {!cancellationPending && !isMoveInPaymentSettled && (
                          <div className="flex items-start gap-2.5 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs shadow-2xs">
                            <AlertTriangle size={15} className="shrink-0 mt-0.5 text-rose-600 dark:text-rose-400" />
                            <span className="text-slate-700 dark:text-slate-300 leading-relaxed">
                              <strong className="text-slate-900 dark:text-slate-100">Move-In Locked:</strong> 1-Month Advance & Deposit (1DP + 1Adv) settlement is pending.
                            </span>
                          </div>
                        )}
```

- [ ] **Step 2: Run frontend test to verify modal rendering**

Run:
```powershell
node web/src/features/admin/components/ReservationDetailsModal.cancellationLock.test.mjs
```
Expected: PASS

- [ ] **Step 3: Commit changes**

```bash
git add web/src/features/admin/components/ReservationDetailsModal.jsx
git commit -m "fix(ui): align move-in lock alert banners to neutral 1px border design tokens"
```

---

### Task 2: Align Move-In Payment Method Enum & Settlement Persistence

**Files:**
- Modify: `server/controllers/reservations/reservationLifecycleController.js:698-715`
- Modify: `server/services/billing/billSettlement.js:180-195`
- Test: `server/services/billing/billSettlement.moveInAutoSettle.test.js`

**Interfaces:**
- Consumes: `PAYMENT_METHODS` from `server/config/paymentMethods.js`
- Produces: Strict `"offline_cash"` fallback for move-in check-in auto-settlement

- [ ] **Step 1: Update payment method fallback in `reservationLifecycleController.js`**

In `server/controllers/reservations/reservationLifecycleController.js`:
```javascript
    if (isMoveInTransition) {
      try {
        const rawMethod = String(req.body.paymentMethod || "").trim().toLowerCase();
        const paymentMethod =
          rawMethod === "cash" || !rawMethod ? "offline_cash" : req.body.paymentMethod;

        await settleInitialMoveInOnCheckIn({
          reservation: updatedReservation,
          actorId,
          paymentMethod,
          now: new Date(),
        });
      } catch (settleErr) {
        logger.warn(
          { err: settleErr, reservationId: updatedReservation._id },
          "Failed to auto-settle initial move-in bill on check-in",
        );
      }
    }
```

- [ ] **Step 2: Streamline `settleInitialMoveInOnCheckIn` in `billSettlement.js`**

In `server/services/billing/billSettlement.js`:
```javascript
  const amountToSettle = Number(bill.remainingAmount || bill.totalAmount || 0);
  const normalizedMethod =
    paymentMethod === "cash" || !paymentMethod ? "offline_cash" : paymentMethod;

  const paymentResult = await applyBillPayment({
    bill,
    amount: amountToSettle,
    method: normalizedMethod,
    source: "admin-manual",
    referenceNumber: `MOVEIN-${resDoc._id.toString().slice(-6).toUpperCase()}`,
    recordedBy: actorId,
    metadata: {
      reservationId: String(resDoc._id),
      reason: "Settled upon move-in check-in",
    },
    now,
  });

  resDoc.initialPaymentStatus = "paid";
  resDoc.paymentStatus = "paid_in_full";
  resDoc.isMoveInSettled = true;
  resDoc.initialPaymentSettledAt = now;
  if (typeof resDoc.save === "function") {
    await resDoc.save({ validateModifiedOnly: true });
  }

  await syncStructuredReservationAfterBillSettlement(bill);

  return {
    settled: true,
    bill,
    payment: paymentResult?.payment,
  };
```

- [ ] **Step 3: Run settlement tests**

Run:
```powershell
npm --prefix server test -- services/billing/billSettlement.moveInAutoSettle.test.js
```
Expected: PASS

- [ ] **Step 4: Commit changes**

```bash
git add server/controllers/reservations/reservationLifecycleController.js server/services/billing/billSettlement.js
git commit -m "fix(billing): enforce offline_cash enum and streamline move-in settlement persistence"
```

---

### Task 3: Tune Batch Concurrency Chunk Size & Run Verification Quality Gate

**Files:**
- Modify: `server/controllers/billing/rentBillingController.js`
- Test: `server/controllers/billing/rentBillingBatchController.test.js`

- [ ] **Step 1: Increase `CHUNK_SIZE` in `rentBillingController.js`**

In `server/controllers/billing/rentBillingController.js`:
```javascript
    const CHUNK_SIZE = 10;
```

- [ ] **Step 2: Run batch controller tests**

Run:
```powershell
npm --prefix server test -- controllers/billing/rentBillingBatchController.test.js
```
Expected: PASS (5/5 tests passing)

- [ ] **Step 3: Run comprehensive backend test suite**

Run:
```powershell
npm --prefix server test
```
Expected: PASS (286/286 test suites passing)

- [ ] **Step 4: Run frontend production build**

Run:
```powershell
npm --prefix web run build
```
Expected: Build succeeds with 0 errors.

- [ ] **Step 5: Commit changes**

```bash
git add server/controllers/billing/rentBillingController.js
git commit -m "perf(billing): tune batch rent billing chunk size to 10 for optimal parallel throughput"
```
