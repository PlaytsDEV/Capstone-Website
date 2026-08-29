/**
 * PHASE 4 — electricity/water occupancy follows the tenant's ACTUAL room
 * across a room transfer.
 *
 * These are pure-function tests for the room-scoped occupancy readers added
 * to utilityFlowRules.js. The controller stamps each reservation it is about
 * to bill with `_roomScopedMoveInDate` / `_roomScopedMoveOutDate` taken from
 * the matching BedHistory row for that room; here we simulate that stamp and
 * assert every occupancy-resolving helper honours it, and that an UNSTAMPED
 * reservation (a tenant with no BedHistory row for the room — the common
 * no-transfer case) behaves exactly as before.
 */
import { describe, expect, test } from "@jest/globals";
import {
  filterBillableReservationsForPeriod,
  buildTenantEventsForPeriod,
  findBedOccupancyOverlaps,
  findMissingElectricityLifecycleReadings,
  readRoomScopedMoveInDate,
  readRoomScopedMoveOutDate,
} from "./utilityFlowRules.js";

const CYCLE_START = new Date("2026-08-01T00:00:00.000Z");
const CYCLE_END = new Date("2026-09-01T00:00:00.000Z");
const TRANSFER = new Date("2026-08-15T00:00:00.000Z");
const DORM_MOVE_IN = new Date("2026-05-01T00:00:00.000Z"); // long before the cycle

const user = (id) => ({ _id: id, firstName: "T", lastName: id });

describe("room-scoped occupancy readers", () => {
  test("readers fall back to global reservation dates when unstamped", () => {
    const r = { moveInDate: DORM_MOVE_IN, moveOutDate: null };
    expect(readRoomScopedMoveInDate(r)).toBe(DORM_MOVE_IN);
    expect(readRoomScopedMoveOutDate(r)).toBe(null);
  });

  test("readers prefer the stamp when present", () => {
    const r = { moveInDate: DORM_MOVE_IN, moveOutDate: null, _roomScopedMoveInDate: TRANSFER, _roomScopedMoveOutDate: TRANSFER };
    expect(readRoomScopedMoveInDate(r)).toBe(TRANSFER);
    expect(readRoomScopedMoveOutDate(r)).toBe(TRANSFER);
  });
});

describe("filterBillableReservationsForPeriod — source room (transferred OUT)", () => {
  const base = { _id: "res1", userId: user("u1"), status: "moveIn", moveInDate: DORM_MOVE_IN, moveOutDate: null };

  test("without a room-scoped stamp the transferred tenant would wrongly still be billable for the whole cycle", () => {
    const kept = filterBillableReservationsForPeriod({
      reservations: [base],
      cycleStart: CYCLE_START,
      cycleEnd: CYCLE_END,
    });
    expect(kept).toHaveLength(1); // the pre-fix behaviour, for contrast
  });

  test("with _roomScopedMoveOutDate = transfer date, the tenant is still billable (their pre-transfer segment overlaps the cycle) ...", () => {
    const stamped = { ...base, _roomScopedMoveOutDate: TRANSFER };
    const kept = filterBillableReservationsForPeriod({
      reservations: [stamped],
      cycleStart: CYCLE_START,
      cycleEnd: CYCLE_END,
    });
    expect(kept).toHaveLength(1);
  });

  test("... but is EXCLUDED once the cycle starts entirely after the room-scoped move-out", () => {
    const stamped = { ...base, _roomScopedMoveOutDate: TRANSFER };
    const kept = filterBillableReservationsForPeriod({
      reservations: [stamped],
      cycleStart: new Date("2026-09-01T00:00:00.000Z"), // Sept cycle — after Aug 15 transfer
      cycleEnd: new Date("2026-10-01T00:00:00.000Z"),
    });
    expect(kept).toHaveLength(0); // no post-transfer source-room billing
  });
});

describe("buildTenantEventsForPeriod — destination room (transferred IN mid-cycle)", () => {
  // Cycle Aug1..Sep1, room-start reading 1000. Tenant transferred IN on Aug 15
  // (their dorm move-in is May 1). A moveIn reading of 1200 was recorded on the
  // NEW room on Aug 15.
  const period = { startDate: CYCLE_START, endDate: CYCLE_END, startReading: 1000 };
  const readings = [
    { tenantId: "u1", eventType: "moveIn", date: TRANSFER, reading: 1200 },
  ];

  test("WITHOUT the room-scoped stamp the tenant is wrongly treated as present from the period start reading (leak: billed for pre-transfer consumption)", () => {
    const events = buildTenantEventsForPeriod({
      period,
      reservations: [{ _id: "res1", userId: user("u1"), status: "moveIn", moveInDate: DORM_MOVE_IN, moveOutDate: null }],
      readings,
    });
    expect(events).toHaveLength(1);
    expect(events[0].moveInReading).toBe(1000); // == period.startReading — the bug
  });

  test("WITH _roomScopedMoveInDate = transfer date, the tenant opens their segment at their transfer-day reading (1200), not the period start", () => {
    const events = buildTenantEventsForPeriod({
      period,
      reservations: [{ _id: "res1", userId: user("u1"), status: "moveIn", moveInDate: DORM_MOVE_IN, moveOutDate: null, _roomScopedMoveInDate: TRANSFER }],
      readings,
    });
    expect(events).toHaveLength(1);
    expect(events[0].moveInReading).toBe(1200);
  });
});

describe("buildTenantEventsForPeriod — source room (transferred OUT mid-cycle)", () => {
  const period = { startDate: CYCLE_START, endDate: CYCLE_END, startReading: 500 };
  const readings = [
    { tenantId: "u1", eventType: "moveOut", date: TRANSFER, reading: 640 },
  ];

  test("the transfer-day moveOut reading caps the tenant's source-room segment", () => {
    const events = buildTenantEventsForPeriod({
      period,
      // present from before the cycle -> moveInReading = startReading; scoped move-out = transfer
      reservations: [{ _id: "res1", userId: user("u1"), status: "moveIn", moveInDate: DORM_MOVE_IN, moveOutDate: null, _roomScopedMoveOutDate: TRANSFER }],
      readings,
    });
    expect(events).toHaveLength(1);
    expect(events[0].moveInReading).toBe(500);
    expect(events[0].moveOutReading).toBe(640); // consumption after 640 is NOT theirs
  });
});

describe("findBedOccupancyOverlaps — a transfer is not an overlap", () => {
  // Tenant A leaves bed X on Aug 15 (scoped move-out). Tenant B takes bed X
  // from Aug 15 (scoped move-in). Same bed, adjacent — must NOT be flagged.
  const tenantA = {
    _id: "resA", userId: user("uA"), status: "moveIn",
    selectedBed: { id: "bedX" }, moveInDate: DORM_MOVE_IN, moveOutDate: null,
    _roomScopedMoveOutDate: TRANSFER,
  };
  const tenantB = {
    _id: "resB", userId: user("uB"), status: "moveIn",
    selectedBed: { id: "bedX" }, moveInDate: TRANSFER, moveOutDate: null,
    _roomScopedMoveInDate: TRANSFER,
  };

  test("adjacent same-bed occupancy across a transfer boundary is not an overlap", () => {
    const result = findBedOccupancyOverlaps({
      reservations: [tenantA, tenantB],
      cycleStart: CYCLE_START,
      cycleEnd: CYCLE_END,
    });
    expect(result.hasOverlaps).toBe(false);
  });

  test("a genuine double-booking IS still flagged (no stamps)", () => {
    const result = findBedOccupancyOverlaps({
      reservations: [
        { _id: "r1", userId: user("u1"), status: "moveIn", selectedBed: { id: "bedX" }, moveInDate: new Date("2026-08-02"), moveOutDate: null },
        { _id: "r2", userId: user("u2"), status: "moveIn", selectedBed: { id: "bedX" }, moveInDate: new Date("2026-08-10"), moveOutDate: null },
      ],
      cycleStart: CYCLE_START,
      cycleEnd: CYCLE_END,
    });
    expect(result.hasOverlaps).toBe(true);
  });
});

describe("findMissingElectricityLifecycleReadings — transfer boundary readings", () => {
  const period = { startDate: CYCLE_START, endDate: CYCLE_END, startReading: 100 };

  test("a room-scoped move-out inside the cycle REQUIRES an exact-date move-out reading, even though the reservation status is still moveIn", () => {
    const missing = findMissingElectricityLifecycleReadings({
      period,
      reservations: [{
        _id: "res1", userId: user("u1"), status: "moveIn",
        moveInDate: DORM_MOVE_IN, moveOutDate: null, _roomScopedMoveOutDate: TRANSFER,
      }],
      readings: [], // no transfer-day reading provided
    });
    expect(missing.hasMissingReadings).toBe(true);
    expect(missing.missingMoveOutReadings).toHaveLength(1);
  });

  test("providing the transfer-day move-out reading satisfies the check", () => {
    const missing = findMissingElectricityLifecycleReadings({
      period,
      reservations: [{
        _id: "res1", userId: user("u1"), status: "moveIn",
        moveInDate: DORM_MOVE_IN, moveOutDate: null, _roomScopedMoveOutDate: TRANSFER,
      }],
      readings: [{ tenantId: "u1", eventType: "moveOut", date: TRANSFER, reading: 240 }],
    });
    expect(missing.hasMissingReadings).toBe(false);
  });

  test("a transferred-IN tenant needs an exact-date move-in reading on the transfer date", () => {
    const missing = findMissingElectricityLifecycleReadings({
      period,
      reservations: [{
        _id: "res1", userId: user("u1"), status: "moveIn",
        moveInDate: DORM_MOVE_IN, moveOutDate: null, _roomScopedMoveInDate: TRANSFER,
      }],
      readings: [],
    });
    expect(missing.missingMoveInReadings).toHaveLength(1);
  });

  test("a normal tenant present from before the cycle needs neither (no stamp, no regression)", () => {
    const missing = findMissingElectricityLifecycleReadings({
      period,
      reservations: [{
        _id: "res1", userId: user("u1"), status: "moveIn",
        moveInDate: DORM_MOVE_IN, moveOutDate: null,
      }],
      readings: [],
    });
    expect(missing.hasMissingReadings).toBe(false);
  });
});
