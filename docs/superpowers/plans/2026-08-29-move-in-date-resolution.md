# Smart Move-In Date Resolution & Alignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the smart hybrid move-in date resolution where the system pre-fills the tenant's agreed/scheduled move-in date upon check-in, provides rapid 1-click date toggle presets ("Scheduled Date" vs "Today"), saves `confirmedMoveInDate` canonically in MongoDB, and aligns contract lease start/end dates and utility tracking.

**Architecture:** 
1. **Frontend (`ReservationDetailsModal.jsx`):** Dynamically initialize the Move-In confirmation form's `actualMoveInDate` to the tenant's scheduled `moveInDate` (fallback to today if missing), provide 1-click date chips (`Scheduled: Sep 1, 2026` / `Today: Aug 29, 2026`), and submit both `actualMoveInDate` and `confirmedMoveInDate`.
2. **Backend (`reservationLifecycleController.js`):** Normalize `actualMoveInDate` / `confirmedMoveInDate` in `ADMIN_ALLOWED` updates upon `moveIn`, persist `confirmedMoveInDate` directly to the `Reservation` document, and pass the verified date to `finalizeStructuredAdvanceCoverage` and `autoGenerateMoveInContract`.
3. **Contract & Stay Records:** Ensure `autoGenerateMoveInContract` realigns the draft lease start/end dates to `confirmedMoveInDate` while maintaining room transfer addendum immutability for existing tenancies.

**Tech Stack:** React 18, Vite, Tailwind CSS, Express.js, MongoDB/Mongoose, Day.js, Jest.

**Spec:** Lilycrest Dormitory Management System — Contract & Reservation Lifecycle Specification.

## Global Constraints
- Always use **"Tenant"** (never "Resident").
- Always use **"Assistant"** / **"Admin Assistant"** / **"Tenant Assistant"** (never "Copilot").
- Always use **"Owner"** / **"Dorm Owner"** (never "Super Admin").
- Always use **"Rent"** / **"Rent Billing"** (never "Rental Fee").
- Always use **"Intended Move-in Date"** or **"Preferred Move-in Date"**.
- Transparent badges with colored status dots without matching colored border outlines.
- Atomic updates and backward compatibility with mobile endpoints.

---

## User Review Required

> [!IMPORTANT]
> **Behavioral Confirmation:**
> When the admin clicks **Move In**:
> 1. The date input will automatically display the **Tenant's Scheduled Move-in Date** (e.g. `2026-09-01`).
> 2. The admin can either leave it as-is, pick another date, or click the **"Use Today"** shortcut chip if the tenant arrived today.
> 3. Submitting the form saves this date as the official `confirmedMoveInDate` which anchors the lease term, advance rent coverage, and electricity meter reading.

---

## Proactive Clarifications & Design Choices

1. **Date Picker Default Value:** 
   - *Behavior:* Pre-fill with `reservation.moveInDate || reservation.intendedMoveInDate || reservation.checkInDate` formatted as `YYYY-MM-DD`. If none exists, pre-fill with today's date (`YYYY-MM-DD`).
2. **Quick Preset Buttons:**
   - Add two quick-action chips directly below the Actual Move-In Date field in the modal:
     - 📌 **Scheduled Date (`Sep 1, 2026`)**
     - 📅 **Today (`Aug 29, 2026`)**
3. **Room Transfers:**
   - Unchanged: Transfer addendums maintain original lease tenancy start dates on the Digital Stay Record while tracking the transfer effective date.

---

## What to Expect from These Changes

- **Visual Outcome:** When opening the Move-In confirmation dialog in the Admin Reservations dashboard, the date input will automatically show the tenant's intended move-in date instead of forcing today's date. Two neat quick-toggle buttons ("Scheduled Date" and "Today") will allow instant 1-click switching.
- **Functional Outcome:** When the admin clicks "Move In", the confirmed date is saved to the database. The tenant's contract lease start and end dates match this arrival date, and advance rent coverage is accurately aligned without shifting monthly billing dates unexpectedly.
- **Workflow Outcome:** Admins can record move-ins ahead of time or retroactively without accidentally distorting the tenant's contract duration or payment schedules.

---

## Proposed Changes

### Component 1: Frontend Move-In Confirmation Modal

#### [MODIFY] [ReservationDetailsModal.jsx](file:///d:/Portfolio/3rdYear/CapstoneSystem/Capstone-Website/web/src/features/admin/components/ReservationDetailsModal.jsx)
- Update `actualMoveInDate` state initialization and `useEffect` to synchronize with `reservation.moveInDate || reservation.intendedMoveInDate || reservation.checkInDate`.
- Add quick-selection preset chips ("Scheduled Date" vs "Today") below the date input.
- Pass both `actualMoveInDate` and `confirmedMoveInDate` in `reservationApi.update()`.

---

### Component 2: Backend Reservation Lifecycle Controller

#### [MODIFY] [reservationLifecycleController.js](file:///d:/Portfolio/3rdYear/CapstoneSystem/Capstone-Website/server/controllers/reservations/reservationLifecycleController.js)
- Explicitly map `req.body.actualMoveInDate` and `req.body.confirmedMoveInDate` to `reservation.confirmedMoveInDate` in `ADMIN_ALLOWED` and upon `isMoveInTransition`.
- Ensure `finalizeStructuredAdvanceCoverage` receives the resolved `actualMoveInDate` (from `reservation.confirmedMoveInDate || req.body.actualMoveInDate || req.body.confirmedMoveInDate`).
- Ensure `autoGenerateMoveInContract` receives `actualMoveInDate` properly.

---

## Tasks

### Task 1: Backend Move-In Date Persistence & Harmonization

**Files:**
- Modify: `server/controllers/reservations/reservationLifecycleController.js:550-680`
- Test: `server/tests/unit/moveInDateResolution.test.js`

**Interfaces:**
- Consumes: `req.body.actualMoveInDate`, `req.body.confirmedMoveInDate`, `existingReservation.moveInDate`
- Produces: `reservation.confirmedMoveInDate` (Date), passed to `finalizeStructuredAdvanceCoverage` & `autoGenerateMoveInContract`

- [ ] **Step 1: Write the failing unit test**

Create `server/tests/unit/moveInDateResolution.test.js`:
```javascript
import { readMoveInDate } from "../../utils/lifecycleNaming.js";

describe("Move-In Date Resolution & Normalization", () => {
  it("prioritizes confirmedMoveInDate over moveInDate and intendedMoveInDate", () => {
    const reservation = {
      intendedMoveInDate: new Date("2026-09-01"),
      moveInDate: new Date("2026-09-01"),
      confirmedMoveInDate: new Date("2026-08-30"),
    };
    const resolved = readMoveInDate(reservation);
    expect(new Date(resolved).toISOString().slice(0, 10)).toBe("2026-08-30");
  });

  it("falls back to moveInDate when confirmedMoveInDate is not set", () => {
    const reservation = {
      intendedMoveInDate: new Date("2026-09-01"),
      moveInDate: new Date("2026-09-01"),
      confirmedMoveInDate: null,
    };
    const resolved = readMoveInDate(reservation);
    expect(new Date(resolved).toISOString().slice(0, 10)).toBe("2026-09-01");
  });
});
```

- [ ] **Step 2: Run test to verify it passes/fails**
Run: `npm test -- server/tests/unit/moveInDateResolution.test.js`

- [ ] **Step 3: Update `reservationLifecycleController.js` to reliably set `confirmedMoveInDate`**
In `server/controllers/reservations/reservationLifecycleController.js`:
```javascript
    if (isMoveInTransition) {
      const resolvedActualMoveIn =
        req.body.confirmedMoveInDate ||
        req.body.actualMoveInDate ||
        req.body.moveInDate ||
        existingReservation.moveInDate ||
        new Date();
      reservation.confirmedMoveInDate = new Date(resolvedActualMoveIn);
    }
```

- [ ] **Step 4: Run unit tests to verify backend changes**
Run: `npm test -- server/tests/unit/moveInDateResolution.test.js`
Expected: PASS

---

### Task 2: Frontend Move-In Form Date Prefill & Ergonomic Shortcuts

**Files:**
- Modify: `web/src/features/admin/components/ReservationDetailsModal.jsx:530-545, 1965-2010, 2090-2100`

**Interfaces:**
- Consumes: `reservation.moveInDate`, `reservation.intendedMoveInDate`, `reservation.checkInDate`
- Produces: `actualMoveInDate` and `confirmedMoveInDate` in payload to `reservationApi.update`

- [ ] **Step 1: Update date resolution logic and shortcuts in `ReservationDetailsModal.jsx`**
Compute `scheduledMoveInStr`:
```javascript
  const scheduledMoveInStr = useMemo(() => {
    const raw = reservation?.moveInDate || reservation?.intendedMoveInDate || reservation?.checkInDate;
    if (!raw) return todayDateStr;
    try {
      return toDateInputValue(new Date(raw));
    } catch {
      return todayDateStr;
    }
  }, [reservation?.moveInDate, reservation?.intendedMoveInDate, reservation?.checkInDate, todayDateStr]);
```
Reset `actualMoveInDate` to `scheduledMoveInStr` when `showMeterPrompt` opens:
```javascript
  useEffect(() => {
    if (showMeterPrompt) {
      setActualMoveInDate(scheduledMoveInStr);
    }
  }, [showMeterPrompt, scheduledMoveInStr]);
```

- [ ] **Step 2: Add quick-select preset chips to the UI**
Under the Actual Move-In Date field in `ReservationDetailsModal.jsx`:
```jsx
<div className="flex items-center gap-2 mt-1.5">
  <button
    type="button"
    onClick={() => setActualMoveInDate(scheduledMoveInStr)}
    className={`px-2 py-0.5 text-[11px] rounded border transition-colors ${
      actualMoveInDate === scheduledMoveInStr
        ? "border-slate-400 bg-slate-100 dark:bg-slate-800 text-foreground font-medium"
        : "border-slate-200 dark:border-slate-700 text-muted-foreground hover:text-foreground"
    }`}
  >
    Scheduled: {fmtDate(scheduledMoveInStr)}
  </button>
  <button
    type="button"
    onClick={() => setActualMoveInDate(todayDateStr)}
    className={`px-2 py-0.5 text-[11px] rounded border transition-colors ${
      actualMoveInDate === todayDateStr
        ? "border-slate-400 bg-slate-100 dark:bg-slate-800 text-foreground font-medium"
        : "border-slate-200 dark:border-slate-700 text-muted-foreground hover:text-foreground"
    }`}
  >
    Today: {fmtDate(todayDateStr)}
  </button>
</div>
```

- [ ] **Step 3: Update `reservationApi.update` payload**
Send both `actualMoveInDate` and `confirmedMoveInDate`:
```javascript
  await reservationApi.update(reservation.id, {
    status: "moveIn",
    ...(branchUsesSubmeter && reading !== null ? { meterReading: reading } : {}),
    actualMoveInDate,
    confirmedMoveInDate: actualMoveInDate,
    houseRulesPrepared: true,
  });
```

---

### Task 3: Build Verification & Regression Check

**Files:**
- Test: `web` build check and `server` test suite

- [ ] **Step 1: Run frontend build check**
Run: `npm run build` in `Capstone-Website/web`
Expected: Zero build errors.

- [ ] **Step 2: Run backend tests**
Run: `npm test` in `Capstone-Website/server`
Expected: All tests passing.

---

## Verification Plan

### Automated Tests
- Run unit tests: `npm test -- server/tests/unit/moveInDateResolution.test.js`
- Run frontend build: `npm run build` inside `web`

### Manual Verification
1. Open Admin Dashboard -> Navigate to **Reservations**.
2. Open a reservation with a future or past scheduled move-in date (e.g. `2026-09-01`).
3. Click **Move In** button to open the check-in confirmation panel.
4. Verify the **Actual Move-In Date** field defaults directly to `2026-09-01` (the tenant's scheduled date).
5. Click the **Today** preset chip and verify the date updates immediately to today's date.
6. Click the **Scheduled** preset chip and verify it reverts to `2026-09-01`.
7. Confirm the move-in and check the **Tenant Details -> Contracts** tab to verify the Digital Stay Record displays the confirmed move-in date accurately.
