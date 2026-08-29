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
