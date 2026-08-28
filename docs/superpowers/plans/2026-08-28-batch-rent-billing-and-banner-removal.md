# Multi-Select Batch Rent Bill Generation & Dispatch Banner Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the sticky bottom dispatch ribbon ("X rent bills ready to dispatch") from the Rent Billing tab and replace manual single-item generation with a multi-select table interface that allows administrators to select multiple eligible tenants and generate rent bills in batch with a confirmation modal and error-isolated execution.

**Architecture:** 
1. **Backend**: Add a dedicated `generateBatchRentBills` controller in `server/controllers/billing/rentBillingController.js` and register `POST /api/billing/rent/generate-batch` in `server/routes/billingRoutes.js`.
2. **Frontend API**: Add `generateBatchRentBills` in `web/src/shared/api/billingApi.js`.
3. **UI Components**: Create `BatchGenerateRentBillsModal.jsx`, remove the legacy sticky dock from `RentBillingTab.jsx`, add a selectable checkbox column with master select-all header, and introduce a clean bulk actions bar.

**Tech Stack:** Express.js, MongoDB / Mongoose, React 19, Tailwind CSS / HSL Custom CSS Tokens, Lucide-React, Jest.

**Spec:** Requirement alignment and design interview (2026-08-28).

---

## Global Constraints

- **Terminology Invariants**: Always use **"Tenant"** (never "Resident"); **"Rent"** / **"Rent Billing"** (never "Rental Fee"); **"Due Date"**; **"Contract"**.
- **Anti-Banner Rule**: Strictly avoid hero banners, promotional callouts, or large announcement ribbons. Remove the dark sticky bottom dispatch ribbon.
- **Color Invariants**: Solid colors only — strictly no gradients. Green/Emerald for success/confirmed, Amber for pending, Blue for info, Red for critical/overdue, Slate for neutral. No colored outlines on badges.
- **Error Isolation**: Batch generation must process all selected valid tenants independently; individual failures must not roll back or block other successful bills, and a detailed summary of any failures must be returned.

---

## 🎯 What to Expect from These Changes

In plain and simple terms, here is what will change visually and functionally once this plan is executed:

1. **Clean Viewport (Sticky Banner Removed)**: The dark sticky bottom bar ("3 rent bills ready to dispatch / Send All Ready Bills") is completely gone, providing a clean table layout.
2. **Multi-Select Checkboxes on Rent Billing Table**:
   - A new checkbox column appears on the left side of the Rent Billing table.
   - The master checkbox in the header allows selecting or deselecting all eligible unbilled tenants currently displayed.
   - Individual checkboxes appear **only** for tenants who need a bill generated (status `Upcoming` or `Pending Generation` with valid contract rent). Tenants with missing rates or already-generated bills will not have checkboxes.
3. **Clean Bulk Action Bar**: When one or more tenants are checked, a compact action bar appears showing:
   - Number of tenants selected (e.g. `3 tenants selected`).
   - Total preview value of rent to be billed (e.g. `₱18,900.00`).
   - Primary action button: `Generate Rent Bills (3)`.
   - Secondary button: `Deselect All`.
4. **Batch Generation Preview Modal**: Clicking `Generate Rent Bills` opens a modal that lists the selected tenants, rooms, and rent amounts, along with the active billing period and due date, with a `Confirm & Generate (X) Bills` button.
5. **One-Click Execution & Instant Updates**: Confirming the modal generates the rent statements in batch, sends out tenant statement notices, refreshes the table with the new "Generated" / "Sent" statuses, and clears the selection.

---

## 📋 Summary Table of Tasks

| Task | Component / File | Purpose / Deliverable | Status |
| :--- | :--- | :--- | :--- |
| **Task 1** | `server/controllers/billing/rentBillingController.js` & `server/routes/billingRoutes.js` | Backend batch rent bill generation endpoint (`POST /api/billing/rent/generate-batch`) with unit tests | Pending |
| **Task 2** | `web/src/shared/api/billingApi.js` | Frontend API client method `generateBatchRentBills` | Pending |
| **Task 3** | `web/src/features/admin/components/billing/BatchGenerateRentBillsModal.jsx` | Batch preview and confirmation modal component | Pending |
| **Task 4** | `web/src/features/admin/components/billing/RentBillingTab.jsx` | Remove dispatch dock, add table checkboxes, master select-all, and bulk action bar | Pending |
| **Task 5** | Verification & Build | Full verification with unit tests and production build check | Pending |

---

### Task 1: Backend Batch Rent Bill Generation Controller & Route

**Files:**
- Modify: `Capstone-Website/server/controllers/billing/rentBillingController.js`
- Modify: `Capstone-Website/server/routes/billingRoutes.js`
- Create: `Capstone-Website/server/controllers/billing/rentBillingBatchController.test.js`

**Interfaces:**
- Produces: `POST /api/billing/rent/generate-batch` accepting `{ reservationIds: string[], billingMonth?: string, dueDate?: string, branch?: string }`
- Returns: `{ success: true, summary: { requested: number, generated: number, failed: number, errors: Array<{ reservationId, error }> }, bills: Array<Bill> }`

- [ ] **Step 1: Write the failing unit test**

Create `Capstone-Website/server/controllers/billing/rentBillingBatchController.test.js`:
```javascript
import { describe, expect, test, jest } from "@jest/globals";
import { generateBatchRentBills } from "./rentBillingController.js";

describe("generateBatchRentBills Controller", () => {
  test("returns 400 when reservationIds is missing or empty", async () => {
    const req = {
      body: { reservationIds: [] },
      user: { role: "owner" },
    };
    const res = {
      statusCode: null,
      jsonData: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(data) {
        this.jsonData = data;
        return this;
      },
    };
    const next = jest.fn();

    await generateBatchRentBills(req, res, next);
    expect(res.statusCode).toBe(400);
    expect(res.jsonData?.error).toMatch(/reservationIds.*required/i);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```powershell
npm test -- server/controllers/billing/rentBillingBatchController.test.js
```
Expected: FAIL with `generateBatchRentBills is not exported` or `function not defined`.

- [ ] **Step 3: Implement `generateBatchRentBills` controller and route**

In `server/controllers/billing/rentBillingController.js`:
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
      requested: reservationIds.length,
      generated: 0,
      failed: 0,
      errors: [],
    };
    const bills = [];
    const warnings = [];

    for (const rawId of reservationIds) {
      const reservationId = String(rawId || "").trim();
      if (!reservationId) continue;

      try {
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

        summary.generated += 1;
        bills.push(formatBill(result.bill));

        if (result.delivery.email?.status === "failed") {
          warnings.push(`${reservationId}: email statement delivery failed.`);
        }
      } catch (err) {
        summary.failed += 1;
        summary.errors.push({
          reservationId,
          error: err.message || "Failed to generate bill.",
        });
      }
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

In `server/routes/billingRoutes.js`:
```javascript
/**
 * POST /api/billing/rent/generate-batch
 * Generate monthly rent bills for multiple selected reservations (Admin only)
 */
router.post(
  "/rent/generate-batch",
  verifyAdmin,
  requirePermission("manageBilling"),
  filterByBranch,
  billingController.generateBatchRentBills,
);
```

- [ ] **Step 4: Run tests and verify they pass**

Run:
```powershell
npm test -- server/controllers/billing/rentBillingBatchController.test.js
```
Expected: PASS.

- [ ] **Step 5: Commit changes**

```powershell
git add server/controllers/billing/rentBillingController.js server/routes/billingRoutes.js server/controllers/billing/rentBillingBatchController.test.js
git commit -m "feat(billing): add generateBatchRentBills controller and route"
```

---

### Task 2: Frontend API Client Extension

**Files:**
- Modify: `Capstone-Website/web/src/shared/api/billingApi.js`

**Interfaces:**
- Consumes: `POST /api/billing/rent/generate-batch`
- Produces: `billingApi.generateBatchRentBills(data)` method

- [ ] **Step 1: Update `web/src/shared/api/billingApi.js`**

Add `generateBatchRentBills` under `generateRentBill` / `generateAllRentBills`:
```javascript
  generateBatchRentBills: (data) =>
    authFetch("/billing/rent/generate-batch", {
      method: "POST",
      body: JSON.stringify(data),
    }),
```

- [ ] **Step 2: Verify lint and syntax**

Run:
```powershell
npm run build --prefix web
```
Expected: PASS with 0 syntax or bundle errors.

- [ ] **Step 3: Commit changes**

```powershell
git add web/src/shared/api/billingApi.js
git commit -m "feat(api): add generateBatchRentBills method to billingApi"
```

---

### Task 3: Batch Generation Preview Modal Component

**Files:**
- Create: `Capstone-Website/web/src/features/admin/components/billing/BatchGenerateRentBillsModal.jsx`

**Interfaces:**
- Props:
  - `isOpen`: boolean
  - `onClose`: () => void
  - `onConfirm`: () => Promise<void>
  - `selectedRows`: Array of selected row objects
  - `isGenerating`: boolean
  - `billingMonth`: string (YYYY-MM or "all")
- Renders:
  - Clean card container with `border border-border bg-card shadow-2xl rounded-[20px]`.
  - Summary grid: Selected Tenants count, Total Value Due, Billing Month.
  - Scrollable tenant breakdown list showing Tenant Name, Room / Bed, and Monthly Contract Rent.
  - Actions: `Cancel` and `Confirm & Generate (X) Bills` with loading spinner.

- [ ] **Step 1: Create `BatchGenerateRentBillsModal.jsx`**

```jsx
import { LoaderCircle, Send, Users, X } from "lucide-react";
import { fmtCurrency, fmtMonth } from "../../utils/formatters";

export default function BatchGenerateRentBillsModal({
  isOpen,
  onClose,
  onConfirm,
  selectedRows = [],
  isGenerating = false,
  billingMonth = "",
}) {
  if (!isOpen || selectedRows.length === 0) return null;

  const totalAmount = selectedRows.reduce((sum, r) => sum + (Number(r.contractRate) || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/60 p-4 backdrop-blur-sm">
      <section className="w-full max-w-xl overflow-hidden rounded-[20px] border border-border bg-card shadow-2xl">
        <div className="flex items-center justify-between border-b border-border bg-muted/20 px-6 py-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--color-accent,#D4AF37)]">
              Bulk Billing Action
            </p>
            <h3 className="mt-0.5 text-base font-bold text-card-foreground">
              Generate Rent Bills in Batch
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-card-foreground transition disabled:opacity-50"
          >
            <X size={18} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-3 px-6 py-4 border-b border-border bg-background">
          <div className="rounded-xl border border-border/50 bg-card p-3 shadow-xs">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Selected Tenants</p>
            <p className="mt-1 text-base font-bold text-card-foreground flex items-center gap-1.5">
              <Users size={15} className="text-slate-500" />
              {selectedRows.length}
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-3 shadow-xs">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Total Bill Value</p>
            <p className="mt-1 text-base font-bold text-[color:var(--color-accent,#D4AF37)]">
              {fmtCurrency(totalAmount)}
            </p>
          </div>
          <div className="rounded-xl border border-border/50 bg-card p-3 shadow-xs">
            <p className="text-[10px] font-semibold uppercase text-muted-foreground">Billing Cycle</p>
            <p className="mt-1 text-xs font-bold text-card-foreground">
              {billingMonth && billingMonth !== "all" ? fmtMonth(billingMonth) : "Current Active Month"}
            </p>
          </div>
        </div>

        <div className="px-6 py-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
            Selected Tenants ({selectedRows.length})
          </p>
          <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1 divide-y divide-border/30">
            {selectedRows.map((row) => (
              <div key={row.id || row.reservationId} className="flex items-center justify-between py-2 text-xs">
                <div>
                  <p className="font-semibold text-card-foreground">{row.tenantName}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {row.roomName || "Unassigned"} • {row.branch ? row.branch.toUpperCase() : ""}
                  </p>
                </div>
                <div className="text-right">
                  <span className="font-bold text-card-foreground">
                    {fmtCurrency(row.contractRate)}
                  </span>
                  <span className="block text-[10px] text-muted-foreground">Monthly Rent</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border bg-muted/10 px-6 py-4">
          <p className="text-xs text-muted-foreground">
            Statements and notifications will be sent automatically.
          </p>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isGenerating}
              className="h-9 rounded-xl border border-border bg-card px-4 text-xs font-semibold text-card-foreground shadow-xs hover:bg-muted active:scale-[0.98] disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={isGenerating}
              className="inline-flex h-9 items-center gap-2 rounded-xl bg-emerald-600 px-5 text-xs font-bold text-white shadow-md hover:bg-emerald-700 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isGenerating ? (
                <LoaderCircle size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              <span>{isGenerating ? "Generating..." : `Confirm & Generate (${selectedRows.length})`}</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verify component compiles**

Run:
```powershell
npm run build --prefix web
```
Expected: PASS.

- [ ] **Step 3: Commit changes**

```powershell
git add web/src/features/admin/components/billing/BatchGenerateRentBillsModal.jsx
git commit -m "feat(billing): create BatchGenerateRentBillsModal component"
```

---

### Task 4: Integrate Multi-Select Table Checkboxes & Bulk Action Bar in `RentBillingTab.jsx`

**Files:**
- Modify: `Capstone-Website/web/src/features/admin/components/billing/RentBillingTab.jsx`

**Changes:**
1. Import `BatchGenerateRentBillsModal`.
2. Delete the sticky dispatch banner (`sendableRows.length >= 2 && ...` dock) and delete unused variables: `sendableRows`, `sendableTotalAmount`, `handleSendAllReady`, `batchSending`.
3. Add selection state:
   - `selectedReservationIds` (`useState(new Set())`).
   - Clear selection on filter changes (`branch`, `month`, `timeframeMode`, `activeTab`, `searchQuery`).
4. Derive eligible unbilled rows:
   ```javascript
   const eligibleRows = useMemo(
     () => filteredRows.filter((r) => !r.bill && r.computedStatus !== "missing_data" && r.contractRate > 0),
     [filteredRows]
   );
   ```
5. Implement Selection Handlers:
   - `handleToggleSelect(reservationId)`
   - `handleSelectAll()`
   - `handleClearSelection()`
6. Add master checkbox in table header `<th>`:
   - Indeterminate when `selectedReservationIds.size > 0 && selectedReservationIds.size < eligibleRows.length`.
   - Checked when `eligibleRows.length > 0 && selectedReservationIds.size === eligibleRows.length`.
   - Disabled when `eligibleRows.length === 0`.
7. Add row checkboxes in table body `<td>`:
   - Rendered only if row is eligible (`!row.bill && row.computedStatus !== 'missing_data' && row.contractRate > 0`).
   - Otherwise renders empty spacer cell.
8. Add clean Bulk Action Bar (when `selectedReservationIds.size > 0`):
   - Positioned cleanly above table or as a sticky compact container.
   - Shows badge with selected count, sum total of selected bills, "Generate Rent Bills (X)" button, and "Deselect" button.
9. Implement `handleBatchGenerate` using `billingApi.generateBatchRentBills`:
   - Calls backend endpoint with `reservationIds: Array.from(selectedReservationIds)`.
   - Displays clear success toast: `X bills generated successfully.`
   - If partial failures occur, shows error toast detailing failed reservations.
   - Clears selection and calls `loadData()`.

- [ ] **Step 1: Apply updates to `RentBillingTab.jsx`**
- [ ] **Step 2: Verify build and lint**

Run:
```powershell
npm run build --prefix web
```
Expected: PASS with 0 build errors.

- [ ] **Step 3: Commit changes**

```powershell
git add web/src/features/admin/components/billing/RentBillingTab.jsx
git commit -m "feat(billing): replace dispatch banner with multi-select batch rent bill generation"
```

---

### Task 5: Comprehensive Verification & Test Suite

**Files:**
- Test all modified components across backend and frontend.

- [ ] **Step 1: Run all billing backend tests**

Run:
```powershell
npm test -- server/controllers/billing/
```
Expected: All tests PASS.

- [ ] **Step 2: Run frontend build check**

Run:
```powershell
npm run build --prefix web
```
Expected: Build succeeds with 0 errors.

- [ ] **Step 3: Commit full feature verification**

```powershell
git commit -m "chore(billing): complete test and build verification for batch rent billing" --allow-empty
```
