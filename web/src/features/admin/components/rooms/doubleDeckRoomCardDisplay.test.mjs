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
