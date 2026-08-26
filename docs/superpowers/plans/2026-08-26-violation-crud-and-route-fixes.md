# In-Office Violation CRUD, Penalty Reversal & Route Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Streamline the violation management lifecycle by replacing online appeal routes with complete in-office Admin CRUD capabilities, enforcing automatic cancellation of standalone penalty bills on dismissal, correcting the canonical contract selector terminology string, and achieving a 100% pass rate across all backend test suites.

**Architecture:** 
1. **Schema & Routing:** Remove tenant-side online appeal routes (`/violations/:id/appeal`, `/violations/:id/adjudicate-appeal`) and add Admin in-office management routes (`PUT /api/billing/violations/:id` and `DELETE /api/billing/violations/:id`) protected by `verifyAdmin`, `requirePermission("manageBilling")`, and `filterByBranch`.
2. **Controller Logic:** Implement `updateViolation` (updates incident metadata, category, and penalty details), `archiveViolation` (soft-deletes violation record and cancels unpaid penalty bills), and enhance `updateViolationDecision` to automatically void standalone penalty bills (`Bill.updateMany({ violationId: violation._id, ... })`) when an admin dismisses an infraction.
3. **Tenant Notifications & Auditing:** Automatically dispatch clean in-app notifications whenever an admin logs, updates, or dismisses a violation during an in-office consultation.
4. **Terminology Compliance:** Correct error strings in `tenantContractSelectionService.js` to strictly adhere to the invariant rule ("Tenant", never "Resident").

**Tech Stack:** Node.js (ESM), Express.js, MongoDB / Mongoose, Zod, Jest, React, Vite.

**Spec:** [implementation_plan.md](file:///C:/Users/Adming/.gemini/antigravity-ide/brain/ad49dae8-f404-48e6-98cd-5a782a8fff60/implementation_plan.md)

## Global Constraints

- Never hard-delete violations or financial records; archiving must set `isArchived: true`.
- Maintain strict terminology invariants: "Tenant" (NEVER "Resident"), "Assistant" (NEVER "Copilot"), "Owner" (NEVER "Super Admin"), "Rent" (NEVER "Rental Fee").
- When a violation is dismissed, any un-paid attached penalty (both from open rent bills and standalone penalty bills) must be voided/cancelled automatically.
- All tasks must adhere to TDD (Red-Green-Refactor) and end with clean Jest test passes.

---

### What to Expect from These Changes

- **In-Office Resolution Simplicity:** When a tenant comes to the office to contest or explain a violation, the staff or admin can immediately correct notes, modify penalty amounts, or dismiss the violation directly in the system.
- **Immediate Tenant In-App Feedback:** Upon in-office update or dismissal, the tenant receives a clear, friendly in-app notification confirming the updated status.
- **Zero Orphaned Debt:** If a penalty was applied to a standalone bill and later dismissed by admin, the bill is automatically marked as voided so the tenant owes ₱0.
- **Zero Test Failures:** The Express server and all 274 test suites will execute cleanly with zero route or schema initialization errors.

---

### Task 1: Terminology Invariant Fix in Canonical Contract Selection Service

**Files:**
- Modify: `server/services/tenantContractSelectionService.js:203`
- Test: `server/services/tenantContractSelectionService.test.js`

**Interfaces:**
- Consumes: `selectCanonicalTenantContract` options `{ strictIntegrityCheck }`
- Produces: Error with message `"Multiple tenant-visible canonical Contracts were found."` and code `"MULTIPLE_CANONICAL_CONTRACTS"`.

- [ ] **Step 1: Write the failing / updated unit test in `tenantContractSelectionService.test.js`**

```javascript
test("throws error using 'tenant-visible' terminology invariant when strictIntegrityCheck is enabled and duplicates exist", () => {
  expect(() =>
    selectCanonicalTenantContract({
      contracts: [
        contract({ _id: "c1", status: "active" }),
        contract({ _id: "c2", status: "active" }),
      ],
      activeStay,
      strictIntegrityCheck: true,
    }),
  ).toThrow("Multiple tenant-visible canonical Contracts were found.");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- services/tenantContractSelectionService.test.js -t "tenant-visible"` in `Capstone-Website/server`.
Expected: FAIL (currently contains "resident-visible").

- [ ] **Step 3: Update error message string in `tenantContractSelectionService.js`**

In `server/services/tenantContractSelectionService.js:203`:
```javascript
  if (strictIntegrityCheck) {
    throw Object.assign(
      new Error("Multiple tenant-visible canonical Contracts were found."),
      {
        code: "MULTIPLE_CANONICAL_CONTRACTS",
        statusCode: 409,
      },
    );
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- services/tenantContractSelectionService.test.js` in `Capstone-Website/server`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/tenantContractSelectionService.js server/services/tenantContractSelectionService.test.js
git commit -m "fix(server): enforce tenant terminology invariant in contract selection error"
```

---

### Task 2: Schema Refinement & Validation Unit Tests

**Files:**
- Modify: `server/validation/zodSchemas.js`
- Test: `server/tests/validateRequest.universal.test.js`

**Interfaces:**
- Consumes: `updateViolationSchema` payload `{ dateOfIncident, timeOfIncident, locationOfIncident, violationType, customViolationDescription, evidenceNotes, penaltyApplied, penaltyReason }`
- Produces: Sanitized and validated object for admin in-office violation updates.

- [ ] **Step 1: Write the failing tests in `validateRequest.universal.test.js`**

Replace the obsolete appeal schema tests in `server/tests/validateRequest.universal.test.js` with tests for `updateViolationSchema`:

```javascript
describe("updateViolationSchema", () => {
  test("validates valid in-office violation update payload", () => {
    const result = updateViolationSchema.safeParse({
      dateOfIncident: "2026-08-20",
      locationOfIncident: "Room 302",
      evidenceNotes: "Tenant showed proof of appliance permit during office visit",
      penaltyApplied: 0,
    });
    expect(result.success).toBe(true);
  });

  test("rejects penaltyApplied > 0 without penaltyReason", () => {
    const result = updateViolationSchema.safeParse({
      penaltyApplied: 500,
      penaltyReason: "",
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/validateRequest.universal.test.js` in `Capstone-Website/server`.
Expected: FAIL (`updateViolationSchema is not defined`).

- [ ] **Step 3: Define `updateViolationSchema` and clean up appeal schemas in `zodSchemas.js`**

In `server/validation/zodSchemas.js`:
```javascript
export const updateViolationSchema = z
  .object({
    violationType: z.enum(VIOLATION_TYPES).optional(),
    customViolationDescription: z.string().trim().max(500).optional().nullable(),
    dateOfIncident: z.string().trim().optional(),
    timeOfIncident: z.string().trim().optional().nullable(),
    locationOfIncident: z.string().trim().max(200).optional().nullable(),
    evidenceNotes: z.string().trim().max(3000).optional().nullable(),
    evidenceUrls: z.array(z.string().trim()).optional(),
    penaltyApplied: z.coerce.number().min(0).optional().nullable(),
    penaltyReason: z.string().trim().max(1000).optional().nullable(),
  })
  .superRefine((data, ctx) => {
    const penalty = Number(data.penaltyApplied || 0);
    if (penalty > 0 && (!data.penaltyReason || data.penaltyReason.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A clear penalty reason is required whenever a penalty fee is applied.",
        path: ["penaltyReason"],
      });
    }
    if (data.violationType === "custom" && (!data.customViolationDescription || data.customViolationDescription.trim().length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Custom violation description is required when violation type is set to custom.",
        path: ["customViolationDescription"],
      });
    }
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/validateRequest.universal.test.js` in `Capstone-Website/server`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/validation/zodSchemas.js server/tests/validateRequest.universal.test.js
git commit -m "feat(validation): replace appeal schemas with in-office updateViolationSchema"
```

---

### Task 3: In-Office Admin Violation CRUD & Standalone Penalty Reversal (TDD)

**Files:**
- Modify: `server/controllers/billing/tenantViolationController.js`
- Modify: `server/controllers/billing/index.js`
- Test: `server/controllers/billing/tenantViolationController.test.js`

**Interfaces:**
- Consumes: `req.params.id`, `req.body`, `req.user`, `admin` from `getAdminInfo`
- Produces: 
  - `updateViolation(req, res, next)` -> Returns `{ success: true, message: "Violation updated successfully.", data: violation }`
  - `archiveViolation(req, res, next)` -> Returns `{ success: true, message: "Violation archived successfully." }`
  - `updateViolationDecision` (enhanced) -> Voids standalone penalty bills and reverses line items from monthly bills on dismissal.

- [ ] **Step 1: Write unit tests in `tenantViolationController.test.js`**

Add tests covering `updateViolation`, `archiveViolation`, and standalone penalty reversal:

```javascript
describe("In-Office Violation Management CRUD", () => {
  test("updateViolation modifies incident details and sends updated notification to tenant", async () => {
    const mockViolation = {
      _id: new mongoose.Types.ObjectId(),
      tenantId: new mongoose.Types.ObjectId(),
      branch: "gil-puyat",
      status: "reported",
      save: jest.fn().mockResolvedValue(true),
    };
    mockFindByIdViolation.mockResolvedValue(mockViolation);

    req.params = { id: mockViolation._id };
    req.body = {
      locationOfIncident: "Room 405",
      evidenceNotes: "Tenant brought authorized appliance permit to the office.",
    };

    await updateViolation(req, res, next);

    expect(mockViolation.locationOfIncident).toBe("Room 405");
    expect(mockViolation.evidenceNotes).toBe("Tenant brought authorized appliance permit to the office.");
    expect(mockViolation.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Violation record updated successfully.",
      }),
    );
  });

  test("archiveViolation soft-deletes record and voids any unpaid penalty bills", async () => {
    const mockViolation = {
      _id: new mongoose.Types.ObjectId(),
      tenantId: new mongoose.Types.ObjectId(),
      branch: "gil-puyat",
      isArchived: false,
      save: jest.fn().mockResolvedValue(true),
    };
    mockFindByIdViolation.mockResolvedValue(mockViolation);

    req.params = { id: mockViolation._id };

    await archiveViolation(req, res, next);

    expect(mockViolation.isArchived).toBe(true);
    expect(mockViolation.save).toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        message: "Violation record archived successfully.",
      }),
    );
  });

  test("updateViolationDecision voids standalone penalty bills on dismissal", async () => {
    const mockViolation = {
      _id: new mongoose.Types.ObjectId(),
      tenantId: new mongoose.Types.ObjectId(),
      branch: "gil-puyat",
      penaltyApplied: 500,
      status: "penalty_issued",
      save: jest.fn().mockResolvedValue(true),
    };
    mockFindByIdViolation.mockResolvedValue(mockViolation);

    req.params = { id: mockViolation._id };
    req.body = {
      decision: "dismissed",
      decisionReason: "In-office appeal substantiated; fine waived.",
    };

    await updateViolationDecision(req, res, next);

    expect(mockViolation.status).toBe("dismissed");
    expect(mockViolation.adminDecision).toBe("dismissed");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- controllers/billing/tenantViolationController.test.js -t "In-Office Violation Management CRUD"` in `Capstone-Website/server`.
Expected: FAIL (`updateViolation is not defined`).

- [ ] **Step 3: Implement `updateViolation`, `archiveViolation`, and enhanced dismissal in `tenantViolationController.js`**

In `server/controllers/billing/tenantViolationController.js`:
- Implement `updateViolation`:
  - Check admin branch access.
  - Find violation by ID (`isArchived: false`).
  - Update allowed fields (`dateOfIncident`, `timeOfIncident`, `locationOfIncident`, `violationType`, `customViolationDescription`, `evidenceNotes`, `evidenceUrls`, `penaltyApplied`, `penaltyReason`).
  - Save and dispatch tenant notification: `"Your violation record has been updated following in-office review."`
- Implement `archiveViolation`:
  - Find violation by ID.
  - Set `violation.isArchived = true`, `violation.archivedAt = new Date()`, `violation.archivedBy = adminUserId`.
  - Void any standalone penalty bills (`Bill.updateMany({ violationId: violation._id, status: { $in: ["draft", "pending", "overdue"] } }, { $set: { status: "voided", remainingAmount: 0 } })`).
  - Save and log audit event.
- In `updateViolationDecision` when `decision === "dismissed"`:
  - Add `await Bill.updateMany({ violationId: violation._id, status: { $in: ["draft", "pending", "overdue"] } }, { $set: { status: "voided", remainingAmount: 0 } });` alongside monthly bill line item reversal.
  - Send tenant notification: `"Your violation record has been dismissed upon administrative review."`
- Export `updateViolation` and `archiveViolation` in `tenantViolationController.js` and `server/controllers/billing/index.js`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- controllers/billing/tenantViolationController.test.js` in `Capstone-Website/server`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/controllers/billing/tenantViolationController.js server/controllers/billing/index.js server/controllers/billing/tenantViolationController.test.js
git commit -m "feat(billing): add in-office violation CRUD and standalone penalty reversal on dismissal"
```

---

### Task 4: Billing Routes Wiring & Access Guards Regression Pass

**Files:**
- Modify: `server/routes/billingRoutes.js`
- Test: `server/routes/accessGuards.test.js`

**Interfaces:**
- Consumes: `billingController.updateViolation`, `billingController.archiveViolation`, `updateViolationSchema`
- Produces: Clean Express routes matching admin access control invariants.

- [ ] **Step 1: Update routes in `server/routes/billingRoutes.js`**

In `server/routes/billingRoutes.js`:
- Replace `submitViolationAppealSchema` and `adjudicateAppealSchema` imports with `updateViolationSchema`.
- Remove lines 493-515 (the missing appeal routes).
- Add:
```javascript
/**
 * PUT /api/billing/violations/:id
 * Admin updates violation details during in-office review.
 */
router.put(
  "/violations/:id",
  verifyAdmin,
  requirePermission("manageBilling"),
  filterByBranch,
  validateRequest({ body: updateViolationSchema }),
  billingController.updateViolation,
);

/**
 * DELETE /api/billing/violations/:id
 * Admin archives a violation record.
 */
router.delete(
  "/violations/:id",
  verifyAdmin,
  requirePermission("manageBilling"),
  filterByBranch,
  billingController.archiveViolation,
);
```

- [ ] **Step 2: Run `accessGuards.test.js` to verify it passes**

Run: `npm test -- routes/accessGuards.test.js` in `Capstone-Website/server`.
Expected: PASS (All route guards initialize cleanly without `[object Undefined]` errors).

- [ ] **Step 3: Commit**

```bash
git add server/routes/billingRoutes.js
git commit -m "feat(routes): wire in-office violation update/archive routes and clean up access guards"
```

---

### Task 5: End-to-End Verification & Production Build

**Files:**
- Verify: Full backend test suite (`npm test` in `Capstone-Website/server`)
- Verify: Web production build (`npm run build` in `Capstone-Website/web`)

- [ ] **Step 1: Run full server test suite**

Run: `npm test` in `Capstone-Website/server`.
Expected: 274 of 274 test suites PASS, 0 failures.

- [ ] **Step 2: Run web frontend build**

Run: `npm run build` in `Capstone-Website/web`.
Expected: Vite build succeeds with 0 errors.

- [ ] **Step 3: Commit any final test fixtures if needed**

```bash
git status
```
