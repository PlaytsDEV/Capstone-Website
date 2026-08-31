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

test("RoomFormModal: imports dynamic floor dropdown & room numbering utilities", () => {
  assert.match(formModalCode, /import\s*\{\s*useRooms\s*\}\s*from/);
  assert.match(formModalCode, /getBranchFloors/);
  assert.match(formModalCode, /getNextFloorOption/);
  assert.match(formModalCode, /getNextRoomNumberForFloor/);
  assert.match(formModalCode, /isRoomNumberDuplicate/);
  assert.match(formModalCode, /RotateCcw/);
  assert.match(formModalCode, /Sparkles/);
});

test("RoomFormModal: contains floor dropdown and custom floor switch options", () => {
  assert.match(formModalCode, /add-next-floor/);
  assert.match(formModalCode, /isCustomFloor/);
  assert.match(formModalCode, /rfm-floor-cancel-btn/);
  assert.match(formModalCode, /Back to list/);
});

test("RoomFormModal: contains auto-generated badge and reset suggested button", () => {
  assert.match(formModalCode, /rfm-auto-badge/);
  assert.match(formModalCode, /rfm-reset-suggested-btn/);
  assert.match(formModalCode, /handleResetToSuggested/);
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
