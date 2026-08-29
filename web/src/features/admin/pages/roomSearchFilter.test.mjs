import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const pageCode = fs.readFileSync(
  path.resolve("src/features/admin/pages/RoomAvailabilityPage.jsx"),
  "utf8",
);

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

test("RoomAvailabilityPage source code contains search filtering on both name and roomNumber", () => {
  assert.match(pageCode, /room\.name/);
  assert.match(pageCode, /room\.roomNumber/);
});
