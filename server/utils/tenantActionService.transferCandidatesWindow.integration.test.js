/**
 * AUDIT ITEM 2 — reservation-conflict WINDOW for the transfer room selector.
 *
 * `buildTransferCandidates` must flag a destination RED for a
 * "reservation_conflict" only when another reservation / pending move-in's
 * occupancy window ACTUALLY OVERLAPS the transferee's expected
 * destination-occupancy interval `[transferDate, transfereeEnd)`. A reservation
 * that begins AFTER the transferee's known lease end must NOT block.
 *
 * Cases:
 *   A. Bed free on the transfer day, but another approved reservation covers
 *      that bed DURING the transferee's remaining stay -> unavailable.
 *   B. The other reservation begins AFTER the transferee's known stay/contract
 *      end -> does NOT block (destination stays selectable).
 *   C. No overlapping reservation -> available.
 *   D. (covered in scheduledRoomTransfer.* completion tests) — the completion
 *      re-check independently rejects a conflict created after scheduling; here
 *      we assert the same interval rule the candidate list uses.
 *
 * Runs against a single-node replica set. No PDF / contract machinery — only
 * Room + Reservation + the scheduled-transfer hold lookup are exercised.
 */
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "@jest/globals";
import { MongoMemoryReplSet } from "mongodb-memory-server";

const { Reservation, Room, User, Stay } = await import("../models/index.js");
const { buildTransferCandidates } = await import("./tenantActionService.js");

const CAP = { private: 1, "double-sharing": 2, "quadruple-sharing": 4 };
const RATE = { private: 13500, "double-sharing": 8100, "quadruple-sharing": 5400 };

let mongo;
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri(), { dbName: "xfer_candidates_window" });
}, 120_000);
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
}, 120_000);
beforeEach(async () => {
  await Promise.all([
    Reservation.deleteMany({}),
    Room.deleteMany({}),
    User.deleteMany({}),
    Stay.deleteMany({}),
  ]);
});

function bedsFor(type, prefix) {
  return Array.from({ length: CAP[type] }, (_, i) => ({
    id: `${prefix}-b${i + 1}`,
    position: i % 2 ? "upper" : "lower",
    status: "available",
  }));
}

async function tenant(name = "T") {
  return User.create({
    firebaseUid: `fb-${new mongoose.Types.ObjectId()}`,
    email: `${name}-${new mongoose.Types.ObjectId()}@ex.test`,
    username: `u_${new mongoose.Types.ObjectId().toString().slice(-10)}`,
    firstName: name, lastName: "X", role: "tenant", tenantStatus: "active",
  });
}

/**
 * Transferring tenant in a quad room (roomA), plus an empty double destination
 * (roomB) with beds b1/b2. `transfereeLeaseEnd` seeds the tenant's active Stay
 * lease end — the interval the candidate check uses.
 */
async function seed({ transfereeLeaseEnd }) {
  const t = await tenant("Mover");
  const roomA = await Room.create({
    name: "Room A", roomNumber: "A1", branch: "gil-puyat",
    type: "quadruple-sharing", capacity: 4, currentOccupancy: 1,
    price: RATE["quadruple-sharing"],
    beds: [{ id: "a-b1", position: "lower", status: "occupied", occupiedBy: { userId: t._id } },
      ...bedsFor("quadruple-sharing", "a").slice(1)],
  });
  const roomB = await Room.create({
    name: "Room B", roomNumber: "B1", branch: "gil-puyat",
    type: "double-sharing", capacity: 2, currentOccupancy: 0,
    price: RATE["double-sharing"], beds: bedsFor("double-sharing", "b"),
  });
  const res = await Reservation.create({
    userId: t._id, roomId: roomA._id, status: "moveIn",
    firstName: "Mover", lastName: "X", email: t.email, phone: "0917",
    branch: "gil-puyat", selectedRoomType: "quadruple-sharing",
    agreedToTerms: true, agreedToHouseRules: true,
    agreedToPrivacy: true, agreedToCertification: true,
    totalPrice: RATE["quadruple-sharing"], selectedBed: { id: "a-b1" },
    moveInDate: new Date("2020-01-01T00:00:00.000Z"),
  });
  await Reservation.populate(res, { path: "roomId" });
  const stay = await Stay.create({
    reservationId: res._id, tenantId: t._id, roomId: roomA._id, bedId: "a-b1",
    branch: "gil-puyat",
    leaseStartDate: new Date("2020-01-01T00:00:00.000Z"),
    leaseEndDate: transfereeLeaseEnd,
    monthlyRent: RATE["quadruple-sharing"], status: "active",
  });
  const stayLike = {
    _id: stay._id, roomId: roomA._id, bedId: "a-b1", branch: "gil-puyat",
    leaseStartDate: stay.leaseStartDate, leaseEndDate: stay.leaseEndDate, status: "active",
  };
  return { res, roomB, stayLike };
}

/** Another tenant with an APPROVED reservation for roomB bed b1, starting on `start`. */
async function otherReservationForBedB1(roomB, { start, end = null }) {
  const o = await tenant("Other");
  return Reservation.create({
    userId: o._id, roomId: roomB._id, status: "approved_for_payment",
    firstName: "Other", lastName: "X", email: o.email, phone: "0918",
    branch: "gil-puyat", selectedRoomType: "double-sharing",
    agreedToTerms: true, agreedToHouseRules: true,
    agreedToPrivacy: true, agreedToCertification: true,
    totalPrice: RATE["double-sharing"], selectedBed: { id: "b-b1" },
    leaseStartDate: start, moveInDate: start, moveOutDate: end,
  });
}

const bedStatus = (cands, roomId, bedId) => {
  const room = cands.find((c) => c.roomId === String(roomId));
  return room?.beds?.find((b) => b.bedId === bedId) || null;
};

describe("buildTransferCandidates — reservation-conflict WINDOW", () => {
  test("A. reservation ending before the transfer date does NOT block", async () => {
    const { res, roomB, stayLike } = await seed({
      transfereeLeaseEnd: new Date("2026-12-31T00:00:00.000Z"),
    });
    await otherReservationForBedB1(roomB, {
      start: new Date("2025-10-01T00:00:00.000Z"),
      end: new Date("2026-02-28T00:00:00.000Z"),
    });

    const cands = await buildTransferCandidates({
      reservation: res,
      stayLike,
      effectiveTransferDate: new Date("2026-03-01T00:00:00.000Z"),
    });
    expect(bedStatus(cands, roomB._id, "b-b1").selectable).toBe(true);
  });

  test("B. bed free on the transfer day but reserved DURING the transferee's remaining stay -> unavailable", async () => {
    // Transferee's lease runs to 2026-12-31. Another reservation takes bed b1
    // from 2026-06-01 (well inside that interval).
    const { res, roomB, stayLike } = await seed({
      transfereeLeaseEnd: new Date("2026-12-31T00:00:00.000Z"),
    });
    await otherReservationForBedB1(roomB, {
      start: new Date("2026-06-01T00:00:00.000Z"),
      end: new Date("2027-01-31T00:00:00.000Z"),
    });

    const cands = await buildTransferCandidates({
      reservation: res,
      stayLike,
      effectiveTransferDate: new Date("2026-03-01T00:00:00.000Z"),
    });
    const b1 = bedStatus(cands, roomB._id, "b-b1");
    expect(b1).toBeTruthy();
    expect(b1.selectable).toBe(false);
    expect(b1.unavailableReason).toMatch(/reservation covers this bed/i);
    // b2 has no conflict — still selectable.
    const b2 = bedStatus(cands, roomB._id, "b-b2");
    expect(b2.selectable).toBe(true);
  });

  test("C. reservation begins AFTER the transferee's known lease end -> does NOT block", async () => {
    // Transferee's lease ends 2026-06-30. Another reservation starts 2026-09-01
    // — strictly after — so it must NOT flag bed b1.
    const { res, roomB, stayLike } = await seed({
      transfereeLeaseEnd: new Date("2026-06-30T00:00:00.000Z"),
    });
    await otherReservationForBedB1(roomB, {
      start: new Date("2026-09-01T00:00:00.000Z"),
      end: new Date("2027-02-28T00:00:00.000Z"),
    });

    const cands = await buildTransferCandidates({
      reservation: res,
      stayLike,
      effectiveTransferDate: new Date("2026-03-01T00:00:00.000Z"),
    });
    const b1 = bedStatus(cands, roomB._id, "b-b1");
    expect(b1.selectable).toBe(true);
    const roomBCand = cands.find((c) => c.roomId === String(roomB._id));
    expect(roomBCand.selectable).toBe(true);
    expect(roomBCand.availabilityStatus).toBe("available");
  });

  test("C. no overlapping reservation -> available", async () => {
    const { res, roomB, stayLike } = await seed({
      transfereeLeaseEnd: new Date("2026-12-31T00:00:00.000Z"),
    });
    const cands = await buildTransferCandidates({
      reservation: res,
      stayLike,
      effectiveTransferDate: new Date("2026-03-01T00:00:00.000Z"),
    });
    const roomBCand = cands.find((c) => c.roomId === String(roomB._id));
    expect(roomBCand.selectable).toBe(true);
    expect(roomBCand.availabilityStatus).toBe("available");
    expect(bedStatus(cands, roomB._id, "b-b1").selectable).toBe(true);
    expect(bedStatus(cands, roomB._id, "b-b2").selectable).toBe(true);
  });

  test("D. another reservation with unknown end is conservatively treated as overlapping", async () => {
    const { res, roomB, stayLike } = await seed({
      transfereeLeaseEnd: new Date("2026-12-31T00:00:00.000Z"),
    });
    await otherReservationForBedB1(roomB, {
      start: new Date("2026-06-01T00:00:00.000Z"),
    });
    // Simulate "no resolvable end" — the candidate builder falls back to
    // computeLeaseEndDate(reservation), which is also null for this fixture,
    // so the interval is [transferDate, +inf).
    const cands = await buildTransferCandidates({
      reservation: res,
      stayLike,
      effectiveTransferDate: new Date("2026-03-01T00:00:00.000Z"),
    });
    expect(bedStatus(cands, roomB._id, "b-b1").selectable).toBe(false);
  });
});
