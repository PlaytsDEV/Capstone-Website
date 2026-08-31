/**
 * Room Numbering & Dynamic Floor Utilities for Lilycrest DMS
 * 
 * Provides helper functions for calculating existing branch floors,
 * generating standard starting and sequential room numbers per floor,
 * and checking for room number duplication.
 */

/**
 * Returns unique, sorted ascending positive integer floor numbers for the given branch.
 * Defaults to [1] if no valid floors are found or if the room list is empty.
 * Filters out archived rooms.
 *
 * @param {Array<Object>} [rooms=[]] - List of room records
 * @param {string} [branch] - Branch slug/name to filter by (or "all" / omitted for all)
 * @returns {number[]} Array of sorted floor numbers (e.g. [1, 2, 3])
 */
export function getBranchFloors(rooms = [], branch) {
  if (!Array.isArray(rooms) || rooms.length === 0) {
    return [1];
  }

  const normalizedBranch = branch ? String(branch).trim().toLowerCase() : null;
  const floorSet = new Set();

  for (const r of rooms) {
    if (!r || r.isArchived === true) continue;

    if (normalizedBranch && normalizedBranch !== "all") {
      const roomBranch = String(r.branch || "").trim().toLowerCase();
      if (roomBranch !== normalizedBranch) continue;
    }

    const floorNum = parseInt(r.floor, 10);
    if (Number.isInteger(floorNum) && floorNum > 0) {
      floorSet.add(floorNum);
    }
  }

  if (floorSet.size === 0) {
    return [1];
  }

  return Array.from(floorSet).sort((a, b) => a - b);
}

/**
 * Computes the next floor number option based on existing floors.
 *
 * @param {number[]} [existingFloors=[]] - Array of existing floor numbers
 * @returns {number} Next floor number (e.g. max + 1, or 1 if empty)
 */
export function getNextFloorOption(existingFloors = []) {
  if (!Array.isArray(existingFloors) || existingFloors.length === 0) {
    return 1;
  }

  const validFloors = existingFloors
    .map((f) => parseInt(f, 10))
    .filter((f) => Number.isInteger(f) && f > 0);

  if (validFloors.length === 0) {
    return 1;
  }

  return Math.max(...validFloors) + 1;
}

/**
 * Returns the standard starting room number for a given floor.
 * Convention: Floor F starts at "${F}01" (e.g. Floor 1 -> "101", Floor 10 -> "1001").
 *
 * @param {number|string} floor - Floor number
 * @returns {string} Standard starting room number string
 */
export function getStartingRoomNumberForFloor(floor) {
  const floorNum = parseInt(floor, 10);
  const validFloor = Number.isInteger(floorNum) && floorNum > 0 ? floorNum : 1;
  return `${validFloor}01`;
}

/**
 * Computes the next recommended sequential room number for a specific floor in a branch.
 * If rooms exist on that floor, finds the max numeric room number and increments by 1.
 * If no numeric rooms exist on that floor, falls back to the floor's starting room number.
 *
 * @param {Array<Object>} [rooms=[]] - List of room records
 * @param {string} [branch] - Target branch
 * @param {number|string} floor - Target floor
 * @returns {string} Next room number string (e.g. "207", "101")
 */
export function getNextRoomNumberForFloor(rooms = [], branch, floor) {
  const targetFloor = parseInt(floor, 10);
  const validFloor = Number.isInteger(targetFloor) && targetFloor > 0 ? targetFloor : 1;
  const normalizedBranch = branch ? String(branch).trim().toLowerCase() : null;

  if (!Array.isArray(rooms) || rooms.length === 0) {
    return getStartingRoomNumberForFloor(validFloor);
  }

  const numericRoomNumbers = [];

  for (const r of rooms) {
    if (!r || r.isArchived === true) continue;

    if (normalizedBranch && normalizedBranch !== "all") {
      const roomBranch = String(r.branch || "").trim().toLowerCase();
      if (roomBranch !== normalizedBranch) continue;
    }

    const roomFloor = parseInt(r.floor, 10);
    if (roomFloor !== validFloor) continue;

    const rawNum = String(r.roomNumber || "").trim();
    if (/^\d+$/.test(rawNum)) {
      const numVal = parseInt(rawNum, 10);
      if (!Number.isNaN(numVal)) {
        numericRoomNumbers.push(numVal);
      }
    }
  }

  if (numericRoomNumbers.length === 0) {
    return getStartingRoomNumberForFloor(validFloor);
  }

  const maxRoomNumber = Math.max(...numericRoomNumbers);
  return String(maxRoomNumber + 1);
}

/**
 * Checks whether a room number already exists for a given branch, excluding archived rooms
 * and optionally excluding a current room ID (for editing).
 *
 * @param {Array<Object>} [rooms=[]] - List of room records
 * @param {string} [branch] - Target branch
 * @param {string} roomNumber - Room number to validate
 * @param {string} [currentRoomId=null] - Optional current room ID to exclude
 * @returns {boolean} True if duplicate room number exists in branch
 */
export function isRoomNumberDuplicate(rooms = [], branch, roomNumber, currentRoomId = null) {
  if (!Array.isArray(rooms) || rooms.length === 0 || !roomNumber) {
    return false;
  }

  const targetRoomNumber = String(roomNumber).trim().toLowerCase();
  if (!targetRoomNumber) return false;

  const targetBranch = branch ? String(branch).trim().toLowerCase() : null;
  const currentIdStr = currentRoomId ? String(currentRoomId).trim() : null;

  return rooms.some((r) => {
    if (!r || r.isArchived === true) return false;

    if (currentIdStr) {
      const roomIdStr = r._id ? String(r._id).trim() : r.id ? String(r.id).trim() : null;
      if (roomIdStr && roomIdStr === currentIdStr) return false;
    }

    if (targetBranch && targetBranch !== "all") {
      const roomBranch = String(r.branch || "").trim().toLowerCase();
      if (roomBranch !== targetBranch) return false;
    }

    const roomNum = String(r.roomNumber || "").trim().toLowerCase();
    return roomNum === targetRoomNumber;
  });
}
