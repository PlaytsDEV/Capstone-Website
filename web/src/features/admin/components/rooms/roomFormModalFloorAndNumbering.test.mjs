import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  getBranchFloors,
  getNextFloorOption,
  getNextRoomNumberForFloor,
  isRoomNumberDuplicate,
} from "../../utils/roomNumberingUtils.js";

const formModalCode = fs.readFileSync(
  path.resolve("src/features/admin/components/rooms/RoomFormModal.jsx"),
  "utf8",
);

test("RoomFormModal: imports dynamic floor calculation & room numbering utilities", () => {
  assert.match(formModalCode, /import\s*\{\s*useRooms\s*\}\s*from/);
  assert.match(formModalCode, /getBranchFloors/);
  assert.match(formModalCode, /getNextFloorOption/);
  assert.match(formModalCode, /getNextRoomNumberForFloor/);
  assert.match(formModalCode, /isRoomNumberDuplicate/);
});

test("RoomFormModal: uses unified zero-shift floor input with datalist and no jarring toggles", () => {
  // Uses unified input with datalist
  assert.match(formModalCode, /id="rfm-floor"/);
  assert.match(formModalCode, /list="rfm-floor-options"/);
  assert.match(formModalCode, /<datalist\s+id="rfm-floor-options">/);

  // Jarring toggle elements and 'Back to list' button must be completely removed
  assert.doesNotMatch(formModalCode, /isCustomFloor/);
  assert.doesNotMatch(formModalCode, /rfm-floor-cancel-btn/);
  assert.doesNotMatch(formModalCode, /Back to list/);
});

test("RoomFormModal: removes visual Auto badge and reset button from Room Number field header", () => {
  // Visual Auto badge and reset button are removed
  assert.doesNotMatch(formModalCode, /rfm-auto-badge/);
  assert.doesNotMatch(formModalCode, /rfm-reset-suggested-btn/);
  assert.doesNotMatch(formModalCode, /<Sparkles/);

  // Background auto-population and suggestion logic remains intact
  assert.match(formModalCode, /getNextRoomNumberForFloor/);
});

test("RoomFormModal: contains duplicate detection in validation and isFormValid", () => {
  assert.match(formModalCode, /isRoomNumberDuplicate\(allRooms,\s*form\.branch/);
  assert.match(formModalCode, /isDuplicateNumber/);
  assert.match(formModalCode, /!isDuplicateNumber/);
});

test("RoomFormModal: contains edit mode floor change suggested room number indicator", () => {
  assert.match(formModalCode, /suggestedForEditFloor/);
  assert.match(formModalCode, /rfm-floor-change-suggestion/);
  assert.match(formModalCode, /handleApplySuggestedForFloor/);
});
