/**
 * ============================================================================
 * PHASE 6 — TRANSFER-DAY FINANCIAL SETTLEMENT: VERIFICATION + HARDENING
 * ============================================================================
 * Does NOT duplicate tenantActionService.transferFinancialSettlement.integration
 * (higher/lower/same rent+deposit, rent-credit isolation, partial payment,
 * duplicate webhook, idempotent retry, rollback). This file adds only the
 * gaps that phase surfaced:
 *
 *   - SOURCE ELECTRICITY EXACTLY ONCE: even when an admin supplies a source
 *     meter reading, the transfer_settlement Bill carries NO electricity
 *     charge (charges.electricity === 0). The departed tenant's pre-transfer
 *     source-room electricity is billed once, at the source room's
 *     UtilityPeriod close (Phase 4 room-scoped occupancy). The estimate is
 *     kept in transferSnapshot as an admin-preview figure only.
 *   - SOURCE WATER EXACTLY ONCE: the transfer_settlement Bill never carries a
 *     water charge; water is settled only at its canonical period close
 *     (Phase 5). No water line where the branch/room is not water-billable.
 *   - CANONICAL TOTAL: transfer_settlement Bill totalAmount === sumBillCharges
 *     of its component lines, with rent and deposit as separate categories.
 *   - MULTI-TRANSFER FINANCIALS: A -> B -> C each produces its own auditable
 *     transfer_settlement Bill; transfer #2 uses the CURRENT held deposit and
 *     the CURRENT (transfer #1 destination) source rate, and destination
 *     requirements for room C. Future regular Bills stay destination-based.
 *
 * PDF generation is mocked; everything else runs for real against a
 * single-node replica set inside genuine Mongo transactions.
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
  const { transitionContract } = await import("../services/contractService.js");
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
const realContractService = await import("../services/contractService.js");
await jest.unstable_mockModule("../services/contractService.js", () => ({
  ...realContractService,
  validateContractForGeneration: mockValidate,
}));

const { transferStayWorkflow } = await import("./tenantActionService.js");
const { generateContractNumber } = await import("../services/contractService.js");
const { ensureCurrentCycleRentBill, resolveReservationRentAmount } =
  await import("../services/billing/rentGenerator.js");
const { sumBillCharges } = await import("../services/billing/billingPolicy.js");
const { resolveRoomScopedReservationsForPeriod } = await import("../controllers/utilityBillingController.js");
const { filterBillableReservationsForPeriod } = await import("../utils/utilityFlowRules.js");
const { computeBilling } = await import("../utils/billingEngine.js");
const { Contract, Reservation, Room, User, Stay, BedHistory, Bill, BusinessSettings, TenantCredit, UtilityReading, UtilityPeriod } =
  await import("../models/index.js");

jest.setTimeout(240_000);

const RATE = { private: 13500, "double-sharing": 8100, "quadruple-sharing": 5400 };
const CAP = { private: 1, "double-sharing": 2, "quadruple-sharing": 4 };
const NEEDS_BED = new Set(["double-sharing", "quadruple-sharing"]);
const MOVE_IN = new Date("2026-08-01T00:00:00.000Z"); // 31-day cycle Aug1..Sep1
const CYCLE_END = new Date("2026-09-01T00:00:00.000Z");
const roundMoney = (v) => Math.round((Number(v) || 0) * 100) / 100;

function bedsFor(type, prefix) {
  if (!NEEDS_BED.has(type)) return [];
  return Array.from({ length: CAP[type] }, (_, i) => ({
    id: `${prefix}-b${i + 1}`, position: i % 2 ? "upper" : "lower", status: "available",
  }));
}

describe("Phase 6 — transfer settlement hardening", () => {
  let mongo;
  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri(), { dbName: "phase6_settlement" });
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
      UtilityReading.deleteMany({}),
    ]);
    await BusinessSettings.create({
      key: "global",
      privateDiscountPercent: 10, doubleDiscountPercent: 10, quadrupleDiscountPercent: 10,
      isDiscountEnabled: true, longTermLeaseMinMonths: 6,
    });
    mockValidate.mockClear();
    mockGenerate.mockClear();
  });

  async function seed({ sourceType, roomNumber = "301", branch = "gil-puyat" }) {
    const tenant = await User.create({
      firebaseUid: `fb-${new mongoose.Types.ObjectId()}`,
      email: `t-${new mongoose.Types.ObjectId()}@ex.test`,
      username: `t_${new mongoose.Types.ObjectId().toString().slice(-10)}`,
      firstName: "P6", lastName: "T", role: "tenant", tenantStatus: "active",
    });
    const srcBeds = bedsFor(sourceType, `r${roomNumber}`);
    if (srcBeds.length) srcBeds[0] = { ...srcBeds[0], status: "occupied", occupiedBy: { userId: tenant._id } };
    const roomA = await Room.create({
      name: `Room ${roomNumber}`, roomNumber, branch,
      type: sourceType, capacity: CAP[sourceType], currentOccupancy: 1, price: RATE[sourceType], beds: srcBeds,
    });
    const srcBedId = NEEDS_BED.has(sourceType) ? `r${roomNumber}-b1` : "";
    const srcStayBedId = srcBedId || `room-${roomA._id}`;
    const reservation = await Reservation.create({
      userId: tenant._id, roomId: roomA._id, status: "moveIn", leaseDuration: 6,
      reservationFeeAmount: 2000, preferredRoomType: sourceType,
      agreedToPrivacy: true, agreedToCertification: true,
      totalPrice: RATE[sourceType], monthlyRent: RATE[sourceType],
      selectedBed: { id: srcBedId }, moveInDate: MOVE_IN,
      securityDepositHeld: RATE[sourceType],
    });
    if (srcBeds.length) { roomA.beds[0].occupiedBy.reservationId = reservation._id; await roomA.save(); }
    const stay = await Stay.create({
      tenantId: tenant._id, reservationId: reservation._id, branch: roomA.branch,
      roomId: roomA._id, bedId: srcStayBedId,
      leaseStartDate: MOVE_IN, leaseEndDate: new Date("2027-01-31T00:00:00.000Z"),
      monthlyRent: RATE[sourceType], status: "active",
    });
    if (NEEDS_BED.has(sourceType)) {
      await BedHistory.create({
        bedId: srcBedId, roomId: roomA._id, tenantId: tenant._id, reservationId: reservation._id,
        stayId: stay._id, branch: roomA.branch, moveInDate: MOVE_IN, status: "active",
      });
    }
    const actorId = new mongoose.Types.ObjectId();
    const num = await generateContractNumber(roomA.branch, new Date());
    const predecessor = await Contract.create({
      ...num, contractPurpose: "initial", tenantId: tenant._id, applicationId: reservation._id,
      reservationId: reservation._id, stayId: stay._id, roomId: roomA._id, branch: roomA.branch,
      propertyName: "Lilycrest Dormitory", propertyAddress: "123 Test St.", roomNumber: roomA.roomNumber,
      roomType: sourceType, leaseType: "long_term", approvedMonthlyRate: RATE[sourceType],
      securityDepositAmount: RATE[sourceType],
      leaseStartDate: MOVE_IN, leaseEndDate: new Date("2027-01-31T00:00:00.000Z"), leaseDurationMonths: 6,
      status: "active", isCurrent: true,
      statusHistory: [{ status: "active", changedBy: actorId, reason: "seed" }],
      createdBy: actorId, updatedBy: actorId,
    });
    return { tenant, roomA, reservation, stay, predecessor, actorId };
  }

  async function emptyRoom(type, roomNumber, branch = "gil-puyat") {
    return Room.create({
      name: `Room ${roomNumber}`, roomNumber, branch,
      type, capacity: CAP[type], currentOccupancy: 0, price: RATE[type], beds: bedsFor(type, `r${roomNumber}`),
    });
  }

  async function runTransfer({ reservation, targetRoom, actorId, transferDate = "2026-08-15T00:00:00.000Z", sourceReading, targetReading }) {
    const destBedId = NEEDS_BED.has(targetRoom.type) ? `r${targetRoom.roomNumber}-b1` : undefined;
    return transferStayWorkflow({
      reservationId: reservation._id,
      payload: {
        confirm: true, targetRoomId: targetRoom._id,
        ...(destBedId ? { targetBedId: destBedId } : {}),
        effectiveTransferDate: transferDate, forceOverride: true,
        ...(sourceReading != null ? { sourceRoomMeterReading: sourceReading } : {}),
        ...(targetReading != null ? { targetRoomMeterReading: targetReading } : {}),
      },
      actorId,
    });
  }

  const settlementBill = (reservationId) =>
    Bill.findOne({ reservationId, billType: "transfer_settlement" });

  // ── 1. Source electricity charged EXACTLY ONCE ────────────────────────
  test("admin supplies a source meter reading: transfer_settlement Bill carries NO electricity charge; the source period close bills it once", async () => {
    const { tenant, roomA, reservation, actorId } = await seed({ sourceType: "quadruple-sharing" });
    const roomB = await emptyRoom("private", "402");

    // Source-room electricity period-start baseline BEFORE the transfer.
    await UtilityReading.create({
      utilityType: "electricity", roomId: roomA._id, branch: roomA.branch,
      reading: 1000, date: MOVE_IN, eventType: "periodStart", recordedBy: actorId, activeTenantIds: [],
    });
    // An OPEN electricity UtilityPeriod so the workflow can compute its
    // best-effort transfer-time estimate (ratePerUnit needed).
    await UtilityPeriod.create({
      utilityType: "electricity", roomId: roomA._id, branch: roomA.branch,
      startDate: MOVE_IN, startReading: 1000, ratePerUnit: 10, status: "open",
    });

    // Transfer WITH a source meter reading (1140 -> 140 kWh consumed Aug 1..15).
    await runTransfer({ reservation, targetRoom: roomB, actorId, sourceReading: 1140, targetReading: 5000 });

    const bill = await settlementBill(reservation._id);
    // The estimate is recorded for admin visibility ...
    expect(bill.transferSnapshot.estimatedElectricityKwh).toBeCloseTo(140, 2);
    expect(bill.transferSnapshot.estimatedElectricityCharge).toBeGreaterThan(0);
    expect(bill.transferSnapshot.sourceElectricitySettledAtPeriodClose).toBe(true);
    // ... but it is NOT a charge on this Bill.
    expect(bill.charges.electricity).toBe(0);
    // Bill total = rent + deposit only (no electricity, no water).
    expect(bill.totalAmount).toBeCloseTo(
      roundMoney(bill.charges.rent + bill.charges.securityDeposit), 2,
    );

    // Now close the source room's electricity period: the departed tenant is
    // billed for EXACTLY their pre-transfer segment (140 kWh), once.
    const RATE_KWH = 10;
    const srcReadings = [
      { tenantId: null, eventType: "periodStart", date: MOVE_IN, reading: 1000 },
      { tenantId: String(tenant._id), eventType: "moveOut", date: new Date("2026-08-15T00:00:00.000Z"), reading: 1140 },
      { tenantId: null, eventType: "periodEnd", date: CYCLE_END, reading: 1500 },
    ];
    const scoped = await resolveRoomScopedReservationsForPeriod({ room: roomA, periodStart: MOVE_IN, periodEnd: CYCLE_END });
    const billable = filterBillableReservationsForPeriod({ reservations: scoped, cycleStart: MOVE_IN, cycleEnd: CYCLE_END });
    const period = { startDate: MOVE_IN, endDate: CYCLE_END, startReading: 1000, endReading: 1500, ratePerUnit: RATE_KWH };
    const { buildTenantEventsForPeriod } = await import("../utils/utilityFlowRules.js");
    const tenantEvents = buildTenantEventsForPeriod({ period, reservations: billable, readings: srcReadings });
    const closeResult = computeBilling({
      utilityPeriod: period, readings: srcReadings, reservations: billable, tenantEvents,
      forceSegmented: true, utilityType: "electricity", roomType: roomA.type,
    });
    const mine = closeResult.tenantSummaries.find((s) => String(s.tenantId) === String(tenant._id));
    expect(mine).toBeTruthy();
    expect(mine.totalUsage).toBeCloseTo(140, 4);            // exactly the pre-transfer segment
    expect(mine.billAmount).toBeCloseTo(140 * RATE_KWH, 2); // charged once, here

    // Only ONE electricity figure exists for this tenant+room+consumption:
    // the transfer Bill's is 0; the close's is 140*rate.
    expect(bill.charges.electricity + mine.billAmount).toBeCloseTo(140 * RATE_KWH, 2);
  });

  // ── 2. Source water is NOT settled at transfer ───────────────────────
  test("transfer_settlement Bill never carries a water charge (water is settled at its own period close)", async () => {
    const { reservation, actorId } = await seed({ sourceType: "double-sharing" });
    const roomB = await emptyRoom("private", "402");
    await runTransfer({ reservation, targetRoom: roomB, actorId, sourceReading: 1140, targetReading: 5000 });
    const bill = await settlementBill(reservation._id);
    expect(bill.charges.water).toBe(0);
  });

  // ── 3. Canonical Bill total == component sum, categories separate ─────
  test("Quad -> Private (higher rent + higher deposit): total == sumBillCharges; rent and deposit are distinct lines", async () => {
    const { reservation, actorId } = await seed({ sourceType: "quadruple-sharing" });
    const roomB = await emptyRoom("private", "402"); // 13500 rent, 13500 required deposit
    await runTransfer({ reservation, targetRoom: roomB, actorId });

    const bill = await settlementBill(reservation._id);
    expect(bill.charges.rent).toBeGreaterThan(0);            // additional rent due
    expect(bill.charges.securityDeposit).toBe(roundMoney(13500 - 5400)); // 8100, only the difference
    expect(bill.charges.electricity).toBe(0);
    expect(bill.charges.water).toBe(0);
    // Deposit is NOT hidden inside rent.
    expect(bill.charges.rent).not.toBe(bill.charges.securityDeposit);
    // Canonical summation — not a hand-rolled total.
    expect(bill.totalAmount).toBeCloseTo(sumBillCharges(bill.charges), 2);
    expect(bill.grossAmount).toBeCloseTo(sumBillCharges(bill.charges), 2);
    expect(bill.transferSnapshot.rentComponentDue).toBeCloseTo(bill.charges.rent, 2);
    expect(bill.transferSnapshot.depositComponentDue).toBeCloseTo(bill.charges.securityDeposit, 2);
    expect(bill.transferSnapshot.totalImmediateDue).toBeCloseTo(bill.totalAmount, 2);
  });

  // ── 4. Multi-transfer: each leg its own settlement; T#2 uses CURRENT values
  test("A(Quad 5400) -> B(Double 8100) -> C(Private 13500): two settlement Bills; T#2 source rate = 8100, T#2 held deposit = 8100", async () => {
    const { reservation, roomA, actorId } = await seed({ sourceType: "quadruple-sharing" });
    const roomB = await emptyRoom("double-sharing", "402");
    const roomC = await emptyRoom("private", "503");

    // ── Transfer #1 (Aug 10): Quad -> Double ───────────────────────────
    await runTransfer({ reservation, targetRoom: roomB, actorId, transferDate: "2026-08-10T00:00:00.000Z" });
    const afterT1 = await Reservation.findById(reservation._id);
    expect(afterT1.recurringRentRate).toBe(8100);           // Phase 3
    // Deposit: Quad held 5400, Double required 8100 -> 2700 additional due, NOT yet funded.
    const t1Bill = await settlementBill(reservation._id);
    expect(t1Bill.charges.securityDeposit).toBe(roundMoney(8100 - 5400)); // 2700
    expect(afterT1.securityDepositHeld).toBe(5400);         // unchanged until paid

    // Admin wet-signs the T#1 replacement Contract (Phase 8 concern; here just
    // the precondition for a second transfer) AND settles the T#1 deposit
    // component so held becomes the current 8100.
    await Contract.updateOne({ reservationId: reservation._id, isCurrent: true }, { $set: { status: "active" } });
    const { applyBillPayment } = await import("../services/billing/paymentLedger.js");
    const freshT1 = await Bill.findById(t1Bill._id);
    await applyBillPayment({
      bill: freshT1, amount: freshT1.totalAmount, method: "offline_cash",
      source: "admin-manual", externalPaymentId: `t1-${t1Bill._id}`,
    });
    const midState = await Reservation.findById(reservation._id);
    expect(midState.securityDepositHeld).toBe(8100);        // now the CURRENT held cash

    // ── Transfer #2 (Aug 20): Double -> Private ────────────────────────
    await transferStayWorkflow({
      reservationId: reservation._id,
      payload: { confirm: true, targetRoomId: roomC._id, effectiveTransferDate: "2026-08-20T00:00:00.000Z", forceOverride: true },
      actorId,
    });

    const settlements = await Bill.find({ reservationId: reservation._id, billType: "transfer_settlement" }).sort({ createdAt: 1 });
    expect(settlements).toHaveLength(2);                     // each transfer its own auditable settlement
    const t2 = settlements[1];

    // T#2 SOURCE rate is transfer #1's destination (8100), NOT the original Quad 5400.
    expect(t2.transferSnapshot.sourceApprovedRate).toBe(8100);
    expect(t2.transferSnapshot.sourceRateSource).toBe("prior_transfer_recurring_rate");
    expect(t2.transferSnapshot.destinationApprovedRate).toBe(13500);

    // T#2 deposit settlement uses the CURRENT held cash (8100), not the original 5400.
    expect(t2.transferSnapshot.depositPreviouslyHeld).toBe(8100);
    expect(t2.transferSnapshot.destinationRequiredDeposit).toBe(13500);
    expect(t2.charges.securityDeposit).toBe(roundMoney(13500 - 8100)); // 5400 additional due

    // After T#2, recurring rent = room C rate.
    const afterT2 = await Reservation.findById(reservation._id);
    expect(afterT2.recurringRentRate).toBe(13500);
    expect(resolveReservationRentAmount(afterT2)).toBe(13500);

    // Future regular Bill is destination (room C) based.
    const rDoc = await Reservation.findById(reservation._id).populate("roomId");
    const gen = await ensureCurrentCycleRentBill({ reservation: rDoc, referenceDate: new Date("2026-10-05T00:00:00.000Z"), notifyTenant: false });
    expect(gen.status).toBe("created");
    expect(gen.bill.charges.rent).toBe(13500);

    // Each settlement Bill still passes the canonical total check.
    for (const s of settlements) {
      expect(s.totalAmount).toBeCloseTo(sumBillCharges(s.charges), 2);
      expect(s.charges.electricity).toBe(0);
      expect(s.charges.water).toBe(0);
    }
  });

  // ── 5. Same rent + same deposit: no manufactured charge, only utilities left
  test("Double -> Double (same rate, same deposit): transfer_settlement Bill has zero rent, zero deposit, zero utilities", async () => {
    const { reservation, actorId } = await seed({ sourceType: "double-sharing" });
    const roomB = await emptyRoom("double-sharing", "402");
    await runTransfer({ reservation, targetRoom: roomB, actorId, sourceReading: 1140, targetReading: 5000 });
    const bill = await settlementBill(reservation._id);
    expect(bill.charges.rent).toBe(0);
    expect(bill.charges.securityDeposit).toBe(0);
    expect(bill.charges.electricity).toBe(0);
    expect(bill.charges.water).toBe(0);
    expect(bill.totalAmount).toBe(0);
    expect(bill.status).toBe("paid"); // a zero-due settlement is not an obligation
    // No rent credit manufactured either (consumed == unused at same rate).
    const credits = await TenantCredit.find({ userId: reservation.userId });
    expect(credits).toHaveLength(0);
  });

  // ── 6. Cancellation-before-cutover == mid-transaction failure ─────────
  test("a transfer that does not complete leaves NO transfer_settlement Bill (the Bill is created inside the cutover transaction)", async () => {
    const { reservation, roomA, actorId } = await seed({ sourceType: "double-sharing" });
    // Cross-branch target -> Stage A rejects before any financial write.
    const gd = await Room.create({
      name: "GD", roomNumber: "999", branch: "guadalupe",
      type: "quadruple-sharing", capacity: 4, currentOccupancy: 0, price: 5400,
      beds: bedsFor("quadruple-sharing", "gd"),
    });
    await expect(transferStayWorkflow({
      reservationId: reservation._id,
      payload: { confirm: true, targetRoomId: gd._id, targetBedId: "gd-b1", effectiveTransferDate: "2026-08-15T00:00:00.000Z", forceOverride: true },
      actorId,
    })).rejects.toMatchObject({ code: "CROSS_BRANCH_TRANSFER_NOT_ALLOWED" });

    expect(await Bill.find({ reservationId: reservation._id, billType: "transfer_settlement" })).toHaveLength(0);
    const r = await Reservation.findById(reservation._id);
    expect(r.securityDepositHeld).toBe(8100); // unchanged
    expect(r.recurringRentRate == null).toBe(true); // no destination rate applied
    expect(String(r.roomId)).toBe(String(roomA._id)); // still in the source room
  });
});
