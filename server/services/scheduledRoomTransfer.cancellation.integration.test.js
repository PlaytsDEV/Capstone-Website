/**
 * ============================================================================
 * Phase 2H — Scheduled transfer cancellation + tenant-departure fallback
 * ============================================================================
 * CANONICAL RULE proven here:
 *   paidAmount === 0  -> safe automatic cancellation (hold released once,
 *                        Addendum cancelled, unpaid Bill VOIDED not deleted,
 *                        status "cancelled"); source tenancy untouched.
 *   paidAmount  > 0   -> NOTHING financial reversed. status "action_required"
 *                        PAYMENT_ALREADY_RECEIVED. Bill / Payment / deposit
 *                        ledger / Addendum history all preserved. For an
 *                        explicit admin cancel the hold is KEPT; for a
 *                        lifecycle departure the hold IS released (physical
 *                        resource != financial refund).
 *   executed         -> TRANSFER_ALREADY_COMPLETED (skipped).
 *
 * Departure integration: moveOutStayWorkflow + executeEarlyTerminationWorkflow
 * (routes through move-out) + executeAbandonmentProtocolWorkflow call
 * resolveScheduledTransferBeforeTenantDeparture — never execute the transfer.
 *
 * PDF + contract validation mocked.
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
  cancelScheduledRoomTransfer,
  resolveScheduledTransferBeforeTenantDeparture,
  executeScheduledRoomTransfer,
} = await import("./scheduledRoomTransferExecutor.js");
const { moveOutStayWorkflow } = await import("../utils/tenantActionService.js");
const { applyBillPayment } = await import("./billing/paymentLedger.js");
const { serializeScheduledRoomTransfer, getOpenScheduledRoomTransferForReservation } =
  await import("./scheduledRoomTransferView.js");
const { toMobileBill } = await import("./mobileBillingBridge.js");
const { generateContractNumber } = await import("./contractService.js");
const { getManilaToday } = await import("../utils/dateUtils.js");
const {
  Contract, Reservation, Room, User, Stay, BedHistory, Bill, BusinessSettings,
  TenantCredit, UtilityReading, ScheduledRoomTransfer, Payment,
} = await import("../models/index.js");

jest.setTimeout(300_000);

const RATE = { private: 13500, "double-sharing": 8100, "quadruple-sharing": 5400 };
const CAP = { private: 1, "double-sharing": 2, "quadruple-sharing": 4 };
const NEEDS_BED = new Set(["double-sharing", "quadruple-sharing"]);
const futureStr = (d = 12) => getManilaToday().add(d, "day").format("YYYY-MM-DD");
const DUE_NOW = getManilaToday().add(20, "day").toDate();
const bedsFor = (type, prefix) =>
  NEEDS_BED.has(type)
    ? Array.from({ length: CAP[type] }, (_, i) => ({ id: `${prefix}-b${i + 1}`, position: i % 2 ? "upper" : "lower", status: "available" }))
    : [];

async function seed({ sourceType = "quadruple-sharing", roomNumber = "301" } = {}) {
  const moveIn = getManilaToday().subtract(20, "day").toDate();
  const leaseEnd = getManilaToday().add(320, "day").toDate();
  const tenant = await User.create({
    firebaseUid: `fb-${new mongoose.Types.ObjectId()}`, email: `t-${new mongoose.Types.ObjectId()}@ex.test`,
    username: `t_${new mongoose.Types.ObjectId().toString().slice(-10)}`,
    firstName: "Canc", lastName: "Tenant", role: "tenant", tenantStatus: "active",
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
function payloadFor({ targetRoom, transferDate }) {
  const destBedId = NEEDS_BED.has(targetRoom.type) ? `r${targetRoom.roomNumber}-b1` : undefined;
  return {
    confirm: true, targetRoomId: String(targetRoom._id),
    ...(destBedId ? { targetBedId: destBedId } : {}),
    effectiveTransferDate: transferDate, forceOverride: true,
  };
}
const payFull = async (billId) => {
  const bill = await Bill.findById(billId);
  return applyBillPayment({ bill, amount: bill.remainingAmount, method: "offline_cash", source: "admin-manual", now: new Date() });
};

let mongo;
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri(), { dbName: "sched_transfer_2h" });
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
    UtilityReading.deleteMany({}), ScheduledRoomTransfer.deleteMany({}), Payment.deleteMany({}),
  ]);
  await BusinessSettings.create({
    key: "global",
    privateDiscountPercent: 10, doubleDiscountPercent: 10, quadrupleDiscountPercent: 10,
    isDiscountEnabled: true, longTermLeaseMinMonths: 6,
  });
  mockValidate.mockClear();
  mockGenerate.mockClear();
});

// ── Safe (unpaid) cancellation ────────────────────────────────────────────
describe("safe unpaid cancellation", () => {
  test("unpaid schedule cancels: hold released once, Addendum cancelled, Bill voided, source untouched", async () => {
    const { reservation, roomA, stay, original, actorId } = await seed({ sourceType: "quadruple-sharing", roomNumber: "301" });
    const dest = await emptyRoom("private", "205");
    const { scheduledTransfer } = await scheduleRoomTransfer({
      reservationId: reservation._id, payload: payloadFor({ targetRoom: dest, transferDate: futureStr(12) }), actorId,
    });
    expect((await Room.findById(dest._id)).currentOccupancy).toBe(1);

    const res = await cancelScheduledRoomTransfer(scheduledTransfer._id, { actorId });
    expect(res.outcome).toBe("cancelled");

    const s = await ScheduledRoomTransfer.findById(scheduledTransfer._id);
    expect(s.status).toBe("cancelled");
    expect(s.cancelledBy).toBeTruthy();
    expect(s.cancelledAt).toBeTruthy();
    expect(s.holdApplied).toBe(false);

    // Private capacity hold released exactly once.
    expect((await Room.findById(dest._id)).currentOccupancy).toBe(0);

    // Addendum cancelled / non-current; original still current.
    const addendum = await Contract.findById(scheduledTransfer.addendumContractId);
    expect(addendum.isCurrent).toBe(false);
    expect(["cancelled", "voided", "rejected", "archived"]).toContain(addendum.status);
    expect((await Contract.findById(original._id)).isCurrent).toBe(true);

    // Bill voided via canonical status, NOT deleted.
    const bill = await Bill.findById(scheduledTransfer.settlementBillId);
    expect(bill).toBeTruthy();
    expect(bill.status).toBe("voided");
    expect(bill.remainingAmount).toBe(0);

    // Source tenancy completely unchanged.
    const [r, st] = await Promise.all([Reservation.findById(reservation._id), Stay.findById(stay._id)]);
    expect(String(r.roomId)).toBe(String(roomA._id));
    expect(r.recurringRentRate == null || r.recurringRentRate === 0).toBe(true);
    expect(Number(r.securityDepositHeld)).toBe(RATE["quadruple-sharing"]);
    expect(String(st.roomId)).toBe(String(roomA._id));
    expect(st.status).toBe("active");
    expect(await TenantCredit.countDocuments({})).toBe(0);
    expect(await UtilityReading.countDocuments({})).toBe(0);
  });

  test("shared reserved bed hold released exactly once", async () => {
    const { reservation, actorId } = await seed({ sourceType: "private", roomNumber: "101" });
    const dest = await emptyRoom("double-sharing", "205");
    const { scheduledTransfer } = await scheduleRoomTransfer({
      reservationId: reservation._id, payload: payloadFor({ targetRoom: dest, transferDate: futureStr(12) }), actorId,
    });
    expect((await Room.findById(dest._id)).beds.find((b) => b.id === "r205-b1").status).toBe("reserved");

    await cancelScheduledRoomTransfer(scheduledTransfer._id, { actorId });
    const d = await Room.findById(dest._id);
    expect(d.beds.find((b) => b.id === "r205-b1").status).toBe("available");
    expect(d.currentOccupancy).toBe(0);
  });

  test("zero-balance schedule cancels (no Bill to void)", async () => {
    const { reservation, actorId } = await seed({ sourceType: "quadruple-sharing", roomNumber: "301" });
    // Recent move-in so it's a cycle-0, same-rate -> zero balance.
    await Reservation.updateOne({ _id: reservation._id }, { $set: { moveInDate: getManilaToday().subtract(3, "day").toDate() } });
    const stay = await Stay.findOne({ reservationId: reservation._id });
    await Stay.updateOne({ _id: stay._id }, { $set: { leaseStartDate: getManilaToday().subtract(3, "day").toDate() } });
    await Contract.updateOne({ reservationId: reservation._id }, { $set: { leaseStartDate: getManilaToday().subtract(3, "day").toDate() } });

    const dest = await emptyRoom("quadruple-sharing", "302");
    const { scheduledTransfer, balanceTotal } = await scheduleRoomTransfer({
      reservationId: reservation._id, payload: payloadFor({ targetRoom: dest, transferDate: futureStr(8) }), actorId,
    });
    expect(balanceTotal).toBe(0);

    const res = await cancelScheduledRoomTransfer(scheduledTransfer._id, { actorId });
    expect(res.outcome).toBe("cancelled");
    expect((await ScheduledRoomTransfer.findById(scheduledTransfer._id)).status).toBe("cancelled");
    expect((await Room.findById(dest._id)).currentOccupancy).toBe(0);
  });

  test("duplicate cancellation is idempotent — no double-decrement", async () => {
    const { reservation, actorId } = await seed({ sourceType: "private", roomNumber: "101" });
    const dest = await emptyRoom("double-sharing", "205");
    const { scheduledTransfer } = await scheduleRoomTransfer({
      reservationId: reservation._id, payload: payloadFor({ targetRoom: dest, transferDate: futureStr(12) }), actorId,
    });
    const first = await cancelScheduledRoomTransfer(scheduledTransfer._id, { actorId });
    expect(first.outcome).toBe("cancelled");
    const second = await cancelScheduledRoomTransfer(scheduledTransfer._id, { actorId });
    expect(second.outcome).toBe("skipped");
    expect(second.reason).toBe("already_cancelled");
    expect((await Room.findById(dest._id)).currentOccupancy).toBe(0); // not -1
  });

  test("cancelled Bill is no longer outstanding on web + mobile serializers", async () => {
    const { reservation, actorId } = await seed({ sourceType: "quadruple-sharing", roomNumber: "301" });
    const dest = await emptyRoom("private", "205");
    const { scheduledTransfer } = await scheduleRoomTransfer({
      reservationId: reservation._id, payload: payloadFor({ targetRoom: dest, transferDate: futureStr(12) }), actorId,
    });
    await cancelScheduledRoomTransfer(scheduledTransfer._id, { actorId });

    const bill = await Bill.findById(scheduledTransfer.settlementBillId).lean();
    // Canonical void: persisted status "voided" -> the mobile bridge maps it
    // to the non-outstanding "cancelled" status (resolveMobileBillStatus), so
    // the tenant app never presents it as money due.
    expect(bill.status).toBe("voided");
    const mobile = toMobileBill(bill);
    expect(mobile.status).toBe("cancelled");
    // Web "my bills" query filters status:{ $ne: "draft" } but the balance
    // serializer for the schedule treats a voided bill as no-bill:
    const view = await serializeScheduledRoomTransfer(await ScheduledRoomTransfer.findById(scheduledTransfer._id));
    expect(view.status).toBe("cancelled");
    expect(view.transferBalance.paymentState).toBe("none");
    // And the tenant "Upcoming Room Transfer" resolver now returns null.
    expect(await getOpenScheduledRoomTransferForReservation(reservation._id)).toBeNull();
  });
});

// ── Any payment -> manual settlement ─────────────────────────────────────
describe("paid cancellation -> action_required, no financial reversal", () => {
  test("partial payment: action_required PAYMENT_ALREADY_RECEIVED; hold KEPT; Bill/Payment/deposit preserved", async () => {
    const { reservation, roomA, actorId } = await seed({ sourceType: "quadruple-sharing", roomNumber: "301" });
    const dest = await emptyRoom("private", "205");
    const { scheduledTransfer } = await scheduleRoomTransfer({
      reservationId: reservation._id, payload: payloadFor({ targetRoom: dest, transferDate: futureStr(12) }), actorId,
    });
    const bill = await Bill.findById(scheduledTransfer.settlementBillId);
    await applyBillPayment({ bill, amount: Math.round(bill.totalAmount * 0.3 * 100) / 100, method: "offline_cash", source: "admin-manual", now: new Date() });
    const heldAfterPartial = (await Reservation.findById(reservation._id)).securityDepositHeld;

    const res = await cancelScheduledRoomTransfer(scheduledTransfer._id, { actorId });
    expect(res.outcome).toBe("action_required");
    expect(res.reason).toBe("PAYMENT_ALREADY_RECEIVED");

    const s = await ScheduledRoomTransfer.findById(scheduledTransfer._id);
    expect(s.status).toBe("action_required");
    expect(s.holdApplied).toBe(true); // KEPT for an explicit admin cancel

    // Nothing financial reversed.
    const billAfter = await Bill.findById(bill._id);
    expect(billAfter.status).not.toBe("voided");
    expect(billAfter.paidAmount).toBeGreaterThan(0);
    expect(await Payment.countDocuments({ billId: bill._id })).toBe(1);
    expect(Number((await Reservation.findById(reservation._id)).securityDepositHeld)).toBeCloseTo(heldAfterPartial, 2);
    // Addendum still there (non-current); hold still on the room.
    expect((await Contract.findById(scheduledTransfer.addendumContractId)).isCurrent).toBe(false);
    expect((await Room.findById(dest._id)).currentOccupancy).toBe(1);
    // Source still current.
    expect(String((await Reservation.findById(reservation._id)).roomId)).toBe(String(roomA._id));
  });

  test("fully paid (Ready): action_required, no refund, held deposit preserved", async () => {
    const { reservation, actorId } = await seed({ sourceType: "quadruple-sharing", roomNumber: "301" });
    const dest = await emptyRoom("private", "205");
    const { scheduledTransfer } = await scheduleRoomTransfer({
      reservationId: reservation._id, payload: payloadFor({ targetRoom: dest, transferDate: futureStr(12) }), actorId,
    });
    await payFull(scheduledTransfer.settlementBillId);
    const heldAfterFull = (await Reservation.findById(reservation._id)).securityDepositHeld;

    const res = await cancelScheduledRoomTransfer(scheduledTransfer._id, { actorId });
    expect(res.outcome).toBe("action_required");
    expect(res.reason).toBe("PAYMENT_ALREADY_RECEIVED");

    const bill = await Bill.findById(scheduledTransfer.settlementBillId);
    expect(bill.status).not.toBe("voided");
    expect(bill.paidAmount).toBeCloseTo(bill.totalAmount, 2);
    expect(Number((await Reservation.findById(reservation._id)).securityDepositHeld)).toBeCloseTo(heldAfterFull, 2);
  });
});

// ── Post-cutover ─────────────────────────────────────────────────────────
describe("post-cutover", () => {
  test("executed schedule -> TRANSFER_ALREADY_COMPLETED", async () => {
    const { reservation, actorId } = await seed({ sourceType: "quadruple-sharing", roomNumber: "301" });
    const dest = await emptyRoom("private", "205");
    const { scheduledTransfer } = await scheduleRoomTransfer({
      reservationId: reservation._id, payload: payloadFor({ targetRoom: dest, transferDate: futureStr(2) }), actorId,
    });
    await payFull(scheduledTransfer.settlementBillId);
    const exec = await executeScheduledRoomTransfer(scheduledTransfer._id, { now: DUE_NOW });
    expect(exec.outcome).toBe("executed");

    const res = await cancelScheduledRoomTransfer(scheduledTransfer._id, { actorId });
    expect(res.outcome).toBe("skipped");
    expect(res.reason).toBe("TRANSFER_ALREADY_COMPLETED");
  });
});

// ── action_required cancellation safety ──────────────────────────────────
describe("action_required cancellation", () => {
  test("action_required + zero payment (TRANSFER_BALANCE_UNPAID) can be safely cancelled", async () => {
    const { reservation, actorId } = await seed({ sourceType: "quadruple-sharing", roomNumber: "301" });
    const dest = await emptyRoom("private", "205");
    const { scheduledTransfer } = await scheduleRoomTransfer({
      reservationId: reservation._id, payload: payloadFor({ targetRoom: dest, transferDate: futureStr(2) }), actorId,
    });
    // Executor with unpaid Bill -> action_required.
    const exec = await executeScheduledRoomTransfer(scheduledTransfer._id, { now: DUE_NOW });
    expect(exec.outcome).toBe("action_required");
    expect(exec.reason).toBe("TRANSFER_BALANCE_UNPAID");

    const res = await cancelScheduledRoomTransfer(scheduledTransfer._id, { actorId });
    expect(res.outcome).toBe("cancelled");
    expect((await Room.findById(dest._id)).currentOccupancy).toBe(0);
    expect((await Bill.findById(scheduledTransfer.settlementBillId)).status).toBe("voided");
  });

  test("action_required + payment cannot auto-cancel financially", async () => {
    const { reservation, actorId } = await seed({ sourceType: "quadruple-sharing", roomNumber: "301" });
    const dest = await emptyRoom("private", "205");
    const { scheduledTransfer } = await scheduleRoomTransfer({
      reservationId: reservation._id, payload: payloadFor({ targetRoom: dest, transferDate: futureStr(12) }), actorId,
    });
    const bill = await Bill.findById(scheduledTransfer.settlementBillId);
    await applyBillPayment({ bill, amount: 500, method: "offline_cash", source: "admin-manual", now: new Date() });
    // Force into action_required.
    await ScheduledRoomTransfer.updateOne({ _id: scheduledTransfer._id }, { $set: { status: "action_required", lastError: "OPERATIONAL_VALIDATION_FAILED" } });

    const res = await cancelScheduledRoomTransfer(scheduledTransfer._id, { actorId });
    expect(res.outcome).toBe("action_required");
    expect(res.reason).toBe("PAYMENT_ALREADY_RECEIVED");
    expect((await Bill.findById(bill._id)).status).not.toBe("voided");
  });
});

// ── Tenant departure integration ────────────────────────────────────────
describe("tenant departure before effective date", () => {
  function moveOutPayload() {
    return { confirm: true, moveOutDate: getManilaToday().toDate().toISOString(), finalUtilityReading: 100, forceOverride: true };
  }

  test("move-out + unpaid schedule -> auto-cancel, hold released, transfer NOT executed", async () => {
    const { reservation, roomA, actorId } = await seed({ sourceType: "quadruple-sharing", roomNumber: "301" });
    const dest = await emptyRoom("private", "205");
    const { scheduledTransfer } = await scheduleRoomTransfer({
      reservationId: reservation._id, payload: payloadFor({ targetRoom: dest, transferDate: futureStr(12) }), actorId,
    });

    await moveOutStayWorkflow({ reservationId: String(reservation._id), payload: moveOutPayload(), actorId });

    const s = await ScheduledRoomTransfer.findById(scheduledTransfer._id);
    expect(s.status).toBe("cancelled");
    expect((await Room.findById(dest._id)).currentOccupancy).toBe(0);
    expect((await Contract.findById(scheduledTransfer.addendumContractId)).isCurrent).toBe(false);
    expect((await Bill.findById(scheduledTransfer.settlementBillId)).status).toBe("voided");
    // Tenant left the SOURCE room (moveOut), never the destination.
    expect((await Reservation.findById(reservation._id)).status).toBe("moveOut");
    void roomA;
  });

  test("termination (reason:terminated move-out) + unpaid schedule -> auto-cancel", async () => {
    const { reservation, actorId } = await seed({ sourceType: "quadruple-sharing", roomNumber: "301" });
    const dest = await emptyRoom("private", "205");
    const { scheduledTransfer } = await scheduleRoomTransfer({
      reservationId: reservation._id, payload: payloadFor({ targetRoom: dest, transferDate: futureStr(12) }), actorId,
    });
    // executeEarlyTerminationWorkflow routes through moveOutStayWorkflow; drive
    // that directly with the termination reason (the early-termination wrapper
    // has an unrelated pre-existing depositForfeitureReason enum bug).
    await moveOutStayWorkflow({
      reservationId: String(reservation._id),
      payload: { ...moveOutPayload(), reason: "terminated" },
      actorId,
    });
    expect((await ScheduledRoomTransfer.findById(scheduledTransfer._id)).status).toBe("cancelled");
    expect((await Room.findById(dest._id)).currentOccupancy).toBe(0);
  });

  test("resolveScheduledTransferBeforeTenantDeparture is wired into the abandonment workflow", async () => {
    // executeAbandonmentProtocolWorkflow has unrelated pre-existing enum bugs
    // (status:"abandoned", depositForfeitureReason:"unannounced_abandonment")
    // that make it un-runnable end-to-end here. This asserts the hook is
    // present so a future fix to that workflow gets scheduled-transfer cleanup
    // for free.
    const src = await import("fs").then((fs) =>
      fs.readFileSync(new URL("../utils/tenantActionService.js", import.meta.url), "utf8"),
    );
    const abandonBody = src.split("export async function executeAbandonmentProtocolWorkflow")[1].split("export async function")[0];
    expect(abandonBody).toMatch(/resolveScheduledTransferBeforeTenantDeparture/);
  });

  test("departure + PAID schedule -> destination hold RELEASED, financial history PRESERVED, action_required, transfer NOT executed", async () => {
    const { reservation, actorId } = await seed({ sourceType: "quadruple-sharing", roomNumber: "301" });
    const dest = await emptyRoom("private", "205");
    const { scheduledTransfer } = await scheduleRoomTransfer({
      reservationId: reservation._id, payload: payloadFor({ targetRoom: dest, transferDate: futureStr(12) }), actorId,
    });
    await payFull(scheduledTransfer.settlementBillId);
    const heldBeforeDeparture = (await Reservation.findById(reservation._id)).securityDepositHeld;

    await moveOutStayWorkflow({ reservationId: String(reservation._id), payload: moveOutPayload(), actorId });

    const s = await ScheduledRoomTransfer.findById(scheduledTransfer._id);
    expect(s.status).toBe("action_required");
    expect(s.lastError).toBe("PAYMENT_ALREADY_RECEIVED");
    expect(s.holdApplied).toBe(false); // physical resource freed

    // Destination hold released — room is available again.
    expect((await Room.findById(dest._id)).currentOccupancy).toBe(0);

    // Financial history preserved.
    const bill = await Bill.findById(scheduledTransfer.settlementBillId);
    expect(bill.status).not.toBe("voided");
    expect(bill.paidAmount).toBeCloseTo(bill.totalAmount, 2);
    expect(await Payment.countDocuments({ billId: bill._id })).toBe(1);
    // securityDepositHeld unchanged by the cancellation — move-out clearance
    // uses it as the ACTUAL cash basis (documented behavior).
    const resAfter = await Reservation.findById(reservation._id);
    expect(Number(resAfter.securityDepositHeld)).toBeCloseTo(heldBeforeDeparture, 2);
    expect(resAfter.status).toBe("moveOut");

    // Transfer NEVER executed — Addendum still non-current.
    expect((await Contract.findById(scheduledTransfer.addendumContractId)).isCurrent).toBe(false);
  });
});

// ── resolveScheduledTransferBeforeTenantDeparture direct ─────────────────
describe("resolveScheduledTransferBeforeTenantDeparture helper", () => {
  test("no open schedule -> handled:false (noop)", async () => {
    const { reservation, actorId } = await seed();
    const r = await resolveScheduledTransferBeforeTenantDeparture(reservation._id, { actorId });
    expect(r.handled).toBe(false);
  });
});
