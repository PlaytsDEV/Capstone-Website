/**
 * ============================================================================
 * Phase 2D — Scheduled Room Transfer Balance Bill + payment readiness
 * ============================================================================
 * Proves:
 *   - higher-rent / higher-deposit future transfer -> ONE transfer_settlement
 *     Bill with charges.rent + charges.securityDeposit, electricity/water = 0,
 *     dueDate = effective transfer date (Manila), status "pending"
 *   - ScheduledRoomTransfer.settlementBillId links it
 *   - zero-balance schedule (same/cheaper rate + held deposit already covers)
 *     -> NO Bill, settlementBillId null, user status "ready"
 *   - cheaper destination -> NO TenantCredit created at scheduling; excess
 *     held deposit not refunded/credited (informational in the serializer)
 *   - serializer: unpaid -> awaiting_payment, partial -> awaiting_payment +
 *     paymentState "partial", fully paid -> ready
 *   - recording a payment on the Bill does NOT change room / Stay / rent
 *   - the same canonical Bill serialises through the mobile billing bridge
 *     (toMobileBill) with rent + security_deposit + total + remaining
 *   - all cross-room-type combinations schedule without type-specific logic
 *
 * PDF + contract validation mocked (same pattern as the other transfer
 * integration suites).
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
const {
  serializeScheduledRoomTransfer,
  resolveScheduledTransferBalance,
} = await import("./scheduledRoomTransferView.js");
const { toMobileBill } = await import("./mobileBillingBridge.js");
const { generateContractNumber } = await import("./contractService.js");
const { getManilaToday, toManilaStartOfDay } = await import("../utils/dateUtils.js");
const {
  Contract, Reservation, Room, User, Stay, BedHistory, Bill, BusinessSettings,
  TenantCredit, ScheduledRoomTransfer,
} = await import("../models/index.js");

jest.setTimeout(240_000);

const RATE = { private: 13500, "double-sharing": 8100, "quadruple-sharing": 5400 };
const CAP = { private: 1, "double-sharing": 2, "quadruple-sharing": 4 };
const NEEDS_BED = new Set(["double-sharing", "quadruple-sharing"]);
const MOVE_IN = new Date("2026-01-01T00:00:00.000Z");
const LEASE_END = new Date("2026-12-31T00:00:00.000Z");

function futureDateStr(daysAhead = 10) {
  return getManilaToday().add(daysAhead, "day").format("YYYY-MM-DD");
}
function bedsFor(type, prefix) {
  if (!NEEDS_BED.has(type)) return [];
  return Array.from({ length: CAP[type] }, (_, i) => ({
    id: `${prefix}-b${i + 1}`, position: i % 2 ? "upper" : "lower", status: "available",
  }));
}

async function seed({
  sourceType = "quadruple-sharing",
  roomNumber = "301",
  heldDeposit = null,
  moveIn = MOVE_IN,
  leaseEnd = LEASE_END,
} = {}) {
  const tenant = await User.create({
    firebaseUid: `fb-${new mongoose.Types.ObjectId()}`, email: `t-${new mongoose.Types.ObjectId()}@ex.test`,
    username: `t_${new mongoose.Types.ObjectId().toString().slice(-10)}`,
    firstName: "Bal", lastName: "Tenant", role: "tenant", tenantStatus: "active",
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
    selectedBed: { id: srcBedId }, moveInDate: moveIn,
    securityDepositHeld: heldDeposit == null ? RATE[sourceType] : heldDeposit,
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

async function emptyRoom(type, roomNumber) {
  return Room.create({
    name: `Room ${roomNumber}`, roomNumber, branch: "gil-puyat",
    type, capacity: CAP[type], currentOccupancy: 0, price: RATE[type], beds: bedsFor(type, `r${roomNumber}`),
  });
}
function payloadFor({ targetRoom, transferDate }) {
  const destBedId = NEEDS_BED.has(targetRoom.type) ? `r${targetRoom.roomNumber}-b1` : undefined;
  return {
    confirm: true, targetRoomId: String(targetRoom._id),
    ...(destBedId ? { targetBedId: destBedId } : {}),
    effectiveTransferDate: transferDate, forceOverride: true,
  };
}

let mongo;
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri(), { dbName: "sched_transfer_2d" });
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
    ScheduledRoomTransfer.deleteMany({}),
  ]);
  await BusinessSettings.create({
    key: "global",
    privateDiscountPercent: 10, doubleDiscountPercent: 10, quadrupleDiscountPercent: 10,
    isDiscountEnabled: true, longTermLeaseMinMonths: 6,
  });
  mockValidate.mockClear();
  mockGenerate.mockClear();
});

describe("balance Bill — higher rent + higher deposit (Quad -> Private)", () => {
  test("one transfer_settlement Bill, rent + securityDeposit only, due = effective date, linked", async () => {
    const { reservation, roomA, stay, actorId } = await seed({ sourceType: "quadruple-sharing", roomNumber: "301" });
    const dest = await emptyRoom("private", "205");
    const transferDate = futureDateStr(10);

    const { scheduledTransfer, previewSnapshot } = await scheduleRoomTransfer({
      reservationId: reservation._id,
      payload: payloadFor({ targetRoom: dest, transferDate }),
      actorId,
    });

    const bills = await Bill.find({ reservationId: reservation._id, billType: "transfer_settlement" });
    expect(bills).toHaveLength(1);
    const bill = bills[0];
    expect(bill.charges.rent).toBeGreaterThan(0);
    expect(bill.charges.securityDeposit).toBeGreaterThan(0);
    expect(bill.charges.electricity).toBe(0);
    expect(bill.charges.water).toBe(0);
    expect(bill.totalAmount).toBe(
      Math.round((bill.charges.rent + bill.charges.securityDeposit) * 100) / 100,
    );
    expect(bill.status).toBe("pending");
    expect(bill.paidAmount).toBe(0);

    // Due date = the effective transfer date (Manila start-of-day), NOT shifted.
    const expectedDue = toManilaStartOfDay(transferDate).toDate();
    expect(new Date(bill.dueDate).getTime()).toBe(expectedDue.getTime());

    expect(String(scheduledTransfer.settlementBillId)).toBe(String(bill._id));

    // Components mirror the canonical preview.
    expect(bill.charges.rent).toBe(Math.max(0, previewSnapshot.rent.adjustmentDue));
    expect(bill.charges.securityDeposit).toBe(Math.max(0, previewSnapshot.deposit.balanceDue));

    // No operational mutation, no TenantCredit, no cutoff.
    const [resAfter, stayAfter, roomAAfter] = await Promise.all([
      Reservation.findById(reservation._id),
      Stay.findById(stay._id),
      Room.findById(roomA._id),
    ]);
    expect(String(resAfter.roomId)).toBe(String(roomA._id));
    expect(Number(resAfter.monthlyRent)).toBe(RATE["quadruple-sharing"]);
    expect(stayAfter.status).toBe("active");
    expect(await TenantCredit.countDocuments({})).toBe(0);
  });

  test("serializer: unpaid -> awaiting_payment; partial -> awaiting_payment + partial; paid -> ready", async () => {
    const { reservation, actorId } = await seed({ sourceType: "quadruple-sharing", roomNumber: "301" });
    const dest = await emptyRoom("private", "205");
    const { scheduledTransfer } = await scheduleRoomTransfer({
      reservationId: reservation._id,
      payload: payloadFor({ targetRoom: dest, transferDate: futureDateStr(10) }),
      actorId,
    });
    const billId = scheduledTransfer.settlementBillId;

    let view = await serializeScheduledRoomTransfer(await ScheduledRoomTransfer.findById(scheduledTransfer._id));
    expect(view.status).toBe("awaiting_payment");
    expect(view.transferBalance.paymentState).toBe("unpaid");
    expect(view.transferBalance.amountDue).toBeGreaterThan(0);
    expect(view.transferBalance.remaining).toBe(view.transferBalance.amountDue);

    // Partial payment.
    const bill = await Bill.findById(billId);
    await Bill.updateOne({ _id: billId }, {
      $set: { paidAmount: 1000, remainingAmount: bill.totalAmount - 1000, status: "partially-paid" },
    });
    view = await serializeScheduledRoomTransfer(await ScheduledRoomTransfer.findById(scheduledTransfer._id));
    expect(view.status).toBe("awaiting_payment");
    expect(view.transferBalance.paymentState).toBe("partial");
    expect(view.transferBalance.amountPaid).toBe(1000);

    // Full payment.
    await Bill.updateOne({ _id: billId }, {
      $set: { paidAmount: bill.totalAmount, remainingAmount: 0, status: "paid" },
    });
    view = await serializeScheduledRoomTransfer(await ScheduledRoomTransfer.findById(scheduledTransfer._id));
    expect(view.status).toBe("ready");
    expect(view.transferBalance.paymentState).toBe("paid");
    expect(view.transferBalance.remaining).toBe(0);
  });

  test("recording a payment does not change current room / Stay / rent", async () => {
    const { reservation, roomA, stay, actorId } = await seed({ sourceType: "quadruple-sharing", roomNumber: "301" });
    const dest = await emptyRoom("private", "205");
    const { scheduledTransfer } = await scheduleRoomTransfer({
      reservationId: reservation._id,
      payload: payloadFor({ targetRoom: dest, transferDate: futureDateStr(10) }),
      actorId,
    });
    const bill = await Bill.findById(scheduledTransfer.settlementBillId);
    await Bill.updateOne({ _id: bill._id }, { $set: { paidAmount: bill.totalAmount, remainingAmount: 0, status: "paid" } });

    const [resAfter, stayAfter] = await Promise.all([
      Reservation.findById(reservation._id),
      Stay.findById(stay._id),
    ]);
    expect(String(resAfter.roomId)).toBe(String(roomA._id));
    expect(resAfter.recurringRentRate == null || resAfter.recurringRentRate === 0).toBe(true);
    expect(Number(resAfter.monthlyRent)).toBe(RATE["quadruple-sharing"]);
    expect(String(stayAfter.roomId)).toBe(String(roomA._id));
    expect(stayAfter.status).toBe("active");
  });

  test("mobile billing bridge exposes the same canonical Bill", async () => {
    const { reservation, actorId } = await seed({ sourceType: "quadruple-sharing", roomNumber: "301" });
    const dest = await emptyRoom("private", "205");
    const { scheduledTransfer } = await scheduleRoomTransfer({
      reservationId: reservation._id,
      payload: payloadFor({ targetRoom: dest, transferDate: futureDateStr(10) }),
      actorId,
    });
    const bill = await Bill.findById(scheduledTransfer.settlementBillId).lean();
    const mobile = toMobileBill(bill);
    expect(mobile.billing_id).toBe(String(bill._id));
    expect(mobile.rent).toBe(bill.charges.rent);
    expect(mobile.security_deposit).toBe(bill.charges.securityDeposit);
    expect(mobile.electricity).toBe(0);
    expect(mobile.water).toBe(0);
    expect(mobile.total).toBe(bill.totalAmount);
    expect(mobile.remaining_amount).toBe(bill.totalAmount);
    expect(mobile.paid_amount).toBe(0);
    expect(new Date(mobile.due_date).getTime()).toBe(new Date(bill.dueDate).getTime());
  });
});

describe("zero-balance schedule (no payable Bill)", () => {
  // A move-in only ~5 days ago keeps the (future) transfer inside rent cycle 0,
  // which the resolver treats as funded by the contract-basis rate — so a
  // same-rate transfer nets ~0 rent adjustment. Lease end well in the future.
  const recentMoveIn = getManilaToday().subtract(5, "day").toDate();
  const farLeaseEnd = getManilaToday().add(300, "day").toDate();

  test("same-type same-rate transfer with deposit already covering -> no Bill, status ready", async () => {
    // Quad -> Quad, held deposit already = Quad rate (destination required).
    const { reservation, actorId } = await seed({
      sourceType: "quadruple-sharing", roomNumber: "301",
      moveIn: recentMoveIn, leaseEnd: farLeaseEnd,
    });
    const dest = await emptyRoom("quadruple-sharing", "302");
    const { scheduledTransfer, balanceTotal } = await scheduleRoomTransfer({
      reservationId: reservation._id,
      payload: payloadFor({ targetRoom: dest, transferDate: futureDateStr(10) }),
      actorId,
    });
    // Same-rate, mid-cycle: rent adjustment is 0 (consumed vs prorated net ~0),
    // deposit required == held == Quad rate -> nothing owed.
    expect(scheduledTransfer.settlementBillId == null).toBe(true);
    expect(await Bill.countDocuments({ reservationId: reservation._id, billType: "transfer_settlement" })).toBe(0);

    const view = await serializeScheduledRoomTransfer(await ScheduledRoomTransfer.findById(scheduledTransfer._id));
    expect(view.status).toBe("ready");
    expect(view.transferBalance.hasBill).toBe(false);
    expect(view.transferBalance.paymentState).toBe("none");
    expect(balanceTotal).toBe(0);
  });
});

describe("cheaper destination (Private -> Quad)", () => {
  const recentMoveIn = getManilaToday().subtract(5, "day").toDate();
  const farLeaseEnd = getManilaToday().add(300, "day").toDate();

  test("no TenantCredit created at scheduling; excess held deposit informational only", async () => {
    const { reservation, actorId } = await seed({
      sourceType: "private", roomNumber: "101",
      moveIn: recentMoveIn, leaseEnd: farLeaseEnd,
    });
    const dest = await emptyRoom("quadruple-sharing", "301");
    const { scheduledTransfer, previewSnapshot } = await scheduleRoomTransfer({
      reservationId: reservation._id,
      payload: payloadFor({ targetRoom: dest, transferDate: futureDateStr(10) }),
      actorId,
    });

    // Cheaper room: rent adjustment <= 0, additional deposit 0 -> no Bill.
    expect(scheduledTransfer.settlementBillId == null).toBe(true);
    expect(await TenantCredit.countDocuments({})).toBe(0);

    const view = await serializeScheduledRoomTransfer(await ScheduledRoomTransfer.findById(scheduledTransfer._id));
    expect(view.status).toBe("ready");
    // Informational-only fields surface the estimates without touching accounting.
    if (previewSnapshot.rent.excessCredit > 0) {
      expect(view.estimatedRentCreditAfterTransfer).toBe(previewSnapshot.rent.excessCredit);
    }
    if (previewSnapshot.deposit.excessHeld > 0) {
      expect(view.estimatedExcessDepositHeld).toBe(previewSnapshot.deposit.excessHeld);
    }
    // Nothing refunded / credited.
    const resAfter = await Reservation.findById(reservation._id);
    expect(Number(resAfter.securityDepositHeld)).toBe(RATE.private); // unchanged
  });
});

describe("all cross-room-type combinations schedule (no type-specific logic)", () => {
  const COMBOS = [
    ["private", "double-sharing"],
    ["private", "quadruple-sharing"],
    ["double-sharing", "private"],
    ["double-sharing", "quadruple-sharing"],
    ["quadruple-sharing", "private"],
    ["quadruple-sharing", "double-sharing"],
    ["private", "private"],
    ["double-sharing", "double-sharing"],
    ["quadruple-sharing", "quadruple-sharing"],
  ];
  test.each(COMBOS)("%s -> %s schedules and links a Bill iff something is owed", async (src, dst) => {
    const { reservation, actorId } = await seed({ sourceType: src, roomNumber: "701" });
    const dest = await emptyRoom(dst, "801");
    const { scheduledTransfer, balanceTotal } = await scheduleRoomTransfer({
      reservationId: reservation._id,
      payload: payloadFor({ targetRoom: dest, transferDate: futureDateStr(10) }),
      actorId,
    });
    expect(scheduledTransfer.status).toBe("scheduled");
    if (balanceTotal > 0) {
      expect(scheduledTransfer.settlementBillId).toBeTruthy();
      const bill = await Bill.findById(scheduledTransfer.settlementBillId);
      expect(bill.charges.electricity).toBe(0);
      expect(bill.charges.water).toBe(0);
    } else {
      expect(scheduledTransfer.settlementBillId == null).toBe(true);
    }
  });
});
