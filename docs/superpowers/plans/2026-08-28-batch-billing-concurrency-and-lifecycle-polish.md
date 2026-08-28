# Batch Rent Billing Concurrency and Lifecycle Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate sequential N+1 latency in batch rent bill generation by chunking tenant reservations concurrently in groups of 5 with per-tenant error isolation, replace dynamic service imports with static imports in the lifecycle controller, and verify all unit tests and web builds pass cleanly.

**Architecture:** 
- In `rentBillingController.js`, divide the `reservationIds` array into chunks of 5 and process each chunk in parallel via `Promise.all()`. Wrap each item in an isolated `try/catch` block so individual errors (missing data, email delivery failure, duplicates) accumulate gracefully without halting subsequent tenants or batches.
- In `reservationLifecycleController.js`, elevate `settleInitialMoveInOnCheckIn` to a module-level static import to eliminate runtime dynamic import overhead during tenant move-in check-in transitions.
- Execute full backend test suites and frontend build checks to maintain 100% code quality and zero regressions.

**Tech Stack:** Node.js (ES Modules), Express.js, MongoDB/Mongoose, Jest/Supertest, React, Vite.

**Spec:** [LILYCREST_WEB_BILLING_DETAILED_FLOW.md](file:///d:/Portfolio/3rdYear/CapstoneSystem/LILYCREST_WEB_BILLING_DETAILED_FLOW.md)

## Global Constraints
- Strictly enforce Terminology Invariants: **Tenant** (never Resident), **Assistant** (never Copilot), **Owner** (never Super Admin), **Rent** (never Rental Fee).
- Strictly maintain atomic operations and per-tenant error resilience: a failure on one tenant bill must never crash the entire batch.
- Strictly maintain non-blocking Move-In transitions: check-in status updates must succeed even if detached initial bill auto-settlement requires background reconciliation.
- Strictly preserve solid HSL design tokens, 1px neutral borders, and transparent status badges with colored status dots.

---

### What to Expect from These Changes

- **Visual & Interface Outcomes**: The Admin Billing tab and Batch Rent Bill Generation modal will operate with noticeable speed improvements. Progress indicators and batch generation summaries (`generated`, `failed`, `warnings`) will display accurate counts cleanly.
- **Functional Outcomes**: Generating monthly rent bills for 10, 20, or 50 tenants will process 5x faster via concurrency chunking while maintaining 100% error isolation per tenant. Move-in check-in transitions at the front desk will execute instantly without module import latency.
- **Workflow Outcomes**: Admins can batch-bill whole dorm floors with confidence that no single invalid record will abort the entire operation.

---

### Task 1: Optimize Batch Rent Billing Concurrency with Chunking

**Files:**
- Modify: `server/controllers/billing/rentBillingController.js:418-510`
- Test: `server/controllers/billing/rentBillingBatchController.test.js`

**Interfaces:**
- Consumes: `loadRentReservationForAdmin`, `buildRentBillDraft`, `finalizeRentBill`, `formatBill` from `rentBillingController.js` / services
- Produces: `generateBatchRentBills` route handler responding with `{ success: true, summary: { total, generated, failed, errors }, bills, warnings }`

- [ ] **Step 1: Write the failing test for chunked batch execution and error isolation**

Add test assertions in `server/controllers/billing/rentBillingBatchController.test.js` ensuring that multiple reservation IDs are processed concurrently and that individual tenant failures are recorded in `summary.errors` without blocking successful bills.

```javascript
it("processes batch reservations concurrently with individual error isolation", async () => {
  const req = {
    body: {
      reservationIds: ["res-1", "res-2", "res-invalid", "res-3"],
      billingMonth: "2026-09-01",
      dueDate: "2026-09-10",
    },
    admin: { id: "admin-1", branch: "Main", isOwner: true },
  };
  const res = mockResponse();
  const next = jest.fn();

  await generateBatchRentBills(req, res, next);
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({
      success: true,
      summary: expect.objectContaining({
        total: 4,
        generated: 3,
        failed: 1,
      }),
    })
  );
});
```

- [ ] **Step 2: Run test to verify current behavior**

Run:
```powershell
npm test -- server/controllers/billing/rentBillingBatchController.test.js
```
Expected: PASS or FAIL depending on mock structure; verifies baseline batch handling.

- [ ] **Step 3: Implement chunked concurrency in `generateBatchRentBills`**

In `server/controllers/billing/rentBillingController.js`, update `generateBatchRentBills`:

```javascript
export const generateBatchRentBills = async (req, res, next) => {
  try {
    const admin = await getAdminInfo(req);
    const {
      reservationIds = [],
      billingMonth,
      dueDate,
      branch: requestedBranch,
    } = req.body || {};

    if (!Array.isArray(reservationIds) || reservationIds.length === 0) {
      return res.status(400).json({ error: "reservationIds array is required and cannot be empty." });
    }

    const branch =
      req.branchFilter || (admin.isOwner && requestedBranch ? requestedBranch : admin.branch);
    if (!branch) {
      return res.status(400).json({ error: "Branch is required." });
    }

    const summary = {
      total: reservationIds.length,
      generated: 0,
      failed: 0,
      errors: [],
    };
    const bills = [];
    const warnings = [];

    const CHUNK_SIZE = 5;
    for (let i = 0; i < reservationIds.length; i += CHUNK_SIZE) {
      const chunk = reservationIds.slice(i, i + CHUNK_SIZE);
      const results = await Promise.allSettled(
        chunk.map(async (reservationId) => {
          const reservation = await loadRentReservationForAdmin({ reservationId, branch });
          const draft = await buildRentBillDraft({
            reservation,
            branch,
            billingMonth,
            dueDate,
            rentAmount: null,
            notes: "Generated through multi-select rent batch billing.",
          });

          const result = await finalizeRentBill({
            req,
            admin,
            reservation,
            draft,
          });

          const tenantName =
            [reservation.userId?.firstName, reservation.userId?.lastName]
              .filter(Boolean)
              .join(" ")
              .trim() || "Tenant";

          const itemWarnings = [];
          if (result.delivery?.email?.status === "failed") {
            itemWarnings.push(`${tenantName}: email notification failed.`);
          }
          if (result.delivery?.pdf?.status === "failed") {
            itemWarnings.push(`${tenantName}: PDF generation failed.`);
          }

          return {
            bill: formatBill(result.bill),
            warnings: itemWarnings,
          };
        })
      );

      results.forEach((resItem, idx) => {
        const reservationId = chunk[idx];
        if (resItem.status === "fulfilled") {
          summary.generated += 1;
          bills.push(resItem.value.bill);
          if (resItem.value.warnings?.length) {
            warnings.push(...resItem.value.warnings);
          }
        } else {
          summary.failed += 1;
          summary.errors.push({
            reservationId,
            error: resItem.reason?.message || "Failed to generate bill",
          });
        }
      });
    }

    if (summary.generated > 0) {
      await logBillingAudit(req, {
        admin,
        action: "Generated Batch Rent Bills",
        severity: "info",
        entityType: "billing",
        branch,
        details: `Generated ${summary.generated} rent bill(s) via batch selection for branch ${branch} (Billing Month: ${billingMonth})`,
        metadata: {
          branch,
          billingMonth,
          summary,
          generatedCount: summary.generated,
        },
      });
    }

    return res.json({
      success: true,
      summary,
      bills,
      warnings,
    });
  } catch (error) {
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    next(error);
  }
};
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```powershell
npm test -- server/controllers/billing/rentBillingBatchController.test.js
```
Expected: PASS with all batch concurrency assertions green.

- [ ] **Step 5: Commit changes**

```bash
git add server/controllers/billing/rentBillingController.js server/controllers/billing/rentBillingBatchController.test.js
git commit -m "perf(billing): optimize batch rent billing with chunked concurrency and error isolation"
```

---

### Task 2: Clean Up Lifecycle Controller Dynamic Imports

**Files:**
- Modify: `server/controllers/reservations/reservationLifecycleController.js:1-30, 698-715`
- Test: `server/controllers/reservations/reservationLifecycleController.cancellationGuard.integration.test.js`
- Test: `server/services/billing/billSettlement.moveInAutoSettle.test.js`

**Interfaces:**
- Consumes: `settleInitialMoveInOnCheckIn` from `server/services/billing/billSettlement.js`
- Produces: Clean synchronous module resolution for move-in check-in auto-settlement

- [ ] **Step 1: Verify current move-in auto-settlement test**

Run:
```powershell
npm test -- server/services/billing/billSettlement.moveInAutoSettle.test.js
```
Expected: PASS

- [ ] **Step 2: Add static top-level import in `reservationLifecycleController.js`**

Add at the top of `server/controllers/reservations/reservationLifecycleController.js`:
```javascript
import { settleInitialMoveInOnCheckIn } from "../../services/billing/billSettlement.js";
```

Replace lines ~699-710:
```javascript
    if (isMoveInTransition) {
      try {
        await settleInitialMoveInOnCheckIn({
          reservation: updatedReservation,
          actorId,
          paymentMethod: req.body.paymentMethod || "cash",
          referenceNumber: req.body.referenceNumber || "",
        });
      } catch (settleErr) {
        console.error("Failed to auto-settle initial move-in bills:", settleErr);
      }
    }
```

- [ ] **Step 3: Run tests to verify move-in transitions and cancellation guards**

Run:
```powershell
npm test -- server/controllers/reservations/reservationLifecycleController.cancellationGuard.integration.test.js server/services/billing/billSettlement.moveInAutoSettle.test.js
```
Expected: PASS (0 failures)

- [ ] **Step 4: Commit changes**

```bash
git add server/controllers/reservations/reservationLifecycleController.js
git commit -m "refactor(lifecycle): replace dynamic import with static import for move-in bill settlement"
```

---

### Task 3: Full End-to-End Verification & Web Build Quality Gate

**Files:**
- All backend test files and frontend build artifacts

- [ ] **Step 1: Run comprehensive backend test suite**

Run:
```powershell
npm test
```
Expected: PASS with 0 test suite regressions.

- [ ] **Step 2: Run frontend production build**

Run:
```powershell
npm --prefix web run build
```
Expected: Build succeeds with 0 syntax or bundling errors.

- [ ] **Step 3: Commit and final signoff**

```bash
git status
```
Confirm all changes are clean and passing.
