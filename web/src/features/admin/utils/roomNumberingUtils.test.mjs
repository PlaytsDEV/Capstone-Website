import test from "node:test";
import assert from "node:assert/strict";
import {
  getBranchFloors,
  getNextFloorOption,
  getStartingRoomNumberForFloor,
  getNextRoomNumberForFloor,
  isRoomNumberDuplicate,
} from "./roomNumberingUtils.js";

test("getBranchFloors: returns sorted unique floor numbers for a branch", () => {
  const mockRooms = [
    { _id: "1", branch: "gil-puyat", floor: 3 },
    { _id: "2", branch: "gil-puyat", floor: 1 },
    { _id: "3", branch: "gil-puyat", floor: 2 },
    { _id: "4", branch: "gil-puyat", floor: 2 }, // Duplicate floor
    { _id: "5", branch: "guadalupe", floor: 4 }, // Different branch
  ];

  const floors = getBranchFloors(mockRooms, "gil-puyat");
  assert.deepEqual(floors, [1, 2, 3]);
});

test("getBranchFloors: filters out archived rooms", () => {
  const mockRooms = [
    { _id: "1", branch: "gil-puyat", floor: 1, isArchived: false },
    { _id: "2", branch: "gil-puyat", floor: 4, isArchived: true },
  ];

  const floors = getBranchFloors(mockRooms, "gil-puyat");
  assert.deepEqual(floors, [1]);
});

test("getBranchFloors: defaults to [1] when rooms is empty or no valid floors found", () => {
  assert.deepEqual(getBranchFloors([]), [1]);
  assert.deepEqual(getBranchFloors(null), [1]);
  assert.deepEqual(getBranchFloors([{ floor: -1 }, { floor: "invalid" }], "gil-puyat"), [1]);
});

test("getBranchFloors: returns all rooms floors when branch is 'all' or omitted", () => {
  const mockRooms = [
    { _id: "1", branch: "gil-puyat", floor: 1 },
    { _id: "2", branch: "guadalupe", floor: 3 },
  ];

  assert.deepEqual(getBranchFloors(mockRooms), [1, 3]);
  assert.deepEqual(getBranchFloors(mockRooms, "all"), [1, 3]);
});

test("getNextFloorOption: returns max floor + 1 or defaults to 1", () => {
  assert.equal(getNextFloorOption([]), 1);
  assert.equal(getNextFloorOption(null), 1);
  assert.equal(getNextFloorOption([1, 2]), 3);
  assert.equal(getNextFloorOption([1, 2, 4]), 5);
  assert.equal(getNextFloorOption(["1", "3"]), 4);
});

test("getStartingRoomNumberForFloor: produces standard '${F}01' conventions", () => {
  assert.equal(getStartingRoomNumberForFloor(1), "101");
  assert.equal(getStartingRoomNumberForFloor(2), "201");
  assert.equal(getStartingRoomNumberForFloor(5), "501");
  assert.equal(getStartingRoomNumberForFloor(9), "901");
  assert.equal(getStartingRoomNumberForFloor(10), "1001");
  assert.equal(getStartingRoomNumberForFloor("3"), "301");
  assert.equal(getStartingRoomNumberForFloor(0), "101");
  assert.equal(getStartingRoomNumberForFloor(-2), "101");
  assert.equal(getStartingRoomNumberForFloor(null), "101");
});

test("getNextRoomNumberForFloor: calculates next sequential room number on existing floor", () => {
  const mockRooms = [
    { _id: "1", branch: "gil-puyat", floor: 2, roomNumber: "201" },
    { _id: "2", branch: "gil-puyat", floor: 2, roomNumber: "202" },
    { _id: "3", branch: "gil-puyat", floor: 2, roomNumber: "206" },
  ];

  // Max is 206 -> should suggest 207
  const nextRoom = getNextRoomNumberForFloor(mockRooms, "gil-puyat", 2);
  assert.equal(nextRoom, "207");
});

test("getNextRoomNumberForFloor: returns starting room number for empty floor", () => {
  const mockRooms = [
    { _id: "1", branch: "gil-puyat", floor: 1, roomNumber: "101" },
  ];

  // Floor 3 has no rooms -> should suggest 301
  const nextRoom = getNextRoomNumberForFloor(mockRooms, "gil-puyat", 3);
  assert.equal(nextRoom, "301");
});

test("getNextRoomNumberForFloor: ignores archived rooms and different branches", () => {
  const mockRooms = [
    { _id: "1", branch: "gil-puyat", floor: 2, roomNumber: "201" },
    { _id: "2", branch: "gil-puyat", floor: 2, roomNumber: "209", isArchived: true },
    { _id: "3", branch: "guadalupe", floor: 2, roomNumber: "215" },
  ];

  // 209 is archived, 215 is another branch -> max for gil-puyat floor 2 is 201 -> suggest 202
  const nextRoom = getNextRoomNumberForFloor(mockRooms, "gil-puyat", 2);
  assert.equal(nextRoom, "202");
});

test("getNextRoomNumberForFloor: handles non-numeric room names gracefully", () => {
  const mockRooms = [
    { _id: "1", branch: "gil-puyat", floor: 4, roomNumber: "Penthouse A" },
    { _id: "2", branch: "gil-puyat", floor: 4, roomNumber: "Suite B" },
  ];

  // No pure numeric rooms -> fallback to floor starting number 401
  const nextRoom = getNextRoomNumberForFloor(mockRooms, "gil-puyat", 4);
  assert.equal(nextRoom, "401");
});

test("isRoomNumberDuplicate: detects duplicate room numbers in same branch", () => {
  const mockRooms = [
    { _id: "r101", branch: "gil-puyat", roomNumber: "101" },
    { _id: "r102", branch: "gil-puyat", roomNumber: "Room-A" },
    { _id: "r201", branch: "guadalupe", roomNumber: "201" },
    { _id: "r301", branch: "gil-puyat", roomNumber: "301", isArchived: true },
  ];

  // Matches existing active room in same branch
  assert.equal(isRoomNumberDuplicate(mockRooms, "gil-puyat", "101"), true);
  // Case-insensitivity & whitespace trimming
  assert.equal(isRoomNumberDuplicate(mockRooms, "gil-puyat", " room-a "), true);

  // Different branch -> not duplicate
  assert.equal(isRoomNumberDuplicate(mockRooms, "gil-puyat", "201"), false);
  // Archived room -> not duplicate
  assert.equal(isRoomNumberDuplicate(mockRooms, "gil-puyat", "301"), false);
  // Unused number -> not duplicate
  assert.equal(isRoomNumberDuplicate(mockRooms, "gil-puyat", "105"), false);
});

test("isRoomNumberDuplicate: ignores current room ID when editing an existing room", () => {
  const mockRooms = [
    { _id: "r101", branch: "gil-puyat", roomNumber: "101" },
    { _id: "r102", branch: "gil-puyat", roomNumber: "102" },
  ];

  // Editing r101 and keeping its roomNumber as "101" -> not duplicate
  assert.equal(isRoomNumberDuplicate(mockRooms, "gil-puyat", "101", "r101"), false);
  // Editing r101 and changing to "102" which belongs to r102 -> duplicate
  assert.equal(isRoomNumberDuplicate(mockRooms, "gil-puyat", "102", "r101"), true);
});
