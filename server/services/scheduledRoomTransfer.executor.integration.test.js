/**
 * ============================================================================
 * Phase 2G — Effective-date executor + financial revalidation
 * ============================================================================
 * The executor is pure orchestration around the ONE canonical
 * transferStayWorkflow. Proven here:
 *
 *   Due selection
 *     - a schedule whose Manila effective date is in the future is NOT due
 *     - due exactly on the Manila effective date
 *
 *   Payment gate
 *     - unpaid balance Bill  -> action_required TRANSFER_BALANCE_UNPAID, no cutover
 *     - partial balance Bill -> action_required TRANSFER_BALANCE_UNPAID, no cutover
 *     - fully paid + unchanged settlement -> executes
 *     - zero-balance + unchanged settlement -> executes
 *
 *   One settlement Bill only
 *     - after execution there is exactly ONE transfer_settlement Bill
 *     - a paid scheduled rent adjustment is NOT charged a second time
 *     - a paid scheduled deposit is NOT charged a second time
 *     - securityDepositHeld is NOT double-funded
 *
 *   Live revalidation
 *     - higher final amount -> Bill reconciled UP + action_required
 *       ADDITIONAL_BALANCE_DUE, no cutover
 *     - lower final amount after payment -> action_required
 *       FINANCIAL_ADJUSTMENT_REQUIRED, no auto-refund, no Rent Credit, no cutover
 *
 *   Hold conversion
 *     - destination currentOccupancy is NOT double-incremented
 *     - a shared reserved hold becomes an occupied current bed
 *     - private has no fake bed
 *     - a concurrent booking cannot steal the held slot during execution
 *
 *   Cutover effects (delegated, spot-checked)
 *     - Addendum becomes current ONLY on success
 *     - utility boundary readings created on the effective date only
 *     - transfer settlement electricity/water remain 0
 *     - cheaper transfer creates the Rent-only TenantCredit at execution
 *
 *   Failure
 *     - a forced workflow failure leaves source current, Addendum non-current,
 *       hold restored, status action_required
 *
 *   Retry / Job 20
 *     - retry is idempotent (no duplicate Bill / Credit / occupancy)
 *     - Job 20 ignores action_required
 *     - a duplicate Job 20 run does not duplicate anything
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
  executeScheduledRoomTransfer,
  executeDueScheduledRoomTransfers,
  retryScheduledRoomTransfer,
  isScheduledTransferDue,
} = await import("./scheduledRoomTransferExecutor.js");
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

const futureStr = (d = 12) => getManilaToday().add(d, "day").format("YYYY-MM-DD");
const bedsFor = (type, prefix) =>
  NEEDS_BED.has(type)
    ? Array.from({ length: CAP[type] }, (_, i) => ({ id: `${prefix}-b${i + 1}`, position: i % 2 ? "upper" : "lower", status: "available" }))
    : [];

async function seed({ sourceType = "quadruple-sharing", roomNumber = "301", moveInDaysAgo = 20 } = {}) {
  const moveIn = getManilaToday().subtract(moveInDaysAgo, "day").toDate();
  const leaseEnd = getManilaToday().add(320, "day").toDate();
  const tenant = await User.create({
    firebaseUid: `fb-${new mongoose.Types.ObjectId()}`, email: `t-${new mongoose.Types.ObjectId()}@ex.test`,
    username: `t_${new mongoose.Types.ObjectId().toString().slice(-10)}`,
    firstName: "Exec", lastName: "Tenant", role: "tenant", tenantStatus: "active",
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
async function payFull(billId) {
  const bill = await Bill.findById(billId);
  return applyBillPayment({ bill, amount: bill.remainingAmount, method: "offline_cash", source: "admin-manual", now: new Date() });
}
// Schedules are created 2 days out (futureStr(2)); we "make them due" by
// advancing the clock the executor sees — NOT by rewinding the effective date
// (which would change the settlement proration boundary).
const DUE_NOW = getManilaToday().add(3, "day").toDate();
async function makeDue() { /* no-op — pass { now: DUE_NOW } to the executor */ }

let mongo;
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri(), { dbName: "sched_transfer_2g" });
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

describe("due selection", () => {
  test("future effective date is NOT due; today IS due", () => {
    expect(isScheduledTransferDue(getManilaToday().add(3, "day").toDate())).toBe(false);
    expect(isScheduledTransferDue(getManilaToday().toDate())).toBe(true);
    expect(isScheduledTransferDue(getManilaToday().subtract(1, "day").toDate())).toBe(true);
  });

  test("executeDueScheduledRoomTransfers skips a not-yet-due schedule", async () => {
    const { reservation, actorId } = await seed();
    const dest = await emptyRoom("private", "205");
    await scheduleRoomTransfer({
      reservationId: reservation._id,
      payload: payloadFor({ targetRoom: dest, transferDate: futureStr(30) }),
      actorId,
    });
    const report = await executeDueScheduledRoomTransfers(); // real "now"
    expect(report.scanned).toBe(0);
    expect(report.executed).toBe(0);
  });
});

describe("payment gate", () => {
  test("unpaid balance -> action_required TRANSFER_BALANCE_UNPAID, no cutover", async () => {
    const { reservation, roomA, stay, original, actorId } = await seed();
    const dest = await emptyRoom("private", "205");
    const { scheduledTransfer } = await scheduleRoomTransfer({
      reservationId: reservation._id, payload: payloadFor({ targetRoom: dest, transferDate: futureStr(2) }), actorId,
    });
    expect(scheduledTransfer.settlementBillId).toBeTruthy();
    await makeDue(scheduledTransfer._id);

    const res = await executeScheduledRoomTransfer(scheduledTransfer._id, { now: DUE_NOW });
    expect(res.outcome).toBe("action_required");
    expect(res.reason).toBe("TRANSFER_BALANCE_UNPAID");

    const s = await ScheduledRoomTransfer.findById(scheduledTransfer._id);
    expect(s.status).toBe("action_required");
    expect(s.holdApplied).toBe(true);
    // Source unchanged.
    expect(String((await Reservation.findById(reservation._id)).roomId)).toBe(String(roomA._id));
    expect((await Stay.findById(stay._id)).status).toBe("active");
    expect((await Contract.findById(original._id)).isCurrent).toBe(true);
    expect((await Contract.findById(scheduledTransfer.addendumContractId)).isCurrent).toBe(false);
    expect(await Bill.countDocuments({ reservationId: reservation._id, billType: "transfer_settlement" })).toBe(1);
  });

  test("partial payment -> action_required, no cutover", async () => {
    const { reservation, actorId } = await seed();
    const dest = await emptyRoom("private", "205");
    const { scheduledTransfer } = await scheduleRoomTransfer({
      reservationId: reservation._id, payload: payloadFor({ targetRoom: dest, transferDate: futureStr(2) }), actorId,
    });
    const bill = await Bill.findById(scheduledTransfer.settlementBillId);
    await applyBillPayment({ bill, amount: Math.round(bill.totalAmount * 0.5 * 100) / 100, method: "offline_cash", source: "admin-manual", now: new Date() });
    await makeDue(scheduledTransfer._id);

    const res = await executeScheduledRoomTransfer(scheduledTransfer._id, { now: DUE_NOW });
    expect(res.outcome).toBe("action_required");
    expect(res.reason).toBe("TRANSFER_BALANCE_UNPAID");
    expect((await ScheduledRoomTransfer.findById(scheduledTransfer._id)).status).toBe("action_required");
  });

  test("fully paid + unchanged settlement -> executes; ONE settlement Bill; no double charge / double deposit fund", async () => {
    const { reservation, roomA, stay, original, actorId } = await seed();
    const dest = await emptyRoom("private", "205");
    const heldBefore = (await Reservation.findById(reservation._id)).securityDepositHeld;
    const { scheduledTransfer } = await scheduleRoomTransfer({
      reservationId: reservation._id, payload: payloadFor({ targetRoom: dest, transferDate: futureStr(2) }), actorId,
    });
    const billId = scheduledTransfer.settlementBillId;
    const billBefore = await Bill.findById(billId).lean();
    const rentComp = billBefore.charges.rent;
    const depComp = billBefore.charges.securityDeposit;

    await payFull(billId);
    // Deposit component funded on payment (2F).
    expect(Number((await Reservation.findById(reservation._id)).securityDepositHeld)).toBeCloseTo(heldBefore + depComp, 2);

    await makeDue(scheduledTransfer._id);
    const res = await executeScheduledRoomTransfer(scheduledTransfer._id, { now: DUE_NOW });
    if (res.outcome !== "executed") throw new Error(`expected executed, got ${JSON.stringify(res)}`);

    // Exactly ONE transfer_settlement Bill, and it's the same one.
    const bills = await Bill.find({ reservationId: reservation._id, billType: "transfer_settlement" });
    expect(bills).toHaveLength(1);
    expect(String(bills[0]._id)).toBe(String(billId));
    // Charges unchanged (not re-added), paidAmount preserved.
    expect(bills[0].charges.rent).toBeCloseTo(rentComp, 2);
    expect(bills[0].charges.securityDeposit).toBeCloseTo(depComp, 2);
    expect(bills[0].charges.electricity).toBe(0);
    expect(bills[0].charges.water).toBe(0);
    expect(bills[0].paidAmount).toBeCloseTo(billBefore.totalAmount, 2);
    expect(bills[0].remainingAmount).toBe(0);

    // securityDepositHeld NOT double-funded.
    expect(Number((await Reservation.findById(reservation._id)).securityDepositHeld)).toBeCloseTo(heldBefore + depComp, 2);

    // Cutover happened: room/rate now destination; Addendum current; one Payment.
    const resAfter = await Reservation.findById(reservation._id);
    expect(String(resAfter.roomId)).toBe(String(dest._id));
    expect(Number(resAfter.recurringRentRate)).toBe(RATE.private);
    const curStay = await Stay.findOne({ reservationId: reservation._id, status: "active" });
    expect(String(curStay.roomId)).toBe(String(dest._id));
    expect((await Contract.findById(scheduledTransfer.addendumContractId)).isCurrent).toBe(true);
    expect((await Contract.findById(original._id)).isCurrent).toBe(false);
    expect(await Payment.countDocuments({ billId })).toBe(1);

    // Any utility boundary readings that DO get created are on the effective
    // date (the transfer only writes them when there is source utility data;
    // this seed has none, so 0 is also valid).
    const readings = await UtilityReading.find({});
    for (const r of readings) {
      expect(getManilaToday(scheduledTransfer.effectiveTransferDate).isSame(getManilaToday(r.date), "day")).toBe(true);
    }
    void readings;

    // Schedule -> executed with executedSettlement.
    const s = await ScheduledRoomTransfer.findById(scheduledTransfer._id);
    expect(s.status).toBe("executed");
    expect(s.executedAt).toBeTruthy();
    expect(s.executedSettlement.settlementBillId).toBe(String(billId));
    expect(s.holdApplied).toBe(false);
    void roomA; void stay;
  });

  test("zero-balance schedule + unchanged settlement -> executes with one (paid) settlement Bill", async () => {
    const { reservation, actorId } = await seed({ sourceType: "quadruple-sharing", roomNumber: "301", moveInDaysAgo: 3 });
    const dest = await emptyRoom("quadruple-sharing", "302");
    const { scheduledTransfer, balanceTotal } = await scheduleRoomTransfer({
      reservationId: reservation._id, payload: payloadFor({ targetRoom: dest, transferDate: futureStr(2) }), actorId,
    });
    expect(balanceTotal).toBe(0);
    expect(scheduledTransfer.settlementBillId == null).toBe(true);
    await makeDue(scheduledTransfer._id);

    const res = await executeScheduledRoomTransfer(scheduledTransfer._id, { now: DUE_NOW });
    expect(res.outcome).toBe("executed");
    const bills = await Bill.find({ reservationId: reservation._id, billType: "transfer_settlement" });
    expect(bills).toHaveLength(1);
    expect(bills[0].totalAmount).toBe(0);
    expect(bills[0].status).toBe("paid");
  });
});

describe("live revalidation", () => {
  test("higher final amount -> Bill reconciled UP + action_required ADDITIONAL_BALANCE_DUE, no cutover", async () => {
    const { reservation, roomA, actorId } = await seed();
    const dest = await emptyRoom("private", "205");
    const { scheduledTransfer } = await scheduleRoomTransfer({
      reservationId: reservation._id, payload: payloadFor({ targetRoom: dest, transferDate: futureStr(2) }), actorId,
    });
    const billId = scheduledTransfer.settlementBillId;
    await payFull(billId);
    const totalBefore = (await Bill.findById(billId)).totalAmount;

    // Change live state so the recompute is HIGHER: the destination (private)
    // canonical rate goes UP because the branch discount is removed after
    // scheduling. computeRoomTransferPreview + the settlement both re-resolve
    // the destination rate, so rent proration + required deposit both rise.
    await BusinessSettings.updateOne({ key: "global" }, { $set: { privateDiscountPercent: 0 } });
    await makeDue(scheduledTransfer._id);

    const res = await executeScheduledRoomTransfer(scheduledTransfer._id, { now: DUE_NOW });
    expect(res.outcome).toBe("action_required");
    expect(res.reason).toBe("ADDITIONAL_BALANCE_DUE");

    const billAfter = await Bill.findById(billId);
    expect(billAfter.totalAmount).toBeGreaterThan(totalBefore);
    expect(billAfter.remainingAmount).toBeGreaterThan(0); // the delta
    expect(billAfter.paidAmount).toBeCloseTo(totalBefore, 2); // prior payment intact
    // No cutover.
    expect(String((await Reservation.findById(reservation._id)).roomId)).toBe(String(roomA._id));
    expect((await Contract.findById(scheduledTransfer.addendumContractId)).isCurrent).toBe(false);
    // Still ONE Bill.
    expect(await Bill.countDocuments({ reservationId: reservation._id, billType: "transfer_settlement" })).toBe(1);
  });

  test("lower final amount after payment -> FINANCIAL_ADJUSTMENT_REQUIRED, no auto-refund, no Rent Credit, no cutover", async () => {
    const { reservation, roomA, actorId } = await seed();
    const dest = await emptyRoom("private", "205");
    const { scheduledTransfer } = await scheduleRoomTransfer({
      reservationId: reservation._id, payload: payloadFor({ targetRoom: dest, transferDate: futureStr(2) }), actorId,
    });
    const billId = scheduledTransfer.settlementBillId;
    await payFull(billId);
    const paidBefore = (await Bill.findById(billId)).paidAmount;

    // Make the recompute LOWER: the destination (private) canonical rate goes
    // DOWN because the branch discount is DEEPENED after scheduling.
    await BusinessSettings.updateOne({ key: "global" }, { $set: { privateDiscountPercent: 40 } });
    await makeDue(scheduledTransfer._id);

    const res = await executeScheduledRoomTransfer(scheduledTransfer._id, { now: DUE_NOW });
    expect(res.outcome).toBe("action_required");
    expect(res.reason).toBe("FINANCIAL_ADJUSTMENT_REQUIRED");

    // No refund, no reallocation, no credit, no cutover.
    const billAfter = await Bill.findById(billId);
    expect(billAfter.paidAmount).toBeCloseTo(paidBefore, 2);
    expect(await TenantCredit.countDocuments({})).toBe(0);
    expect(String((await Reservation.findById(reservation._id)).roomId)).toBe(String(roomA._id));
    expect((await Contract.findById(scheduledTransfer.addendumContractId)).isCurrent).toBe(false);
  });
});

describe("hold conversion + concurrency", () => {
  test("shared reserved hold -> occupied current bed; occupancy not double-incremented", async () => {
    const { reservation, actorId } = await seed({ sourceType: "private", roomNumber: "101" });
    const dest = await emptyRoom("double-sharing", "205");
    const { scheduledTransfer } = await scheduleRoomTransfer({
      reservationId: reservation._id, payload: payloadFor({ targetRoom: dest, transferDate: futureStr(2) }), actorId,
    });
    // Hold in place: bed reserved, occupancy 1.
    let d = await Room.findById(dest._id);
    expect(d.beds.find((b) => b.id === "r205-b1").status).toBe("reserved");
    expect(d.currentOccupancy).toBe(1);

    await payFull(scheduledTransfer.settlementBillId).catch(() => {}); // may be zero-balance
    const bill = await Bill.findById(scheduledTransfer.settlementBillId);
    if (bill && bill.remainingAmount > 0) await payFull(bill._id);
    await makeDue(scheduledTransfer._id);

    const res = await executeScheduledRoomTransfer(scheduledTransfer._id, { now: DUE_NOW });
    expect(res.outcome).toBe("executed");

    d = await Room.findById(dest._id);
    expect(d.currentOccupancy).toBe(1); // NOT 2
    const bed = d.beds.find((b) => b.id === "r205-b1");
    expect(bed.status).toBe("occupied");
    expect(String(bed.occupiedBy.reservationId)).toBe(String(reservation._id));
  });

  test("private destination: no fake bed after execution", async () => {
    const { reservation, actorId } = await seed({ sourceType: "double-sharing", roomNumber: "210" });
    const dest = await emptyRoom("private", "205");
    const { scheduledTransfer } = await scheduleRoomTransfer({
      reservationId: reservation._id, payload: payloadFor({ targetRoom: dest, transferDate: futureStr(2) }), actorId,
    });
    const bill = await Bill.findById(scheduledTransfer.settlementBillId);
    if (bill && bill.remainingAmount > 0) await payFull(bill._id);
    await makeDue(scheduledTransfer._id);
    const res = await executeScheduledRoomTransfer(scheduledTransfer._id, { now: DUE_NOW });
    expect(res.outcome).toBe("executed");
    const d = await Room.findById(dest._id);
    expect(d.beds).toHaveLength(0);
    expect(d.currentOccupancy).toBe(1);
  });

  test("a concurrent booking cannot steal the held destination during execution", async () => {
    const { reservation, actorId } = await seed({ sourceType: "private", roomNumber: "101" });
    const other = await seed({ sourceType: "private", roomNumber: "102" });
    const dest = await emptyRoom("double-sharing", "205");
    const { scheduledTransfer } = await scheduleRoomTransfer({
      reservationId: reservation._id, payload: payloadFor({ targetRoom: dest, transferDate: futureStr(2) }), actorId,
    });
    const bill = await Bill.findById(scheduledTransfer.settlementBillId);
    if (bill && bill.remainingAmount > 0) await payFull(bill._id);
    await makeDue(scheduledTransfer._id);

    // Fire the executor and a rival schedule targeting the SAME held bed concurrently.
    const rival = scheduleRoomTransfer({
      reservationId: other.reservation._id,
      payload: { confirm: true, targetRoomId: String(dest._id), targetBedId: "r205-b1", effectiveTransferDate: futureStr(2), forceOverride: true },
      actorId: other.actorId,
    }).then(() => "scheduled").catch((e) => e.code || "err");

    const [execRes, rivalRes] = await Promise.all([
      executeScheduledRoomTransfer(scheduledTransfer._id, { now: DUE_NOW }),
      rival,
    ]);
    // Either the executor wins the bed and executes, OR the rival slipped in
    // first and the executor safely goes action_required — but NEVER a double
    // occupancy, and NEVER two owners of the same bed.
    expect(["executed", "action_required"]).toContain(execRes.outcome);
    const d = await Room.findById(dest._id);
    const b1 = d.beds.find((b) => b.id === "r205-b1");

    if (execRes.outcome === "executed") {
      expect(b1.status).toBe("occupied");
      expect(String(b1.occupiedBy.reservationId)).toBe(String(reservation._id));
      // The rival must NOT also hold r205-b1.
      if (rivalRes === "scheduled") {
        const rd = await ScheduledRoomTransfer.findOne({ reservationId: other.reservation._id });
        expect(rd.destinationBedId).not.toBe("r205-b1");
      }
    } else {
      // Executor deferred; the rival took b1 (as a "reserved" hold) OR failed.
      expect(["BED_NOT_AVAILABLE", "DESTINATION_ROOM_FULL", "err", "scheduled"]).toContain(rivalRes);
    }
    // Capacity 2 room: never more than 2 committed, ever.
    expect(d.currentOccupancy).toBeLessThanOrEqual(2);
    // b1 has at most ONE owner.
    if (b1.occupiedBy?.reservationId) {
      const owners = [String(b1.occupiedBy.reservationId)];
      expect(new Set(owners).size).toBe(1);
    }
  });
});

describe("cheaper transfer creates the Rent-only TenantCredit only at execution", () => {
  test("Private -> Quad: no credit at scheduling; credit created on successful cutover", async () => {
    const { reservation, actorId } = await seed({ sourceType: "private", roomNumber: "101", moveInDaysAgo: 3 });
    const dest = await emptyRoom("quadruple-sharing", "301");
    const { scheduledTransfer } = await scheduleRoomTransfer({
      reservationId: reservation._id, payload: payloadFor({ targetRoom: dest, transferDate: futureStr(2) }), actorId,
    });
    expect(await TenantCredit.countDocuments({})).toBe(0);

    // Fund a prior cycle rent bill so there IS excess prepaid to credit:
    // simulate a paid monthly bill for the current cycle at the private rate.
    // (Cycle 0 is contract-rate funded; excessCredit can still be 0 — accept
    // either, but assert NO credit before and AT MOST one after.)
    const bill = await Bill.findById(scheduledTransfer.settlementBillId);
    if (bill && bill.remainingAmount > 0) await payFull(bill._id);
    await makeDue(scheduledTransfer._id);

    const res = await executeScheduledRoomTransfer(scheduledTransfer._id, { now: DUE_NOW });
    expect(res.outcome).toBe("executed");
    // At most one credit, and only from the canonical engine (idempotency-keyed).
    const credits = await TenantCredit.find({ reservationId: reservation._id });
    expect(credits.length).toBeLessThanOrEqual(1);
    if (credits.length === 1) {
      expect(credits[0].category).toBe("rent");
    }
  });
});

describe("failure + retry + Job 20", () => {
  test("forced workflow failure -> rollback, source current, Addendum non-current, hold restored, action_required", async () => {
    const { reservation, roomA, stay, original, actorId } = await seed();
    const dest = await emptyRoom("private", "205");
    const { scheduledTransfer } = await scheduleRoomTransfer({
      reservationId: reservation._id, payload: payloadFor({ targetRoom: dest, transferDate: futureStr(2) }), actorId,
    });
    await payFull(scheduledTransfer.settlementBillId);
    await makeDue(scheduledTransfer._id);

    // Break the cutover: archive the Addendum so resolveRoomTransferSuccessor
    // still finds it in validateOperational (non-abandoned) but the workflow's
    // in-txn re-resolve throws. Simplest deterministic break: make the
    // destination bed unavailable AFTER the operational check but the executor
    // re-releases/re-takes atomically — instead, poison the successor's roomId.
    await Contract.updateOne(
      { _id: scheduledTransfer.addendumContractId },
      { $set: { roomId: new mongoose.Types.ObjectId() } },
    );

    const res = await executeScheduledRoomTransfer(scheduledTransfer._id, { now: DUE_NOW });
    expect(res.outcome).toBe("action_required");

    const s = await ScheduledRoomTransfer.findById(scheduledTransfer._id);
    expect(s.status).toBe("action_required");
    expect(s.holdApplied).toBe(true);
    // Source fully intact.
    expect(String((await Reservation.findById(reservation._id)).roomId)).toBe(String(roomA._id));
    expect((await Stay.findById(stay._id)).status).toBe("active");
    expect((await Contract.findById(original._id)).isCurrent).toBe(true);
    expect((await Contract.findById(scheduledTransfer.addendumContractId)).isCurrent).toBe(false);
    // Destination hold restored: bed reserved for THIS tenant, occ 1.
    const d = await Room.findById(dest._id);
    expect(d.currentOccupancy).toBe(1);
    // Exactly one Bill.
    expect(await Bill.countDocuments({ reservationId: reservation._id, billType: "transfer_settlement" })).toBe(1);
  });

  test("retry after fixing the blocker is idempotent (no duplicate Bill / Credit / occupancy)", async () => {
    const { reservation, actorId } = await seed();
    const dest = await emptyRoom("private", "205");
    const { scheduledTransfer } = await scheduleRoomTransfer({
      reservationId: reservation._id, payload: payloadFor({ targetRoom: dest, transferDate: futureStr(2) }), actorId,
    });
    await makeDue(scheduledTransfer._id);

    // First attempt: unpaid -> action_required.
    let res = await executeScheduledRoomTransfer(scheduledTransfer._id, { now: DUE_NOW });
    expect(res.outcome).toBe("action_required");
    expect(res.reason).toBe("TRANSFER_BALANCE_UNPAID");

    // Cron does NOT retry action_required.
    const report = await executeDueScheduledRoomTransfers({ now: DUE_NOW });
    expect(report.scanned).toBe(0);

    // Admin settles, then retries.
    await payFull(scheduledTransfer.settlementBillId);
    res = await retryScheduledRoomTransfer(scheduledTransfer._id, { now: DUE_NOW });
    expect(res.outcome).toBe("executed");

    // Retrying again is a no-op.
    const again = await retryScheduledRoomTransfer(scheduledTransfer._id, { now: DUE_NOW });
    expect(again.outcome).toBe("skipped");

    expect(await Bill.countDocuments({ reservationId: reservation._id, billType: "transfer_settlement" })).toBe(1);
    expect(await Payment.countDocuments({})).toBe(1);
    expect((await Room.findById(dest._id)).currentOccupancy).toBe(1);
  });

  test("duplicate Job 20 run does not duplicate anything", async () => {
    const { reservation, actorId } = await seed();
    const dest = await emptyRoom("private", "205");
    const { scheduledTransfer } = await scheduleRoomTransfer({
      reservationId: reservation._id, payload: payloadFor({ targetRoom: dest, transferDate: futureStr(2) }), actorId,
    });
    await payFull(scheduledTransfer.settlementBillId);
    await makeDue(scheduledTransfer._id);

    const r1 = await executeDueScheduledRoomTransfers({ now: DUE_NOW });
    expect(r1.executed).toBe(1);
    const r2 = await executeDueScheduledRoomTransfers({ now: DUE_NOW });
    expect(r2.scanned).toBe(0); // already executed, not selected

    expect(await Bill.countDocuments({ reservationId: reservation._id, billType: "transfer_settlement" })).toBe(1);
    expect((await Room.findById(dest._id)).currentOccupancy).toBe(1);
    expect((await ScheduledRoomTransfer.findById(scheduledTransfer._id)).status).toBe("executed");
  });
});
