# Polish Items 2–5 (Payment Review, Room Name Editing, Move-In Date Sync & Custom Room Display) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve code review findings 2 through 5: align Payment Review category dropdown options and tests, permit alphanumeric characters and hyphens in the Room Configuration edit modal, ensure confirmed move-in dates correctly anchor lease start/end dates, and verify custom room name search and Assistant drawer card display.

**Architecture:** 
- **Payment Review (`ReservationPaymentReviewTab.jsx`):** Update the category `<select>` option strings to standard terminology (`"All Payments"`, `"Reservation Fees"`, `"1-Month Advance & Deposit"` with counts) to achieve 100% test passing in `ReservationPaymentReviewTab.test.mjs`.
- **Room Configuration (`RoomConfigModal.jsx`):** Update `handleFieldChange` regex to `/^[a-zA-Z0-9\s-]+$/` matching `RoomFormModal.jsx` and backend `zodSchemas.js` so admins can edit custom room names without character stripping.
- **Room Inventory & Search (`RoomAvailabilityPage.jsx`, `DoubleDeckRoomCard.jsx`, `AdminRoomOccupantsCard.jsx`):** Ensure search query matches both room number and custom name safely, and verify smart subtitle deduplication (`hasDistinctName`).
- **Smart Move-In Date Sync (`ReservationDetailsModal.jsx`, `reservationLifecycleController.js`, `contractService.js`):** Verify that confirming a move-in date dynamically updates draft lease start and end dates to maintain full lease duration.

**Tech Stack:** React 19, Vite, Tailwind CSS, Express.js 4, MongoDB/Mongoose, Node.js Test Runner (`node:test`).

**Spec:** Aligned during `/grill-me` session ([Conversation Transcript](conversation://c8a1f375-e3bf-4f33-a887-183f0de85904)).

---

## Global Constraints

- Never use gradients (strictly solid HSL tokens and flat neutral colors).
- Use clean neutral 1px borders (`1px solid var(--border)` / `border-slate-200 dark:border-slate-700`).
- Strict terminology invariants: "Tenant" (never Resident), "Assistant" (never Copilot), "Owner" (never Super Admin), "Rent" (never Rental Fee).
- Status badges must strictly use transparent backgrounds with colored status dots without matching colored border outlines.
- Atomic updates and backward compatibility with mobile endpoints (`/api/mobile/...`).

---

## What to Expect from These Changes

- **100% Green Automated Tests**: Running the entire frontend test suite (`node scripts/run-tests.mjs`) will complete with 0 failing assertions across all 130 test files.
- **Consistent Room Editing**: Admins can seamlessly type and save alphanumeric room names and hyphens (e.g., "Deluxe-2", "Suite 101") in the Room Configuration modal.
- **Accurate Digital Contracts**: When a tenant moves in on a specific date, their digital lease agreement reflects their confirmed arrival date as the start of their lease without reducing their contract length.
- **Instant Room Search**: Admins and assistants can search by room number (e.g., "220") or custom name (e.g., "Corner Deluxe") and immediately see the matching room.

---

### Task 1: Align Payment Review Category Filter Labels & Pass Frontend Test

**Files:**
- Modify: `Capstone-Website/web/src/features/admin/components/billing/ReservationPaymentReviewTab.jsx:775-780`
- Test: `Capstone-Website/web/src/features/admin/components/billing/ReservationPaymentReviewTab.test.mjs`

**Interfaces:**
- Consumes: `categoryFilter`, `categoryCounts` from `ReservationPaymentReviewTab.jsx`
- Produces: Standardized select option labels (`"All Payments"`, `"Reservation Fees"`, `"1-Month Advance & Deposit"`) matching test assertions.

- [ ] **Step 1: Run the failing test to verify current state**

```bash
node --test Capstone-Website/web/src/features/admin/components/billing/ReservationPaymentReviewTab.test.mjs
```
Expected: FAIL on line 28 (Category segmentation assertions fail on `/All Payments/` or `/1-Month Advance & Deposit/`).

- [ ] **Step 2: Update `ReservationPaymentReviewTab.jsx` category option labels**

In `Capstone-Website/web/src/features/admin/components/billing/ReservationPaymentReviewTab.jsx`:
```jsx
<select
  value={categoryFilter}
  onChange={(e) => setCategoryFilter(e.target.value)}
  className="w-full h-8 rounded-lg border border-border bg-card px-2 text-[11px] font-semibold text-card-foreground shadow-xs focus:border-slate-400 focus:outline-none cursor-pointer truncate"
  title="Filter by payment type"
  aria-label="Filter by payment type"
>
  <option value="all">All Payments ({categoryCounts.all})</option>
  <option value="reservation_fee">Reservation Fees ({categoryCounts.reservation_fee})</option>
  <option value="advance_deposit">1-Month Advance & Deposit ({categoryCounts.advance_deposit})</option>
</select>
```

- [ ] **Step 3: Re-run test to verify it passes**

```bash
node --test Capstone-Website/web/src/features/admin/components/billing/ReservationPaymentReviewTab.test.mjs
```
Expected: PASS (all 5 test assertions pass).

- [ ] **Step 4: Commit changes**

```bash
git add web/src/features/admin/components/billing/ReservationPaymentReviewTab.jsx
git commit -m "fix(billing): align reservation payment category option labels with test spec"
```

---

### Task 2: Fix Room Name Input Sanitization in RoomConfigModal

**Files:**
- Create: `Capstone-Website/web/src/features/admin/components/rooms/roomNameInputSanitization.test.mjs`
- Modify: `Capstone-Website/web/src/features/admin/components/rooms/RoomConfigModal.jsx:258-261`

**Interfaces:**
- Consumes: User typing events in the `name` text input.
- Produces: Sanitized room name allowing letters, numbers, spaces, and hyphens up to 50 characters (`/^[a-zA-Z0-9\s-]+$/`).

- [ ] **Step 1: Write the test verifying room name sanitization logic**

Create `Capstone-Website/web/src/features/admin/components/rooms/roomNameInputSanitization.test.mjs`:
```javascript
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const modalCode = fs.readFileSync(
  path.resolve("src/features/admin/components/rooms/RoomConfigModal.jsx"),
  "utf8",
);

test("RoomConfigModal allows alphanumeric characters, spaces, and hyphens in room name", () => {
  const sanitize = (value) => value.replace(/[^a-zA-Z0-9\s-]/g, "").slice(0, 50);

  assert.equal(sanitize("Deluxe Room 101-A"), "Deluxe Room 101-A");
  assert.equal(sanitize("Suite #2 (Special)"), "Suite 2 Special");
  assert.equal(sanitize("A".repeat(60)).length, 50);
});

test("RoomConfigModal source code includes alphanumeric regex for name field", () => {
  assert.match(modalCode, /replace\(\/\[\^a-zA-Z0-9\\s-\]\/g,\s*""\)/);
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
node --test Capstone-Website/web/src/features/admin/components/rooms/roomNameInputSanitization.test.mjs
```
Expected: FAIL on the source code regex assertion.

- [ ] **Step 3: Update `RoomConfigModal.jsx` handleFieldChange**

In `Capstone-Website/web/src/features/admin/components/rooms/RoomConfigModal.jsx`:
```javascript
  const handleFieldChange = (field, value) => {
    if (field === "name") {
      const allowedName = value.replace(/[^a-zA-Z0-9\s-]/g, "").slice(0, 50);
      setDraftRoom((prev) => ({ ...prev, name: allowedName }));
    } else if (field === "roomNumber") {
      const digitsOnly = value.replace(/\D/g, "");
      setDraftRoom((prev) => ({ ...prev, roomNumber: digitsOnly }));
    } else {
      setDraftRoom((prev) => ({
        ...prev,
        [field]: value,
      }));
    }
  };
```

- [ ] **Step 4: Re-run test to verify it passes**

```bash
node --test Capstone-Website/web/src/features/admin/components/rooms/roomNameInputSanitization.test.mjs
```
Expected: PASS.

- [ ] **Step 5: Commit changes**

```bash
git add web/src/features/admin/components/rooms/RoomConfigModal.jsx web/src/features/admin/components/rooms/roomNameInputSanitization.test.mjs
git commit -m "fix(rooms): allow alphanumeric and hyphens in RoomConfigModal name input"
```

---

### Task 3: Ensure Custom Room Name Search Filtering & Assistant Header Parity

**Files:**
- Modify: `Capstone-Website/web/src/features/admin/pages/RoomAvailabilityPage.jsx:280-285`
- Test: `Capstone-Website/web/src/features/admin/pages/roomSearchFilter.test.mjs`

**Interfaces:**
- Consumes: `searchTerm` and `rooms` array.
- Produces: Filtered rooms matching either `room.name` or `room.roomNumber` (case-insensitive and safe against nulls).

- [ ] **Step 1: Write the test verifying room search filter behavior**

Create `Capstone-Website/web/src/features/admin/pages/roomSearchFilter.test.mjs`:
```javascript
import assert from "node:assert/strict";
import test from "node:test";

test("search filtering matches roomNumber and custom room name safely", () => {
  const rooms = [
    { roomNumber: "220", name: "Corner Deluxe Suite" },
    { roomNumber: "221", name: "" },
    { roomNumber: "305", name: "Studio Room" },
  ];

  const filter = (query) =>
    rooms.filter((room) => {
      const q = (query || "").trim().toLowerCase();
      if (!q) return true;
      const matchName = String(room.name || "").toLowerCase().includes(q);
      const matchNum = String(room.roomNumber || "").toLowerCase().includes(q);
      return matchName || matchNum;
    });

  assert.equal(filter("220").length, 1);
  assert.equal(filter("Deluxe").length, 1);
  assert.equal(filter("Studio").length, 1);
  assert.equal(filter("nonexistent").length, 0);
  assert.equal(filter("").length, 3);
});
```

- [ ] **Step 2: Run test to verify logic**

```bash
node --test Capstone-Website/web/src/features/admin/pages/roomSearchFilter.test.mjs
```
Expected: PASS.

- [ ] **Step 3: Verify and strengthen `RoomAvailabilityPage.jsx` search matcher**

In `Capstone-Website/web/src/features/admin/pages/RoomAvailabilityPage.jsx`:
```javascript
      const searchNormalized = (searchTerm || "").trim().toLowerCase();
      const matchesSearch =
        !searchNormalized ||
        String(room.name || "").toLowerCase().includes(searchNormalized) ||
        String(room.roomNumber || "").toLowerCase().includes(searchNormalized);
```

- [ ] **Step 4: Commit changes**

```bash
git add web/src/features/admin/pages/RoomAvailabilityPage.jsx web/src/features/admin/pages/roomSearchFilter.test.mjs
git commit -m "feat(rooms): strengthen search filter matching across room number and custom name"
```

---

### Task 4: Move-In Date Resolution & Lease Realignment Verification

**Files:**
- Test: `Capstone-Website/server/controllers/reservationsController.access.test.js`
- Test: `Capstone-Website/web/src/features/admin/components/ReservationDetailsModal.modalErrorClose.test.mjs`

**Interfaces:**
- Consumes: `confirmedMoveInDate` from Move-In action.
- Produces: Synchronized contract lease start and end dates matching the tenant's actual check-in date.

- [ ] **Step 1: Run Move-In resolution frontend and backend test suites**

```bash
node --test Capstone-Website/web/src/features/admin/components/ReservationDetailsModal.modalErrorClose.test.mjs
npm --prefix Capstone-Website/server test -- server/controllers/reservationsController.access.test.js
```
Expected: PASS.

- [ ] **Step 2: Execute full regression run across web and server**

```bash
node Capstone-Website/web/scripts/run-tests.mjs
npm --prefix Capstone-Website/server test
```
Expected: 100% green pass rate across all suites.

---

## Plan Self-Review Checklist
- [x] Spec coverage: Covers Items 2, 3, 4, and 5 with zero placeholders.
- [x] Type consistency: Regex and function signatures are aligned across all modals.
- [x] Global constraints: Upholds no gradients, 1px neutral borders, and strict "Tenant"/"Assistant" naming.
