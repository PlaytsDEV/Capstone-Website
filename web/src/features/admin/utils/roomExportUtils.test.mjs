import test from "node:test";
import assert from "node:assert/strict";
import {
  ROOM_CSV_COLUMNS,
  formatDate,
  formatRoomsForCSV,
  getEffectiveOccupancy,
  getRoomStatusLabel,
  sanitizeSlug,
} from "./roomExportUtils.js";

test("ROOM_CSV_COLUMNS has required standard headers", () => {
  const keys = ROOM_CSV_COLUMNS.map((col) => col.key);
  assert.ok(keys.includes("roomNumber"));
  assert.ok(keys.includes("roomName"));
  assert.ok(keys.includes("branch"));
  assert.ok(keys.includes("floor"));
  assert.ok(keys.includes("type"));
  assert.ok(keys.includes("capacity"));
  assert.ok(keys.includes("occupiedBeds"));
  assert.ok(keys.includes("availableBeds"));
  assert.ok(keys.includes("maintenanceBeds"));
  assert.ok(keys.includes("occupancyRatio"));
  assert.ok(keys.includes("occupancyRate"));
  assert.ok(keys.includes("status"));
  assert.ok(keys.includes("monthlyRent"));
  assert.ok(keys.includes("intendedTenant"));
  assert.ok(keys.includes("amenities"));
});

test("formatDate handles ISO strings, nulls, and invalid dates", () => {
  assert.equal(formatDate("2026-09-01T00:00:00.000Z"), "2026-09-01");
  assert.equal(formatDate(null), "—");
  assert.equal(formatDate("invalid-date-string"), "—");
});

test("sanitizeSlug cleans branch names cleanly", () => {
  assert.equal(sanitizeSlug("Gil Puyat"), "gil_puyat");
  assert.equal(sanitizeSlug("guadalupe"), "guadalupe");
  assert.equal(sanitizeSlug("all"), "all");
  assert.equal(sanitizeSlug(""), "all");
});

test("getEffectiveOccupancy accurately counts bed occupancy and DB currentOccupancy", () => {
  const roomWithBeds = {
    currentOccupancy: 1,
    beds: [
      { id: "b1", status: "occupied", occupiedBy: { userId: "u1" } },
      { id: "b2", status: "reserved", occupiedBy: { userId: "u2" } },
      { id: "b3", status: "available" },
      { id: "b4", status: "maintenance" },
    ],
  };
  assert.equal(getEffectiveOccupancy(roomWithBeds), 2);

  const roomWithDbCountOnly = {
    currentOccupancy: 3,
    beds: [],
  };
  assert.equal(getEffectiveOccupancy(roomWithDbCountOnly), 3);
});

test("getRoomStatusLabel identifies Available, Partial, Full, and Maintenance", () => {
  const availableRoom = {
    capacity: 2,
    beds: [
      { id: "b1", status: "available" },
      { id: "b2", status: "available" },
    ],
  };
  assert.equal(getRoomStatusLabel(availableRoom), "Available");

  const partialRoom = {
    capacity: 4,
    beds: [
      { id: "b1", status: "occupied", occupiedBy: { userId: "u1" } },
      { id: "b2", status: "available" },
      { id: "b3", status: "available" },
      { id: "b4", status: "available" },
    ],
  };
  assert.equal(getRoomStatusLabel(partialRoom), "Partial");

  const fullRoom = {
    capacity: 2,
    beds: [
      { id: "b1", status: "occupied", occupiedBy: { userId: "u1" } },
      { id: "b2", status: "occupied", occupiedBy: { userId: "u2" } },
    ],
  };
  assert.equal(getRoomStatusLabel(fullRoom), "Full");

  const maintenanceRoom = {
    capacity: 2,
    beds: [
      { id: "b1", status: "maintenance" },
      { id: "b2", status: "maintenance" },
    ],
  };
  assert.equal(getRoomStatusLabel(maintenanceRoom), "Maintenance");
});

test("formatRoomsForCSV formats room records safely with calculations", () => {
  const mockRooms = [
    {
      _id: "r1",
      roomNumber: "101",
      name: "Deluxe Quad A",
      branch: "gil-puyat",
      floor: 1,
      type: "quadruple-sharing",
      capacity: 4,
      monthlyPrice: 5500,
      intendedTenant: "female",
      amenities: ["Air Conditioning", "WiFi", "Study Desk"],
      beds: [
        { id: "b1", status: "occupied", occupiedBy: { userId: "u1" } },
        { id: "b2", status: "occupied", occupiedBy: { userId: "u2" } },
        { id: "b3", status: "available" },
        { id: "b4", status: "maintenance" },
      ],
    },
    {
      _id: "r2",
      roomNumber: "201",
      name: "Private Suite",
      branch: "guadalupe",
      floor: 2,
      type: "private",
      capacity: 1,
      price: 12000,
      beds: [{ id: "b1", status: "available" }],
    },
  ];

  const rows = formatRoomsForCSV(mockRooms);
  assert.equal(rows.length, 2);

  // Row 1
  assert.equal(rows[0].roomNumber, "101");
  assert.equal(rows[0].roomName, "Deluxe Quad A");
  assert.equal(rows[0].branch, "Gil Puyat");
  assert.equal(rows[0].floor, "Floor 1");
  assert.equal(rows[0].type, "Quadruple Sharing");
  assert.equal(rows[0].capacity, 4);
  assert.equal(rows[0].occupiedBeds, 2);
  assert.equal(rows[0].availableBeds, 1);
  assert.equal(rows[0].maintenanceBeds, 1);
  assert.equal(rows[0].occupancyRatio, "2/4");
  assert.equal(rows[0].occupancyRate, "50.0%");
  assert.equal(rows[0].status, "Partial");
  assert.equal(rows[0].monthlyRent, "5500.00");
  assert.equal(rows[0].intendedTenant, "Female");
  assert.equal(rows[0].amenities, "Air Conditioning; WiFi; Study Desk");

  // Row 2
  assert.equal(rows[1].roomNumber, "201");
  assert.equal(rows[1].type, "Private Room");
  assert.equal(rows[1].occupancyRatio, "0/1");
  assert.equal(rows[1].status, "Available");
  assert.equal(rows[1].monthlyRent, "12000.00");
  assert.equal(rows[1].intendedTenant, "Any / General");
  assert.equal(rows[1].amenities, "Standard");
});
