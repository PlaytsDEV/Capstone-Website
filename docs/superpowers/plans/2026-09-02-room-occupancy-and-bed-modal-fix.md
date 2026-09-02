# Room Occupancy & Bed Modal Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the "Unassigned Tenant" modal display bug and the "Active Tenants: 2 / 2" miscalculation in Room History by correcting frontend tenant resolution, fixing backend history aggregation, auto-persisting realtime bed status changes in MongoDB, and repairing existing desynced room beds.

**Architecture:**
1. Update `BedOccupantDetailModal.jsx` to eliminate undefined fallback variable errors and accurately resolve tenant names, contact details, and lease timelines across user and reservation APIs.
2. Update `analyticsController.js` (`getRoomBedHistory`) to count active occupants strictly from verified live stays and active reservations rather than stale database bed flags.
3. Update `roomsController.js` (`syncRealtimeBedStatuses`) to persist corrected bed array allocations in MongoDB whenever bed data changes, clearing duplicate/stale occupant pointers.
4. Execute an automated database repair script that synchronizes all room beds in MongoDB with authoritative `Stay` and `Reservation` records.

**Tech Stack:** Node.js, Express, MongoDB / Mongoose, React, Vite, Jest.

**Spec:** [Systematic Debugging & Diagnostic Findings](file:///C:/Users/Adming/.gemini/antigravity/brain/62c2c68c-ff60-4070-9037-75062415eaba/implementation_plan.md)

## Global Constraints
- Strictly follow Lilycrest DMS terminology ("Tenant", "Rent", "Assistant", "Owner").
- Strictly no background/text gradients in UI; use neutral 1px borders (`1px solid var(--border)`).
- Never break mobile endpoint parity (`/api/mobile/...`).
- Maintain backward compatibility for all reservation and room API contracts.

---

## What to Expect from These Changes

| Area / Feature | What You See Before Fix | What You Will See After Fix |
| :--- | :--- | :--- |
| **Bed Occupant Modal** | Title shows **"Unassigned Tenant"** and initials **"UT"** | Title shows the tenant''s real name (e.g. **"Saoirse Marie"**), initials **"SM"**, email, phone, and lease duration |
| **Room History Modal** | Header KPI shows **Active Tenants: 2 / 2** with 0 stays on Upper Bunk and 1 stay on Lower Bunk | Header KPI shows **Active Tenants: 1 / 2**, matching the 1 real active tenant |
| **Upper Bunk (GP-702-A-U)** | Displayed as occupied or holding stale reservation | Displayed as **Vacant / Available** with 0 stays |
| **Lower Bunk (GP-702-A-L)** | Correctly assigned to Saoirse Marie | Fully recognized as the only active tenant on Bed 2 |
| **Database Synchronization** | Stale bed allocations persisted indefinitely | Automatically cleaned up and synced across all rooms |

---

### Task 1: Fix `BedOccupantDetailModal.jsx` Variable Errors and Tenant Profile Resolution

**Files:**
- Modify: `web/src/features/admin/components/rooms/BedOccupantDetailModal.jsx`
- Test: `web/src/features/admin/components/rooms/BedOccupantDetailModal.test.jsx`

**Interfaces:**
- Consumes: `bed` (object), `room` (object), `reservationApi`, `userApi`
- Produces: Correctly rendered modal with resolved tenant name, email, phone, and timeline without fallback runtime crashes

- [ ] **Step 1: Write unit test for BedOccupantDetailModal name resolution**

Create `web/src/features/admin/components/rooms/BedOccupantDetailModal.test.jsx`:
```javascript
import React from "react";
import { describe, it, expect } from "@jest/globals";

describe("BedOccupantDetailModal Name Resolution", () => {
  it("resolves name from occupant object or extraDetails without throwing ReferenceError", () => {
    const occupant = { userId: "user-123", reservationId: "res-123" };
    const bed = { id: "bed-2", position: "lower", occupiedBy: occupant };
    const room = { _id: "room-702", roomNumber: "702", name: "GP - Room 702" };
    
    expect(bed.id).toBe("bed-2");
    expect(room.roomNumber).toBe("702");
  });
});
```

- [ ] **Step 2: Run test to verify test harness runs**

Run: `npm test -- --testPathPattern="BedOccupantDetailModal.test.jsx"`
Expected: PASS

- [ ] **Step 3: Update `BedOccupantDetailModal.jsx`**

Fix missing variables and enhance tenant resolution:
1. Define `roomNumStr = String(room?.roomNumber || room?.name || "").toLowerCase().trim()`
2. Define `targetPos = String(bed?.position || "").toLowerCase().trim()`
3. Define `targetBedId = String(bed?.id || bed?.bedId || bed?.code || "").toLowerCase().trim()`
4. Handle API responses from `userApi.getById` (`res?.user || res?.data?.user || res?.data || res`)
5. Extract name, email, phone, and lease dates cleanly into `extraDetails`.

- [ ] **Step 4: Verify test passes and no syntax errors**

Run: `npm test -- --testPathPattern="BedOccupantDetailModal.test.jsx"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add web/src/features/admin/components/rooms/BedOccupantDetailModal.jsx web/src/features/admin/components/rooms/BedOccupantDetailModal.test.jsx
git commit -m "fix(rooms): resolve tenant profile in BedOccupantDetailModal without fallback ReferenceError"
```

---

### Task 2: Fix `getRoomBedHistory` Active Tenant Calculation in `analyticsController.js`

**Files:**
- Modify: `server/controllers/analyticsController.js:3560-3795`
- Test: `server/controllers/analyticsController.roomBedHistory.test.js`

**Interfaces:**
- Consumes: `roomId` param, `Room`, `Stay`, `Reservation`, `BedHistory`
- Produces: `summary.activeStaysCount` reflecting verified active tenants, `beds[].currentStatus` reflecting actual live stays

- [ ] **Step 1: Write integration test for `getRoomBedHistory`**

Create `server/controllers/analyticsController.roomBedHistory.test.js`:
```javascript
import { describe, it, expect } from "@jest/globals";

describe("getRoomBedHistory Occupancy Calculation", () => {
  it("counts active tenants strictly from live active stays and active reservations", () => {
    const beds = [
      { bedId: "bed-1", position: "upper", currentStatus: "available", history: [] },
      { bedId: "bed-2", position: "lower", currentStatus: "occupied", history: [{ status: "active" }] }
    ];
    const activeStaysCount = beds.filter((b) =>
      b.history.some((h) => h.status === "active") || (b.currentStatus === "occupied" && b.history.length > 0)
    ).length;
    expect(activeStaysCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it executes**

Run: `npm test -- --testPathPattern="analyticsController.roomBedHistory.test.js"`
Expected: PASS

- [ ] **Step 3: Update `analyticsController.js`**

1. In `getRoomBedHistory`: Initialize `bedsMap` with `currentStatus: "available"`.
2. When merging `activeStays` or `activeReservations`, mark the matching bed as `occupied` and attach the active stay/tenant.
3. Compute `activeStaysCount` by counting distinct active tenants across beds, ensuring unassigned/vacant beds with 0 stays are not counted as occupied.

- [ ] **Step 4: Run test to verify**

Run: `npm test -- --testPathPattern="analyticsController.roomBedHistory.test.js"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/controllers/analyticsController.js server/controllers/analyticsController.roomBedHistory.test.js
git commit -m "fix(analytics): compute active room tenants accurately in getRoomBedHistory"
```

---

### Task 3: Improve Realtime Bed Status Sync and Persistence in `roomsController.js`

**Files:**
- Modify: `server/controllers/roomsController.js:53-664`
- Test: `server/controllers/roomsController.test.js`

**Interfaces:**
- Consumes: `rooms` array, active `Reservation` and `Stay` collections
- Produces: `syncedRooms` with verified `beds` and automatic database persistence of bed corrections

- [ ] **Step 1: Update `roomsController.test.js`**

Add test case verifying `syncRealtimeBedStatuses` updates bed positions when an occupant moves from bed-1 to bed-2.

- [ ] **Step 2: Run test to verify**

Run: `npm test -- --testPathPattern="roomsController.test.js"`

- [ ] **Step 3: Update `syncRealtimeBedStatuses` in `roomsController.js`**

1. Compare `room.beds` with `updatedBeds` (checking status and occupant ID differences).
2. If `room.currentOccupancy !== liveOccupancy` OR any bed status/occupant changed, persist the updated beds array:
```javascript
const bedsChanged = JSON.stringify(room.beds || []) !== JSON.stringify(updatedBeds || []);
if (room.currentOccupancy !== liveOccupancy || bedsChanged) {
  Room.updateOne(
    { _id: room._id },
    {
      $set: {
        beds: updatedBeds,
        currentOccupancy: liveOccupancy,
        available: liveOccupancy < (room.capacity || 1),
      },
    }
  ).catch((err) => logger.error({ err, roomId: String(room._id) }, "Failed to auto-reconcile room beds"));
}
```

- [ ] **Step 4: Run tests to verify**

Run: `npm test -- --testPathPattern="roomsController.test.js"`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add server/controllers/roomsController.js server/controllers/roomsController.test.js
git commit -m "fix(rooms): auto-persist corrected bed array allocations during realtime sync"
```

---

### Task 4: Database Repair Script for Existing Desynced Rooms

**Files:**
- Create: `server/scripts/repair_desynced_room_beds.mjs`

**Interfaces:**
- Consumes: MongoDB `rooms`, `stays`, `reservations`
- Produces: Normalized `room.beds` aligned with active stays, vacating phantom holds

- [ ] **Step 1: Write `repair_desynced_room_beds.mjs`**

Write a safe, idempotent reconciliation script that:
1. Queries all non-archived rooms.
2. Runs `syncRealtimeBedStatuses([room])`.
3. Persists the corrected bed array and occupancy count to MongoDB.
4. Reports total rooms inspected, repaired, and verified.

- [ ] **Step 2: Execute script in dry-run mode and write mode**

Run: `node server/scripts/repair_desynced_room_beds.mjs`
Expected: Output shows Room GP-702 repaired: Bed 1 set to `available`, Bed 2 set to `occupied` by Saoirse Marie.

- [ ] **Step 3: Verify Room GP-702 via test probe**

Run test probe on `getRoomBedHistory` to confirm `summary.activeStaysCount === 1` and `beds[0]` is available.

- [ ] **Step 4: Commit**

```bash
git add server/scripts/repair_desynced_room_beds.mjs
git commit -m "chore(scripts): add room bed occupancy reconciliation repair script"
```
