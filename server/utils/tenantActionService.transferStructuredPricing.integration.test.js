/**
 * Phase 4B: room-transfer settlement must use the rent value actually
 * funded for the current rental period, not blindly the Contract-approved
 * rate — this matters specifically for structured (pricingSnapshot)
 * reservations, whose first period is funded by a one-time advance-rent
 * amount that need not equal the Contract's approvedMonthlyRate, and whose
 * later periods are funded by their own regular "monthly" Bill.
 *
 * Companion to tenantActionService.transferCutover.integration.test.js
 * (flat-rate regression lives there, unchanged by this work).
 */
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, test, jest } from "@jest/globals";
import { MongoMemoryReplSet } from "mongodb-memory-server";

import { transferStayWorkflow } from "./tenantActionService.js";
import { generateContractNumber } from "../services/contractService.js";
import { resolveCurrentBillingCycle } from "../services/billing/billingPolicy.js";
import { Contract, Reservation, Room, User, Stay, BedHistory, Bill } from "../models/index.js";

jest.setTimeout(120_000);

describe("transferStayWorkflow — structured pricing prepaid-rent resolution", () => {
  let mongo;

  beforeAll(async () => {
    mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    await mongoose.connect(mongo.getUri(), { dbName: "transfer_structured_pricing_integration" });
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
      Contract.deleteMany({}),
      Stay.deleteMany({}),
      BedHistory.deleteMany({}),
      Bill.deleteMany({}),
    ]);
  });

  async function seedScenario({ moveInDate, structuredAdvanceRentAmount = null }) {
    const tenant = await User.create({
      firebaseUid: `firebase-${new mongoose.Types.ObjectId()}`,
      email: `tenant-${new mongoose.Types.ObjectId()}@example.test`,
      username: `tenant_${new mongoose.Types.ObjectId().toString().slice(-10)}`,
      firstName: "Test", lastName: "Tenant", role: "tenant", tenantStatus: "active",
    });
    const roomA = await Room.create({
      name: "Room 301", roomNumber: "301", branch: "gil-puyat",
      type: "quadruple-sharing", capacity: 4, currentOccupancy: 1,
      price: 6300,
      beds: [{ id: "bed-a1", position: "single", status: "occupied", occupiedBy: { userId: tenant._id, reservationId: null } }],
    });
    const roomB = await Room.create({
      name: "Room 305", roomNumber: "305", branch: "gil-puyat",
      type: "quadruple-sharing", capacity: 4, currentOccupancy: 0,
      price: 14400,
      beds: [{ id: "bed-b1", position: "single", status: "available" }],
    });

    const reservationData = {
      userId: tenant._id, roomId: roomA._id, status: "moveIn", leaseDuration: 6,
      reservationFeeAmount: 2000, preferredRoomType: "quadruple-sharing",
      agreedToPrivacy: true, agreedToCertification: true, totalPrice: 6300,
      selectedBed: { id: "bed-a1" },
      moveInDate,
    };
    if (structuredAdvanceRentAmount != null) {
      reservationData.financialWorkflowVersion = "structured-initial-payment-v1";
      reservationData.pricingSnapshot = {
        regularMonthlyRate: 6300,
        finalMonthlyRate: structuredAdvanceRentAmount,
        advanceRentAmount: structuredAdvanceRentAmount,
        securityDepositAmount: structuredAdvanceRentAmount,
        reservationFeeAmount: 2000,
        approvedInitialCharges: 0,
        roomType: "quadruple-sharing",
        leaseType: "long",
        leaseDurationMonths: 6,
        branchId: "gil-puyat",
        approvedAt: new Date(),
        snapshotVersion: 1,
      };
    }
    const reservation = await Reservation.create(reservationData);
    roomA.beds[0].occupiedBy.reservationId = reservation._id;
    await roomA.save();

    const stay = await Stay.create({
      tenantId: tenant._id, reservationId: reservation._id, branch: roomA.branch,
      roomId: roomA._id, bedId: "bed-a1",
      leaseStartDate: moveInDate,
      leaseEndDate: new Date("2027-01-31T00:00:00.000Z"),
      monthlyRent: 6300, status: "active",
    });
    const bedHistory = await BedHistory.create({
      bedId: "bed-a1", roomId: roomA._id, tenantId: tenant._id, reservationId: reservation._id,
      stayId: stay._id, branch: roomA.branch, moveInDate,
      status: "active",
    });

    const actorId = new mongoose.Types.ObjectId();
    const numberA = await generateContractNumber(roomA.branch, new Date());
    // Contract's approvedMonthlyRate is deliberately DIFFERENT from the
    // structured advance-rent amount, mirroring the task's example
    // (Contract A rate ₱6,300 vs. structured prepaid rent ₱5,400).
    const predecessor = await Contract.create({
      ...numberA, contractPurpose: "initial", tenantId: tenant._id, applicationId: reservation._id,
      reservationId: reservation._id, stayId: stay._id, roomId: roomA._id, branch: roomA.branch,
      propertyName: "Lilycrest Dormitory", propertyAddress: "123 Test St.", roomNumber: roomA.roomNumber,
      roomType: "quadruple-sharing", leaseType: "long_term", approvedMonthlyRate: 6300,
      status: "active", isCurrent: true,
      statusHistory: [{ status: "active", changedBy: actorId, reason: "seed" }],
      createdBy: actorId, updatedBy: actorId,
    });

    const number = await generateContractNumber(roomB.branch, new Date());
    const successor = await Contract.create({
      ...number, contractPurpose: "replacement", replacesContractId: predecessor._id,
      parentContractId: predecessor._id, tenantId: tenant._id, applicationId: reservation._id,
      reservationId: reservation._id, stayId: stay._id, roomId: roomB._id, branch: roomB.branch,
      propertyName: "Lilycrest Dormitory", propertyAddress: "123 Test St.", roomNumber: roomB.roomNumber,
      roomType: "quadruple-sharing", leaseType: "long_term", approvedMonthlyRate: 14400,
      leaseStartDate: new Date("2026-08-15T00:00:00.000Z"),
      leaseEndDate: new Date("2027-01-31T00:00:00.000Z"), leaseDurationMonths: 6,
      status: "generated", isCurrent: false, tenantVisible: true,
      statusHistory: [{ status: "generated", changedBy: actorId, reason: "seed prepared draft" }],
      createdBy: actorId, updatedBy: actorId,
    });

    return { tenant, roomA, roomB, reservation, stay, bedHistory, predecessor, successor, actorId };
  }

  test("first (advance-covered) period: uses pricingSnapshot.advanceRentAmount, not Contract.approvedMonthlyRate", async () => {
    const moveInDate = new Date("2026-08-01T00:00:00.000Z");
    const { reservation, roomB, actorId } = await seedScenario({
      moveInDate,
      structuredAdvanceRentAmount: 5400, // Contract rate is 6300 — deliberately different
    });

    await transferStayWorkflow({
      reservationId: reservation._id,
      payload: {
        confirm: true, targetRoomId: roomB._id, targetBedId: "bed-b1",
        effectiveTransferDate: "2026-08-15T00:00:00.000Z",
      },
      actorId,
    });

    const transferBill = await Bill.findOne({ reservationId: reservation._id, billType: "transfer_settlement" });
    expect(transferBill.transferSnapshot.prepaidRentSource).toBe("initial_pricing_snapshot");
    expect(transferBill.transferSnapshot.applicablePrepaidRent).toBe(5400);
    // sourceApprovedRate (values days consumed) now uses the tenant's approved
    // DISCOUNTED rent (pricingSnapshot.finalMonthlyRate = 5400), not the
    // Contract's undiscounted 6300 — the approved discount must remain
    // effective when valuing days already consumed.
    expect(transferBill.transferSnapshot.sourceRateSource).toBe("structured_final_monthly_rate");
    expect(transferBill.transferSnapshot.sourceApprovedRate).toBe(5400);
    // sourceConsumedValue and the unused credit both derive from the SAME
    // approved 5400 basis (5400/31*14 = 2438.71), so they reconcile exactly
    // to the amount actually funded — never diluted by the undiscounted rate.
    expect(transferBill.transferSnapshot.proRataRent).toBeCloseTo(2438.71, 2);
    expect(transferBill.transferSnapshot.unusedPrepaidCredit).toBeCloseTo(5400 - 2438.71, 2);
    // pricingSnapshot itself must remain untouched (immutable).
    const reloadedReservation = await Reservation.findById(reservation._id);
    expect(reloadedReservation.pricingSnapshot.advanceRentAmount).toBe(5400);
    expect(reloadedReservation.pricingSnapshot.finalMonthlyRate).toBe(5400);
    // Contract A's own (undiscounted) approvedMonthlyRate is a separate
    // historical field and must not be rewritten by settlement-source hardening.
    const reloadedPredecessor = await Contract.findOne({ reservationId: reservation._id, contractPurpose: "initial" });
    expect(reloadedPredecessor.approvedMonthlyRate).toBe(6300);
  });

  test("later period: uses the CURRENT period's paid rent Bill, not the original initial-payment snapshot", async () => {
    const moveInDate = new Date("2026-05-01T00:00:00.000Z");
    const { reservation, roomB, actorId } = await seedScenario({
      moveInDate,
      structuredAdvanceRentAmount: 5400,
    });
    const transferDate = new Date("2026-08-15T00:00:00.000Z");
    const currentCycle = resolveCurrentBillingCycle(moveInDate, transferDate);
    expect(currentCycle.cycleIndex).toBeGreaterThan(0);

    // A later period's regular rent Bill can legitimately carry a different
    // amount than the original advance-rent snapshot (e.g. after a renewal).
    await Bill.create({
      billType: "monthly", reservationId: reservation._id, userId: reservation.userId,
      branch: "gil-puyat", roomId: reservation.roomId,
      billingMonth: currentCycle.billingCycleStart,
      billingCycleStart: currentCycle.billingCycleStart, billingCycleEnd: currentCycle.billingCycleEnd,
      charges: { rent: 7000, electricity: 0, water: 0, applianceFees: 0, corkageFees: 0, penalty: 0, discount: 0 },
      totalAmount: 7000, grossAmount: 7000, remainingAmount: 0, paidAmount: 7000, status: "paid",
    });

    await transferStayWorkflow({
      reservationId: reservation._id,
      payload: { confirm: true, targetRoomId: roomB._id, targetBedId: "bed-b1", effectiveTransferDate: transferDate },
      actorId,
    });

    const transferBill = await Bill.findOne({ reservationId: reservation._id, billType: "transfer_settlement" });
    expect(transferBill.transferSnapshot.prepaidRentSource).toBe("current_bill");
    expect(transferBill.transferSnapshot.applicablePrepaidRent).toBe(7000);
    // Not the original snapshot's 5400, and not blindly the Contract's 6300.
    expect(transferBill.transferSnapshot.applicablePrepaidRent).not.toBe(5400);
    expect(transferBill.transferSnapshot.applicablePrepaidRent).not.toBe(6300);
    // Source-day valuation still uses the tenant's approved ongoing rate
    // (pricingSnapshot.finalMonthlyRate = 5400), never the Contract's 6300
    // and never re-derived from this later period's own Bill amount.
    expect(transferBill.transferSnapshot.sourceRateSource).toBe("structured_final_monthly_rate");
    expect(transferBill.transferSnapshot.sourceApprovedRate).toBe(5400);
  });

  test("structured reservation with NO approved discount matches the equivalent flat-rate settlement result", async () => {
    const moveInDate = new Date("2026-08-01T00:00:00.000Z");
    const { reservation, roomB, actorId } = await seedScenario({
      moveInDate,
      structuredAdvanceRentAmount: 6300, // same as the Contract rate — no discount
    });

    await transferStayWorkflow({
      reservationId: reservation._id,
      payload: {
        confirm: true, targetRoomId: roomB._id, targetBedId: "bed-b1",
        effectiveTransferDate: "2026-08-15T00:00:00.000Z",
      },
      actorId,
    });

    const transferBill = await Bill.findOne({ reservationId: reservation._id, billType: "transfer_settlement" });
    expect(transferBill.transferSnapshot.sourceRateSource).toBe("structured_final_monthly_rate");
    expect(transferBill.transferSnapshot.sourceApprovedRate).toBe(6300);
    // Identical numeric outcome to the flat-rate worked example (Phase 4 regression):
    // 14 source days, 17 destination days, 6300/14300 basis -> same settlement.
    expect(transferBill.proRataDays).toBe(14);
    expect(transferBill.transferSnapshot.proRataRent).toBeCloseTo(2845.16, 2);
    expect(transferBill.transferSnapshot.unusedPrepaidCredit).toBeCloseTo(6300 - 2845.16, 2);
  });

  test("later period, NO current-period Bill: does not fabricate full-rent prepaid credit", async () => {
    const moveInDate = new Date("2026-05-01T00:00:00.000Z");
    const { reservation, roomB, actorId } = await seedScenario({
      moveInDate,
      structuredAdvanceRentAmount: 5400,
    });
    const transferDate = new Date("2026-08-15T00:00:00.000Z");
    const currentCycle = resolveCurrentBillingCycle(moveInDate, transferDate);
    expect(currentCycle.cycleIndex).toBeGreaterThan(0);
    // Deliberately do NOT create a "monthly" Bill for the current period —
    // simulates a delayed billing job / data inconsistency, not proof of payment.

    await transferStayWorkflow({
      reservationId: reservation._id,
      payload: { confirm: true, targetRoomId: roomB._id, targetBedId: "bed-b1", effectiveTransferDate: transferDate },
      actorId,
    });

    const transferBill = await Bill.findOne({ reservationId: reservation._id, billType: "transfer_settlement" });
    expect(transferBill.transferSnapshot.prepaidRentSource).toBe("no_current_bill_unfunded");
    expect(transferBill.transferSnapshot.applicablePrepaidRent).toBe(0);
    expect(transferBill.transferSnapshot.unusedPrepaidCredit).toBe(0);
    // Source-day valuation still correctly uses the approved 5400 rent —
    // only the (absent) funding evidence is treated conservatively.
    expect(transferBill.transferSnapshot.sourceApprovedRate).toBe(5400);
  });

  test("later period, partially paid rent-only current Bill: credit capped at the amount actually paid", async () => {
    const moveInDate = new Date("2026-05-01T00:00:00.000Z");
    const { reservation, roomB, actorId } = await seedScenario({ moveInDate });
    const transferDate = new Date("2026-08-15T00:00:00.000Z");
    const currentCycle = resolveCurrentBillingCycle(moveInDate, transferDate);

    await Bill.create({
      billType: "monthly", reservationId: reservation._id, userId: reservation.userId,
      branch: "gil-puyat", roomId: reservation.roomId,
      billingMonth: currentCycle.billingCycleStart,
      billingCycleStart: currentCycle.billingCycleStart, billingCycleEnd: currentCycle.billingCycleEnd,
      charges: { rent: 6300, electricity: 0, water: 0, applianceFees: 0, corkageFees: 0, penalty: 0, discount: 0 },
      totalAmount: 6300, grossAmount: 6300, remainingAmount: 3300, paidAmount: 3000, status: "partially-paid",
    });

    await transferStayWorkflow({
      reservationId: reservation._id,
      payload: {
        confirm: true, targetRoomId: roomB._id, targetBedId: "bed-b1",
        effectiveTransferDate: transferDate, forceOverride: true,
      },
      actorId,
    });

    const transferBill = await Bill.findOne({ reservationId: reservation._id, billType: "transfer_settlement" });
    expect(transferBill.transferSnapshot.prepaidRentSource).toBe("current_bill_partial_rent_only");
    expect(transferBill.transferSnapshot.applicablePrepaidRent).toBe(3000);
    expect(transferBill.transferSnapshot.applicablePrepaidRent).toBeLessThanOrEqual(6300);
  });

  test("later period, unpaid current Bill (force-overridden): no false prepaid credit is generated", async () => {
    const moveInDate = new Date("2026-05-01T00:00:00.000Z");
    const { reservation, roomB, actorId } = await seedScenario({ moveInDate });
    const transferDate = new Date("2026-08-15T00:00:00.000Z");
    const currentCycle = resolveCurrentBillingCycle(moveInDate, transferDate);

    await Bill.create({
      billType: "monthly", reservationId: reservation._id, userId: reservation.userId,
      branch: "gil-puyat", roomId: reservation.roomId,
      billingMonth: currentCycle.billingCycleStart,
      billingCycleStart: currentCycle.billingCycleStart, billingCycleEnd: currentCycle.billingCycleEnd,
      charges: { rent: 6300, electricity: 0, water: 0, applianceFees: 0, corkageFees: 0, penalty: 0, discount: 0 },
      totalAmount: 6300, grossAmount: 6300, remainingAmount: 6300, paidAmount: 0, status: "pending",
    });

    await transferStayWorkflow({
      reservationId: reservation._id,
      payload: {
        confirm: true, targetRoomId: roomB._id, targetBedId: "bed-b1",
        effectiveTransferDate: transferDate, forceOverride: true,
      },
      actorId,
    });

    const transferBill = await Bill.findOne({ reservationId: reservation._id, billType: "transfer_settlement" });
    expect(transferBill.transferSnapshot.prepaidRentSource).toBe("current_bill_unpaid");
    expect(transferBill.transferSnapshot.applicablePrepaidRent).toBe(0);
    expect(transferBill.transferSnapshot.unusedPrepaidCredit).toBe(0);

    // The original unpaid rent obligation must remain untouched on its own Bill.
    const reloadedOriginalBill = await Bill.findOne({
      reservationId: reservation._id, billType: "monthly",
    });
    expect(reloadedOriginalBill.remainingAmount).toBe(6300);
    expect(reloadedOriginalBill.status).toBe("pending");
  });

  test("later period, partially paid MIXED (rent + electricity) current Bill: does not treat utility payment as rent credit", async () => {
    const moveInDate = new Date("2026-05-01T00:00:00.000Z");
    const { reservation, roomB, actorId } = await seedScenario({ moveInDate });
    const transferDate = new Date("2026-08-15T00:00:00.000Z");
    const currentCycle = resolveCurrentBillingCycle(moveInDate, transferDate);

    await Bill.create({
      billType: "monthly", reservationId: reservation._id, userId: reservation.userId,
      branch: "gil-puyat", roomId: reservation.roomId,
      billingMonth: currentCycle.billingCycleStart,
      billingCycleStart: currentCycle.billingCycleStart, billingCycleEnd: currentCycle.billingCycleEnd,
      charges: { rent: 6300, electricity: 800, water: 0, applianceFees: 0, corkageFees: 0, penalty: 0, discount: 0 },
      totalAmount: 7100, grossAmount: 7100, remainingAmount: 2100, paidAmount: 5000, status: "partially-paid",
    });

    await transferStayWorkflow({
      reservationId: reservation._id,
      payload: {
        confirm: true, targetRoomId: roomB._id, targetBedId: "bed-b1",
        effectiveTransferDate: transferDate, forceOverride: true,
      },
      actorId,
    });

    const transferBill = await Bill.findOne({ reservationId: reservation._id, billType: "transfer_settlement" });
    expect(transferBill.transferSnapshot.prepaidRentSource).toBe("current_bill_partial_mixed_unallocated");
    expect(transferBill.transferSnapshot.applicablePrepaidRent).toBe(0);
  });
});
