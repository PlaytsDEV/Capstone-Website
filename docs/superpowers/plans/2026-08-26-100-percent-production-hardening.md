# 100/100 Full-Stack Production Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Achieve a flawless 100/100 score across all 5 evaluation axes (Correctness, Security, Performance, Maintainability, Project Guidelines) by implementing a unified penalty ledger synchronizer, complete archival penalty reversal, ReDoS and XSS input sanitization guards, compound MongoDB indexes, and paginated lean projections.

**Architecture:**
1. **Correctness & Maintainability:** Consolidate all penalty ledger mutations into a single atomic helper `syncViolationPenaltyToBill({ violation, previousPenalty, newPenalty, action })` that cleanly handles penalty creation, penalty delta adjustments on in-office edit, and complete penalty line-item reversals across both open monthly bills and standalone bills upon dismissal or archival.
2. **Security:** Add defensive `mongoose.Types.ObjectId.isValid` parameter guards, escape regex special characters in search queries to eliminate ReDoS vulnerabilities, and sanitize HTML tags from administrative text fields.
3. **Performance:** Add compound indexes `{ violationId: 1, isArchived: 1, status: 1 }` on `Bill` and `{ branch: 1, isArchived: 1, createdAt: -1 }` on `TenantViolation`, paired with paginated lean projections in `getViolations`.
4. **Project Guidelines:** 100% strict compliance with all system terminology ("Tenant", "Assistant", "Owner", "Rent") and solid design token invariants.

**Tech Stack:** Node.js (ESM), Express.js, MongoDB / Mongoose, Zod, Jest, React, Vite.

**Spec:** [implementation_plan.md](file:///C:/Users/Adming/.gemini/antigravity-ide/brain/ad49dae8-f404-48e6-98cd-5a782a8fff60/implementation_plan.md)

## Global Constraints

- Never hard-delete financial or violation records; maintain soft-deletion (`isArchived: true`).
- Maintain strict terminology invariants: "Tenant" (NEVER "Resident"), "Assistant" (NEVER "Copilot"), "Owner" (NEVER "Super Admin"), "Rent" (NEVER "Rental Fee").
- Maintain DRY principle: all penalty bill mutations must route through `syncViolationPenaltyToBill`.
- All tasks must follow TDD (Red-Green-Refactor) and end with clean Jest test passes.

---

### What to Expect from These Changes

- **Automatic Penalty Adjustments on Edit:** If an administrator modifies a fine during an in-office appeal (e.g. reducing a penalty from ₱500 to ₱200), the system automatically updates the tenant's bill balance by the exact delta without requiring manual accounting adjustments.
- **Complete Archival Reversal:** Archiving a violation will cleanly reverse any attached penalty from active monthly bills and void any standalone penalty bills.
- **Sub-15ms Database Queries:** Compound indexes and lean projections will ensure that listing violations remains instant regardless of database size.
- **Protected Input Surfaces:** Invalid database IDs in URLs will return clean 400 errors instead of throwing 500 crashes, and search inputs are guarded against regex denial of service.

---

### Task 1: Compound Database Index Hardening (Performance)

**Files:**
- Modify: `server/models/Bill.js`
- Modify: `server/models/TenantViolation.js`

**Interfaces:**
- Produces: Compound index definitions `{ violationId: 1, isArchived: 1, status: 1 }` on `Bill` and `{ branch: 1, isArchived: 1, createdAt: -1 }`, `{ tenantId: 1, isArchived: 1 }` on `TenantViolation`.

- [ ] **Step 1: Write test verifying index definitions in `server/models/Bill.js` and `TenantViolation.js`**

Add test in `server/tests/modelIndexes.test.js`:
```javascript
import { describe, it, expect } from "@jest/globals";
import mongoose from "mongoose";
import { Bill, TenantViolation } from "../models/index.js";

describe("Model Compound Indexes", () => {
  it("defines compound indexes on Bill for violation lookups", () => {
    const indexes = Bill.schema.indexes();
    const hasViolationIndex = indexes.some(([fields]) => fields.violationId === 1 && fields.isArchived === 1);
    expect(hasViolationIndex).toBe(true);
  });

  it("defines compound indexes on TenantViolation for branch and tenant queries", () => {
    const indexes = TenantViolation.schema.indexes();
    const hasBranchIndex = indexes.some(([fields]) => fields.branch === 1 && fields.isArchived === 1);
    expect(hasBranchIndex).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/modelIndexes.test.js` in `Capstone-Website/server`.
Expected: FAIL.

- [ ] **Step 3: Add compound indexes in `Bill.js` and `TenantViolation.js`**

In `server/models/Bill.js`:
```javascript
billSchema.index({ violationId: 1, isArchived: 1, status: 1 });
```

In `server/models/TenantViolation.js`:
```javascript
tenantViolationSchema.index({ branch: 1, isArchived: 1, createdAt: -1 });
tenantViolationSchema.index({ tenantId: 1, isArchived: 1 });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/modelIndexes.test.js` in `Capstone-Website/server`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/models/Bill.js server/models/TenantViolation.js server/tests/modelIndexes.test.js
git commit -m "perf(models): add compound indexes on Bill and TenantViolation"
```

---

### Task 2: Security Validation Guards & Sanitization (Security)

**Files:**
- Modify: `server/controllers/billing/tenantViolationController.js`
- Test: `server/controllers/billing/tenantViolationController.test.js`

**Interfaces:**
- Consumes: `req.params.id`, `req.query.search`, `req.body`
- Produces: Sanitized text strings (no HTML tags), escaped regex queries, and 400 Bad Request on invalid ObjectIds.

- [ ] **Step 1: Write failing tests in `tenantViolationController.test.js`**

```javascript
describe("Security Validation Guards", () => {
  test("rejects invalid MongoDB ObjectId in req.params with 400 Bad Request", async () => {
    req.params = { id: "invalid-id-123" };
    await getViolationById(req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error: "Invalid violation ID format.",
      }),
    );
  });

  test("sanitizes HTML tags from evidenceNotes during updateViolation", async () => {
    const violationId = new mongoose.Types.ObjectId();
    const mockViolation = {
      _id: violationId,
      branch: "gil-puyat",
      status: "reported",
      isArchived: false,
      save: jest.fn().mockResolvedValue(true),
    };
    mockFindByIdViolation.mockResolvedValue(mockViolation);

    req.params = { id: violationId.toString() };
    req.body = {
      evidenceNotes: "<script>alert('xss')</script>Clean notes provided by tenant.",
    };

    await updateViolation(req, res, next);

    expect(mockViolation.evidenceNotes).toBe("Clean notes provided by tenant.");
    expect(mockViolation.save).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- controllers/billing/tenantViolationController.test.js -t "Security Validation Guards"` in `Capstone-Website/server`.
Expected: FAIL.

- [ ] **Step 3: Implement security sanitizers and ObjectId guards in `tenantViolationController.js`**

In `server/controllers/billing/tenantViolationController.js`:
- Define `sanitizeText(str)` that strips HTML tags and trims whitespace.
- Define `escapeRegex(str)` that escapes regex special characters.
- Add `if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, error: "Invalid violation ID format." });` across all ID handlers.
- Escape search string: `const safeSearch = escapeRegex(search.trim());`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- controllers/billing/tenantViolationController.test.js -t "Security Validation Guards"` in `Capstone-Website/server`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/controllers/billing/tenantViolationController.js server/controllers/billing/tenantViolationController.test.js
git commit -m "sec(billing): add ObjectId validation guards and HTML/regex sanitizers"
```

---

### Task 3: Unified Penalty Ledger Synchronizer (Correctness & Maintainability)

**Files:**
- Modify: `server/controllers/billing/tenantViolationController.js`
- Test: `server/controllers/billing/tenantViolationController.test.js`

**Interfaces:**
- Consumes: `syncViolationPenaltyToBill({ violation, previousPenalty, newPenalty, action })`
- Produces: Deterministic ledger updates across monthly bills and standalone penalty bills.

- [ ] **Step 1: Write failing tests in `tenantViolationController.test.js` for penalty delta sync and archival reversal**

```javascript
describe("Unified Penalty Synchronizer", () => {
  test("updateViolation automatically adjusts bill line-item when penalty amount is updated", async () => {
    const violationId = new mongoose.Types.ObjectId();
    const reservationId = new mongoose.Types.ObjectId();
    const tenantId = new mongoose.Types.ObjectId();
    const violationShortId = violationId.toString().slice(-6);

    const mockViolation = {
      _id: violationId,
      reservationId,
      tenantId,
      branch: "gil-puyat",
      violationType: "smoking_inside",
      penaltyApplied: 500,
      status: "penalty_issued",
      isArchived: false,
      save: jest.fn().mockResolvedValue(true),
    };
    mockFindByIdViolation.mockResolvedValue(mockViolation);

    mockBillDoc = {
      _id: new mongoose.Types.ObjectId(),
      additionalCharges: [
        { name: `Violation Penalty: Smoking Inside (${violationShortId})`, amount: 500 },
      ],
      charges: { penalty: 500 },
      totalAmount: 5500,
      remainingAmount: 5500,
      save: mockBillSave.mockResolvedValue(true),
    };

    req.params = { id: violationId.toString() };
    req.body = {
      penaltyApplied: 300,
      penaltyReason: "Reduced penalty after explanation",
    };

    await updateViolation(req, res, next);

    expect(mockViolation.penaltyApplied).toBe(300);
    expect(mockBillDoc.charges.penalty).toBe(300);
    expect(mockBillDoc.totalAmount).toBe(5300);
    expect(mockBillDoc.additionalCharges[0].amount).toBe(300);
    expect(mockBillSave).toHaveBeenCalled();
  });

  test("archiveViolation reverses penalty line-item on active monthly bill", async () => {
    const violationId = new mongoose.Types.ObjectId();
    const reservationId = new mongoose.Types.ObjectId();
    const tenantId = new mongoose.Types.ObjectId();
    const violationShortId = violationId.toString().slice(-6);

    const mockViolation = {
      _id: violationId,
      reservationId,
      tenantId,
      branch: "gil-puyat",
      penaltyApplied: 500,
      isArchived: false,
      save: jest.fn().mockResolvedValue(true),
    };
    mockFindByIdViolation.mockResolvedValue(mockViolation);

    mockBillDoc = {
      _id: new mongoose.Types.ObjectId(),
      additionalCharges: [
        { name: `Violation Penalty: Smoking Inside (${violationShortId})`, amount: 500 },
      ],
      charges: { penalty: 500 },
      totalAmount: 5500,
      remainingAmount: 5500,
      save: mockBillSave.mockResolvedValue(true),
    };

    req.params = { id: violationId.toString() };
    await archiveViolation(req, res, next);

    expect(mockViolation.isArchived).toBe(true);
    expect(mockBillDoc.additionalCharges.length).toBe(0);
    expect(mockBillDoc.charges.penalty).toBe(0);
    expect(mockBillDoc.totalAmount).toBe(5000);
    expect(mockBillSave).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- controllers/billing/tenantViolationController.test.js -t "Unified Penalty Synchronizer"` in `Capstone-Website/server`.
Expected: FAIL.

- [ ] **Step 3: Implement `syncViolationPenaltyToBill` and refactor controller methods**

In `server/controllers/billing/tenantViolationController.js`:
- Create `export const syncViolationPenaltyToBill = async ({ violation, previousPenalty = 0, newPenalty = 0, action = "sync" })`.
- If `action === "reverse"` or `newPenalty === 0`:
  - Filter out line items matching `violation._id.toString().slice(-6)`.
  - Recalculate `charges.penalty`, `totalAmount`, and `remainingAmount`.
  - Void any standalone penalty bills (`Bill.updateMany({ violationId: violation._id, status: { $in: ["draft", "pending", "overdue"] } }, { $set: { status: "voided", remainingAmount: 0 } })`).
- If `action === "sync"` and `newPenalty > 0`:
  - If existing line item found: adjust amount by `(newPenalty - previousPenalty)`.
  - If no line item and monthly bill exists: push line item.
  - If no monthly bill exists: create standalone bill or update existing standalone bill amount.
- Integrate `syncViolationPenaltyToBill` into `createViolation`, `updateViolation`, `updateViolationDecision`, and `archiveViolation`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- controllers/billing/tenantViolationController.test.js` in `Capstone-Website/server`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/controllers/billing/tenantViolationController.js server/controllers/billing/tenantViolationController.test.js
git commit -m "refactor(billing): implement unified penalty ledger synchronizer"
```

---

### Task 4: Query Pagination & Lean Projections (Performance)

**Files:**
- Modify: `server/controllers/billing/tenantViolationController.js`
- Test: `server/controllers/billing/tenantViolationController.test.js`

**Interfaces:**
- Consumes: `req.query.page`, `req.query.limit`
- Produces: Response `{ success: true, data: violations, pagination: { total, page, limit, totalPages } }`.

- [ ] **Step 1: Write failing test in `tenantViolationController.test.js` for pagination**

```javascript
test("getViolations returns structured pagination metadata", async () => {
  req.query = { page: "1", limit: "10" };
  await getViolations(req, res, next);
  expect(res.json).toHaveBeenCalledWith(
    expect.objectContaining({
      success: true,
      pagination: expect.objectContaining({
        page: 1,
        limit: 10,
      }),
    }),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- controllers/billing/tenantViolationController.test.js -t "getViolations returns structured pagination metadata"` in `Capstone-Website/server`.
Expected: FAIL.

- [ ] **Step 3: Implement pagination in `getViolations`**

In `server/controllers/billing/tenantViolationController.js`:
- Parse `const pageNum = Math.max(1, parseInt(req.query.page, 10) || 1);`
- Parse `const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));`
- Execute `const total = await TenantViolation.countDocuments(filter);`
- Execute `.skip((pageNum - 1) * limitNum).limit(limitNum).lean();`
- Return `{ success: true, data: formatted, summary, pagination: { total, page: pageNum, limit: limitNum, totalPages: Math.ceil(total / limitNum) } }`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- controllers/billing/tenantViolationController.test.js` in `Capstone-Website/server`.
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add server/controllers/billing/tenantViolationController.js server/controllers/billing/tenantViolationController.test.js
git commit -m "perf(billing): add pagination and lean projections to getViolations"
```

---

### Task 5: End-to-End Verification & Production Build

**Files:**
- Verify: Full test suite (`npm test` in `Capstone-Website/server`)
- Verify: Frontend production build (`npm run build` in `Capstone-Website/web`)

- [ ] **Step 1: Run full server test suite**

Run: `npm test` in `Capstone-Website/server`.
Expected: All 275+ test suites PASS with 0 errors.

- [ ] **Step 2: Run web frontend build**

Run: `npm run build` in `Capstone-Website/web`.
Expected: Build succeeds with 0 errors.

- [ ] **Step 3: Verify git status is clean**

```bash
git status
```
