# Display Custom Room Names on Inventory & Assistant Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display custom room names (e.g. "Room Example") on the outside inventory room cards and Assistant room occupant cards with smart deduplication when the room name is identical to the room number.

**Architecture:** Add pure logic for smart deduplication (`hasDistinctName`) of room names and room types. Integrate this into `DoubleDeckRoomCard.jsx` and `AdminRoomOccupantsCard.jsx` with responsive truncation and full tooltips. Enforce via unit tests in `doubleDeckRoomCardDisplay.test.mjs`.

**Tech Stack:** React 19, Tailwind CSS, Lucide React, Node.js Test Runner (`node:test`).

**Spec:** [Chat aligned design](conversation://0fed7645-51c4-40a2-ad88-64a1a36d4d2e) — Primary bold `Room 220` header, `Room Example • Private` subtitle, smart deduplication if name equals number, responsive truncation with tooltip.

## Global Constraints

- Never use gradients (strictly solid HSL tokens and flat colors).
- Use clean neutral 1px borders (`1px solid var(--border)` / `border-slate-200 dark:border-slate-700`).
- Strict terminology invariants: "Tenant" (never Resident), "Assistant" (never Copilot), "Owner" (never Super Admin), "Rent" (never Rental Fee).
- Skeletons and cards must remain responsive on mobile and desktop viewports.

---

## What to Expect from These Changes

- **Clear Room Identity Outside**: When viewing rooms in the Room Management inventory grid, you will immediately see both the room number (e.g. **Room 220**) and its custom name (e.g. **Room Example • Private**) without needing to click "Manage Room".
- **No Text Redundancy**: If a room doesn't have a special custom name (for example, if the name is just "220" or "Room 220"), the card cleanly displays just the room type (**Private**) so there is no awkward repetition like "220 • Private".
- **Assistant Consistency**: When inspecting room occupants through the Assistant drawer, the custom room name will also appear in the room summary header.
- **Search Alignment**: Searching for a custom room name in the search bar will now match the visible text directly on the card face.

---

### Task 1: Create Test Suite for Room Name Display & Deduplication Logic

**Files:**
- Create: `Capstone-Website/web/src/features/admin/components/rooms/doubleDeckRoomCardDisplay.test.mjs`

**Interfaces:**
- Produces: `isDistinctRoomName(name, roomNumber)` and `getRoomDisplaySubtitle(name, roomNumber, type)` helper contracts.

- [ ] **Step 1: Write the test file**

```javascript
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

test("isDistinctRoomName correctly identifies custom room names", () => {
  const isDistinct = (name, roomNumber) => {
    if (!name || typeof name !== "string") return false;
    const cleanName = name.trim().toLowerCase();
    const cleanNum = String(roomNumber || "").trim().toLowerCase();
    if (!cleanName) return false;
    if (cleanName === cleanNum) return false;
    if (cleanName === `room ${cleanNum}`) return false;
    return true;
  };

  // Distinct cases
  assert.equal(isDistinct("Room Example", "220"), true);
  assert.equal(isDistinct("Deluxe Suite", "101"), true);
  assert.equal(isDistinct("Corner Unit", "204"), true);

  // Redundant / Duplicate cases
  assert.equal(isDistinct("220", "220"), false);
  assert.equal(isDistinct("Room 220", "220"), false);
  assert.equal(isDistinct("ROOM 220", "220"), false);
  assert.equal(isDistinct("", "220"), false);
  assert.equal(isDistinct(null, "220"), false);
});

test("DoubleDeckRoomCard.jsx includes distinct room name in subtitle with truncation and tooltip", () => {
  const cardCode = read("./DoubleDeckRoomCard.jsx");
  assert.match(cardCode, /hasDistinctName/);
  assert.match(cardCode, /title=/);
  assert.match(cardCode, /truncate/);
});

test("AdminRoomOccupantsCard.jsx includes custom room name when distinct", () => {
  const cardCode = read("../assistant/AdminRoomOccupantsCard.jsx");
  assert.match(cardCode, /hasDistinctName|roomDetails\.name/);
});
```

- [ ] **Step 2: Run test to verify it fails before implementation**

Run: `node --test web/src/features/admin/components/rooms/doubleDeckRoomCardDisplay.test.mjs`
Expected: FAIL with missing patterns in `DoubleDeckRoomCard.jsx`

---

### Task 2: Implement Custom Room Name Display in `DoubleDeckRoomCard.jsx`

**Files:**
- Modify: `Capstone-Website/web/src/features/admin/components/rooms/DoubleDeckRoomCard.jsx`

**Interfaces:**
- Consumes: `room.name`, `room.roomNumber`, `room.type` from `useRooms` query.
- Produces: Formatted subtitle `{hasDistinctName ? `${room.name} • ${formattedType}` : formattedType}` with `title` tooltip and text truncation.

- [ ] **Step 1: Update `DoubleDeckRoomCard.jsx`**

Add distinct name calculation:
```jsx
  const roomNumber = room.roomNumber || room.name || "Room";
  const rawRoomName = typeof room.name === "string" ? room.name.trim() : "";
  const rawRoomNum = String(room.roomNumber || "").trim();
  const hasDistinctName =
    Boolean(rawRoomName) &&
    rawRoomName.toLowerCase() !== rawRoomNum.toLowerCase() &&
    rawRoomName.toLowerCase() !== `room ${rawRoomNum}`.toLowerCase();

  const formattedType = room.type ? room.type.replace("-", " ") : "Standard";
  const subtitleText = hasDistinctName ? `${rawRoomName} • ${formattedType}` : formattedType;
```

Update card header subtitle JSX:
```jsx
      {/* Card Top Header */}
      <div className="flex items-start justify-between gap-2 pb-2.5 mb-2.5 border-b border-border/60">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-base font-bold text-foreground tracking-tight">
              Room {roomNumber}
            </span>
            {bedsInMaintenance > 0 && (
              <span
                title={`${bedsInMaintenance} of ${capacity} bed(s) in maintenance`}
                className="text-amber-500 inline-flex items-center shrink-0"
              >
                <Wrench className="w-3.5 h-3.5" />
              </span>
            )}
          </div>
          <span
            className="text-xs text-muted-foreground font-medium capitalize block mt-0.5 truncate max-w-[200px]"
            title={subtitleText}
          >
            {subtitleText}
          </span>
        </div>
```

- [ ] **Step 2: Run test suite to verify DoubleDeckRoomCard passes**

Run: `node --test web/src/features/admin/components/rooms/doubleDeckRoomCardDisplay.test.mjs`

---

### Task 3: Implement Custom Room Name Display in `AdminRoomOccupantsCard.jsx`

**Files:**
- Modify: `Capstone-Website/web/src/features/admin/components/assistant/AdminRoomOccupantsCard.jsx`
- Modify: `Capstone-Website/web/src/features/admin/components/copilot/AdminRoomOccupantsCard.jsx`

**Interfaces:**
- Consumes: `roomDetails.name`, `roomDetails.roomNumber`, `roomDetails.type`, `roomDetails.floor`, `roomDetails.branch`.
- Produces: Header subtitle with distinct room name `{branchLabel} · Floor {floor} · {hasDistinctName ? `${roomDetails.name} · ` : ""}{formattedType}`.

- [ ] **Step 1: Update `AdminRoomOccupantsCard.jsx` in both directories**

Add distinct room name calculation:
```jsx
  const rawRoomName = typeof roomDetails.name === "string" ? roomDetails.name.trim() : "";
  const rawRoomNum = String(roomDetails.roomNumber || "").trim();
  const hasDistinctName =
    Boolean(rawRoomName) &&
    rawRoomName.toLowerCase() !== rawRoomNum.toLowerCase() &&
    rawRoomName.toLowerCase() !== `room ${rawRoomNum}`.toLowerCase();
```

Update header subtext:
```jsx
        <div>
          <h4 className="font-bold text-sm text-foreground">Room {roomDetails.roomNumber}</h4>
          <p className="text-[11px] text-muted-foreground truncate max-w-[240px]" title={`${branchLabel} · Floor {roomDetails.floor || 1} · ${hasDistinctName ? `${rawRoomName} · ` : ""}${roomDetails.type || "Sharing"}`}>
            {branchLabel} · Floor {roomDetails.floor || 1} · {hasDistinctName ? `${rawRoomName} · ` : ""}{roomDetails.type || "Sharing"}
          </p>
        </div>
```

- [ ] **Step 2: Run all web unit tests**

Run: `node web/scripts/run-tests.mjs`
Expected: ALL test files pass.

- [ ] **Step 3: Run web production build check**

Run: `npm run build` in `Capstone-Website/web`
Expected: Build succeeds with 0 errors.
