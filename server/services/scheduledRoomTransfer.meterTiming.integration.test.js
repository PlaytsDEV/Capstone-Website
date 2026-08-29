/**
 * ============================================================================
 * SCHEDULED TRANSFER — METER READING TIMING FIX
 * ============================================================================
 * The boundary UtilityReading fallback (source "moveOut" / destination
 * "moveIn") in `transferStayWorkflow` must NEVER adopt a reading dated AFTER
 * the effective transfer date — for immediate OR scheduled transfers. A
 * scheduled transfer executes days/weeks after it was scheduled, so a reading
 * recorded (or back-dated) after the effective date can exist in the DB by the
 * time the executor runs.
 *
 * Proven here (effective date = E):
 *   - exact E-dated reading present  -> the E reading is used
 *   - no E reading, an E-5 reading + an E+20 reading present -> E-5 is used,
 *     E+20 is NEVER selected  (source AND destination)
 *   - only an E+20 reading present -> no fallback snapshot is created
 *     (existing "no prior reading" behavior, nothing fabricated)
 *   - the created boundary readings are dated on the effective date
 *   - scheduling does NOT persist scheduling-day meter readings
 *
 * PDF + contract validation mocked (same shims as the executor suite).
 */
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, test, jest } from "@jest/globals";
import { MongoMemoryReplSet } from "mongodb-memory-server";

const mockValidate = jest.fn(async () => ({
  valid: true, missingFields: [], errors: [],
  generationData: { pricing: {} },
  template: { templateId: "generic", templateVersion: 1, legalContentVersion: 1 },
}));
const mockGenerate = jest.fn(async ({ contractId, actorId }) => {
  const { Contract } = await import("../models/index.js");
  const { transitionContract } = await import("./contractService.js");
  const contract = await Contract.findById(contractId);
  contract.preparedDocuments = contract.preparedDocuments || [];
  contract.preparedDocuments.push({
    documentType: "prepared", version: 1, storageProvider: "local",
    storageKey: "t/p_v1.pdf", fileName: "p_v1.pdf", fileHash: `h-${contract._id}-v1`,
    fileSize: 2048, pageCount: 4, templateId: "generic", templateVersion: "1",
    coordinateVersion: "1", generatedAt: new Date(), generatedBy: actorId, superseded: false,
  });
  contract.generatedFileHash = `h-${contract._id}-v1`;
  contract.generatedVersion = 1;
  contract.publicationStatus = "ready_for_resident";
  contract.tenantVisible = true;
  if (contract.status === "ready_for_generation") {
    await transitionContract(contract, "generated", actorId, "prepared (test)");
  } else {
    await contract.save();
  }
  return { contract, document: contract.preparedDocuments.at(-1), previousStatus: "ready_for_generation", isRegeneration: false };
});
await jest.unstable_mockModule("../services/contractPdfService.js", () => ({ generatePreparedContractPdf: mockGenerate }));
const realContractService = await import("./contractService.js");
await jest.unstable_mockModule("./contractService.js", () => ({
  ...realContractService,
  validateContractForGeneration: mockValidate,
}));

const { scheduleRoomTransfer } = await import("./scheduledRoomTransferService.js");
const { executeScheduledRoomTransfer } = await import("./scheduledRoomTransferExecutor.js");
const { applyBillPayment } = await import("./billing/paymentLedger.js");
const { generateContractNumber } = await import("./contractService.js");
const { getManilaToday } = await import("../utils/dateUtils.js");
const {
  Contract, Reservation, Room, User, Stay, BedHistory, Bill, BusinessSettings,
  TenantCredit, UtilityReading, UtilityPeriod, ScheduledRoomTransfer, Payment,
} = await import("../models/index.js");

jest.setTimeout(300_000);

const RATE = { private: 13500, "double-sharing": 8100, "quadruple-sharing": 5400 };
const CAP = { private: 1, "double-sharing": 2, "quadruple-sharing": 4 };
const NEEDS_BED = new Set(["double-sharing", "quadruple-sharing"]);

// Effective date 2 days out; execution clock 1 day past it.
const E = () => getManilaToday().add(2, "day");
const EFFECTIVE_STR = () => E().format("YYYY-MM-DD");
const DUE_NOW = () => E().add(1, "day").toDate();
// A date relative to the effective date, as a Manila start-of-day Date.
const rel = (days) => E().add(days, "day").startOf("day").toDate();

const bedsFor = (type, prefix) =>
  NEEDS_BED.has(type)
    ? Array.from({ length: CAP[type] }, (_, i) => ({ id: `${prefix}-b${i + 1}`, position: i % 2 ? "upper" : "lower", status: "available" }))
    : [];

async function seed({ sourceType = "quadruple-sharing", roomNumber = "301", moveInDaysAgo = 40 } = {}) {
  const moveIn = getManilaToday().subtract(moveInDaysAgo, "day").toDate();
  const leaseEnd = getManilaToday().add(320, "day").toDate();
  const tenant = await User.create({
    firebaseUid: `fb-${new mongoose.Types.ObjectId()}`, email: `t-${new mongoose.Types.ObjectId()}@ex.test`,
    username: `t_${new mongoose.Types.ObjectId().toString().slice(-10)}`,
    firstName: "Meter", lastName: "Timing", role: "tenant", tenantStatus: "active",
  });
  const srcBeds = bedsFor(sourceType, `r${roomNumber}`);
  if (srcBeds.length) srcBeds[0] = { ...srcBeds[0], status: "occupied", occupiedBy: { userId: tenant._id } };
  const roomA = await Room.create({
    name: `Room ${roomNumber}`, roomNumber, branch: "gil-puyat",
    type: sourceType, capacity: CAP[sourceType], currentOccupancy: 1, price: RATE[sourceType], beds: srcBeds,
  });
  const srcBedId = NEEDS_BED.has(sourceType) ? `r${roomNumber}-b1` : "";
  const reservation = await Reservation.create({
    userId: tenant._id, roomId: roomA._id, status: "moveIn", leaseDuration: 12,
    reservationFeeAmount: 2000, preferredRoomType: sourceType,
    agreedToPrivacy: true, agreedToCertification: true,
    totalPrice: RATE[sourceType], monthlyRent: RATE[sourceType],
    selectedBed: { id: srcBedId }, moveInDate: moveIn, securityDepositHeld: RATE[sourceType],
  });
  if (srcBeds.length) { roomA.beds[0].occupiedBy.reservationId = reservation._id; await roomA.save(); }
  const stay = await Stay.create({
    tenantId: tenant._id, reservationId: reservation._id, branch: "gil-puyat",
    roomId: roomA._id, bedId: srcBedId || `room-${roomA._id}`,
    leaseStartDate: moveIn, leaseEndDate: leaseEnd, monthlyRent: RATE[sourceType], status: "active",
  });
  if (NEEDS_BED.has(sourceType)) {
    await BedHistory.create({
      bedId: srcBedId, roomId: roomA._id, tenantId: tenant._id, reservationId: reservation._id,
      stayId: stay._id, branch: "gil-puyat", moveInDate: moveIn, status: "active",
    });
  }
  const actorId = new mongoose.Types.ObjectId();
  const num = await generateContractNumber("gil-puyat", new Date());
  const original = await Contract.create({
    ...num, contractPurpose: "initial", tenantId: tenant._id, applicationId: reservation._id,
    reservationId: reservation._id, stayId: stay._id, roomId: roomA._id, branch: "gil-puyat",
    propertyName: "Lilycrest Dormitory", propertyAddress: "123 Test St.", roomNumber: roomA.roomNumber,
    roomType: sourceType, leaseType: "long_term", approvedMonthlyRate: RATE[sourceType],
    securityDepositAmount: RATE[sourceType],
    leaseStartDate: moveIn, leaseEndDate: leaseEnd, leaseDurationMonths: 12,
    status: "active", isCurrent: true,
    finalDocument: {
      version: 1, storageKey: "orig/final_v1.pdf", fileName: "final_v1.pdf",
      fileHash: "originalfinalhash", fileSize: 4096, mimeType: "application/pdf", pageCount: 8,
      sourceType: "notarized", sourceVersion: 1, sourceUploadedAt: new Date(),
      publishedAt: new Date(), publishedBy: actorId, tenantVisible: true,
    },
    statusHistory: [{ status: "active", changedBy: actorId, reason: "seed notarized lease" }],
    createdBy: actorId, updatedBy: actorId,
  });
  return { tenant, roomA, reservation, stay, original, actorId };
}
const emptyRoom = (type, roomNumber) =>
  Room.create({
    name: `Room ${roomNumber}`, roomNumber, branch: "gil-puyat",
    type, capacity: CAP[type], currentOccupancy: 0, price: RATE[type], beds: bedsFor(type, `r${roomNumber}`),
  });
function payloadFor({ targetRoom, transferDate, extra = {} }) {
  const destBedId = NEEDS_BED.has(targetRoom.type) ? `r${targetRoom.roomNumber}-b1` : undefined;
  return {
    confirm: true, targetRoomId: String(targetRoom._id),
    ...(destBedId ? { targetBedId: destBedId } : {}),
    effectiveTransferDate: transferDate, forceOverride: true,
    ...extra,
  };
}
async function payFull(billId) {
  if (!billId) return;
  const bill = await Bill.findById(billId);
  if (!bill || bill.remainingAmount <= 0) return;
  return applyBillPayment({ bill, amount: bill.remainingAmount, method: "offline_cash", source: "admin-manual", now: new Date() });
}
const seedReading = (roomId, reading, date, eventType = "regularBilling") =>
  UtilityReading.create({
    utilityType: "electricity", roomId, branch: "gil-puyat", reading, date,
    eventType, tenantId: null, recordedBy: new mongoose.Types.ObjectId(), readingStatus: "recorded",
  });

let mongo;
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri(), { dbName: "sched_transfer_meter_timing" });
  await ScheduledRoomTransfer.syncIndexes();
}, 120_000);
afterAll(async () => {
  await mongoose.disconnect();
  await mongo?.stop();
}, 120_000);
beforeEach(async () => {
  await Promise.all([
    Reservation.deleteMany({}), Room.deleteMany({}), User.deleteMany({}),
    Contract.deleteMany({}), Stay.deleteMany({}), BedHistory.deleteMany({}),
    Bill.deleteMany({}), BusinessSettings.deleteMany({}), TenantCredit.deleteMany({}),
    UtilityReading.deleteMany({}), UtilityPeriod.deleteMany({}),
    ScheduledRoomTransfer.deleteMany({}), Payment.deleteMany({}),
  ]);
  await BusinessSettings.create({
    key: "global",
    privateDiscountPercent: 10, doubleDiscountPercent: 10, quadrupleDiscountPercent: 10,
    isDiscountEnabled: true, longTermLeaseMinMonths: 6,
  });
  mockValidate.mockClear();
  mockGenerate.mockClear();
});

const sourceMoveOut = (roomId) =>
  UtilityReading.findOne({ roomId, utilityType: "electricity", eventType: "moveOut" }).lean();
const destMoveIn = (roomId) =>
  UtilityReading.findOne({ roomId, utilityType: "electricity", eventType: "moveIn" }).lean();

describe("date-bound source-room fallback reading", () => {
  test("exact effective-date reading is used as the moveOut fallback", async () => {
    const { roomA, reservation, actorId } = await seed();
    const dest = await emptyRoom("private", "205");
    await seedReading(roomA._id, 90, rel(-6));
    await seedReading(roomA._id, 97, rel(0)); // exactly the effective date
    const { scheduledTransfer } = await scheduleRoomTransfer({
      reservationId: reservation._id, payload: payloadFor({ targetRoom: dest, transferDate: EFFECTIVE_STR() }), actorId,
    });
    await payFull(scheduledTransfer.settlementBillId);
    const res = await executeScheduledRoomTransfer(scheduledTransfer._id, { now: DUE_NOW() });
    expect(res.outcome).toBe("executed");

    const mo = await sourceMoveOut(roomA._id);
    expect(mo).toBeTruthy();
    expect(mo.reading).toBe(97);
    // Dated on the effective transfer date.
    expect(getManilaToday(scheduledTransfer.effectiveTransferDate).isSame(getManilaToday(mo.date), "day")).toBe(true);
  });

  test("no effective-date reading: the latest reading ON OR BEFORE the effective date is used; a later reading is NEVER selected", async () => {
    const { roomA, reservation, actorId } = await seed();
    const dest = await emptyRoom("private", "205");
    await seedReading(roomA._id, 90, rel(-6));   // Aug 31 analogue
    await seedReading(roomA._id, 100, rel(20));  // Sep 29 analogue — must be ignored
    const { scheduledTransfer } = await scheduleRoomTransfer({
      reservationId: reservation._id, payload: payloadFor({ targetRoom: dest, transferDate: EFFECTIVE_STR() }), actorId,
    });
    await payFull(scheduledTransfer.settlementBillId);
    const res = await executeScheduledRoomTransfer(scheduledTransfer._id, { now: DUE_NOW() });
    expect(res.outcome).toBe("executed");

    const mo = await sourceMoveOut(roomA._id);
    expect(mo).toBeTruthy();
    expect(mo.reading).toBe(90);       // Aug 31, not Sep 29
    expect(mo.reading).not.toBe(100);
  });

  test("only a post-effective-date reading exists: no fallback snapshot is fabricated", async () => {
    const { roomA, reservation, actorId } = await seed();
    const dest = await emptyRoom("private", "205");
    await seedReading(roomA._id, 100, rel(20)); // the ONLY reading, dated after E
    const { scheduledTransfer } = await scheduleRoomTransfer({
      reservationId: reservation._id, payload: payloadFor({ targetRoom: dest, transferDate: EFFECTIVE_STR() }), actorId,
    });
    await payFull(scheduledTransfer.settlementBillId);
    const res = await executeScheduledRoomTransfer(scheduledTransfer._id, { now: DUE_NOW() });
    expect(res.outcome).toBe("executed");

    // No moveOut snapshot created — nothing safe to anchor, nothing fabricated.
    const mo = await sourceMoveOut(roomA._id);
    expect(mo).toBeNull();
    // And the post-cutoff reading is untouched.
    expect(await UtilityReading.countDocuments({ roomId: roomA._id, reading: 100 })).toBe(1);
  });
});

describe("date-bound destination-room fallback reading", () => {
  test("a destination reading dated after the effective date is NEVER used as the moveIn fallback", async () => {
    const { reservation, actorId } = await seed();
    const dest = await emptyRoom("private", "205");
    await seedReading(dest._id, 40, rel(-6));   // valid pre-effective-date opening
    await seedReading(dest._id, 55, rel(20));   // post-cutoff — must be ignored
    const { scheduledTransfer } = await scheduleRoomTransfer({
      reservationId: reservation._id, payload: payloadFor({ targetRoom: dest, transferDate: EFFECTIVE_STR() }), actorId,
    });
    await payFull(scheduledTransfer.settlementBillId);
    const res = await executeScheduledRoomTransfer(scheduledTransfer._id, { now: DUE_NOW() });
    expect(res.outcome).toBe("executed");

    const mi = await destMoveIn(dest._id);
    expect(mi).toBeTruthy();
    expect(mi.reading).toBe(40);
    expect(mi.reading).not.toBe(55);
    expect(getManilaToday(scheduledTransfer.effectiveTransferDate).isSame(getManilaToday(mi.date), "day")).toBe(true);
  });
});

describe("scheduling does not capture scheduling-day readings", () => {
  test("meter readings sent at scheduling time are NOT persisted on the ScheduledRoomTransfer", async () => {
    const { reservation, actorId } = await seed();
    const dest = await emptyRoom("private", "205");
    const { scheduledTransfer } = await scheduleRoomTransfer({
      reservationId: reservation._id,
      payload: payloadFor({
        targetRoom: dest, transferDate: EFFECTIVE_STR(),
        extra: { sourceRoomMeterReading: 1234, targetRoomMeterReading: 567 },
      }),
      actorId,
    });
    const fresh = await ScheduledRoomTransfer.findById(scheduledTransfer._id).lean();
    expect(fresh.sourceRoomMeterReading).toBeNull();
    expect(fresh.targetRoomMeterReading).toBeNull();
  });
});
