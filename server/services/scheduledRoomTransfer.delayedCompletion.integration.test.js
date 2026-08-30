/**
 * ============================================================================
 * completeRoomTransfer — DELAYED COMPLETION (scheduled earlier, completed now)
 * ============================================================================
 *
 * Round-4: a transfer scheduled for an earlier date but only completed today
 * settles as of TODAY, not the stale scheduled date.
 *
 *  3. Delayed completion that INCREASES the amount due -> the UNPAID
 *     transfer_settlement Bill is recomputed (unpaid-only reshape).
 *  4. Delayed completion after a PARTIAL payment whose recompute is higher ->
 *     ADDITIONAL_BALANCE_DUE (no silent mutation of the paid Bill; no cutover).
 *  5. scheduleHistory keeps the ORIGINAL scheduled date even though
 *     executedAt / cutoverAt land on the actual (later) completion day.
 *
 * The "delay" is simulated by back-dating the ScheduledRoomTransfer record's
 * effectiveTransferDate + stale previewSnapshot after scheduling (which itself
 * only accepts today/future) — this is exactly the "scheduled earlier,
 * completed now" state.
 * ============================================================================
 */
import mongoose from "mongoose";
import { afterAll, beforeAll, beforeEach, describe, expect, test, jest } from "@jest/globals";
import { MongoMemoryReplSet } from "mongodb-memory-server";

const mockGenerate = jest.fn(async ({ contractId, actorId }) => {
  const { Contract } = await import("../models/index.js");
  const { transitionContract } = await import("./contractService.js");
  const c = await Contract.findById(contractId);
  c.preparedDocuments = c.preparedDocuments || [];
  c.preparedDocuments.push({
    documentType: "prepared", version: 1, storageProvider: "local", storageKey: "t/p.pdf",
    fileName: "p.pdf", fileHash: `h-${c._id}`, fileSize: 1, pageCount: 1, templateId: "g",
    templateVersion: "1", coordinateVersion: "1", generatedAt: new Date(), generatedBy: actorId, superseded: false,
  });
  c.generatedFileHash = `h-${c._id}`; c.generatedVersion = 1;
  c.publicationStatus = "ready_for_resident"; c.tenantVisible = true;
  if (c.status === "ready_for_generation") await transitionContract(c, "generated", actorId, "t");
  else await c.save();
  return { contract: c, document: c.preparedDocuments.at(-1), previousStatus: "ready_for_generation", isRegeneration: false };
});
await jest.unstable_mockModule("./contractPdfService.js", () => ({ generatePreparedContractPdf: mockGenerate }));
const realCS = await import("./contractService.js");
await jest.unstable_mockModule("./contractService.js", () => ({
  ...realCS,
  validateContractForGeneration: jest.fn(async () => ({
    valid: true, missingFields: [], errors: [], generationData: { pricing: {} },
    template: { templateId: "g", templateVersion: 1, legalContentVersion: 1 },
  })),
}));

const { scheduleRoomTransfer, completeRoomTransfer, rescheduleRoomTransfer } = await import("./scheduledRoomTransferService.js");
const { generateContractNumber } = await import("./contractService.js");
const { applyBillPayment } = await import("./billing/paymentLedger.js");
const { serializeScheduledRoomTransfer } = await import("./scheduledRoomTransferView.js");
const {
  Contract, Reservation, Room, User, Stay, BedHistory, Bill, BusinessSettings,
  Payment, UtilityReading, UtilityPeriod, UtilityFinalization, ScheduledRoomTransfer,
} = await import("../models/index.js");

jest.setTimeout(240_000);
const round = (v) => Math.round((Number(v) || 0) * 100) / 100;
const MOVE_IN = new Date("2020-01-01T00:00:00.000Z");
const LEASE_END = new Date("2035-12-31T00:00:00.000Z");

async function permissiveOfficeHours() {
  await BusinessSettings.deleteMany({});
  await BusinessSettings.create({
    key: "global",
    privateDiscountPercent: 10, doubleDiscountPercent: 10, quadrupleDiscountPercent: 10,
    isDiscountEnabled: true, longTermLeaseMinMonths: 6,
    officeHoursStartMinutes: 0, officeHoursEndMinutes: 1440, officeDaysOfWeek: [1, 2, 3, 4, 5, 6, 7],
  });
}

async function seed() {
  await permissiveOfficeHours();
  // Guadalupe = fixed-rate (NOT sub-metered) — no meter-reading step, so these
  // tests isolate the rent/deposit SETTLEMENT DATE. Guadalupe only allows
  // quadruple-sharing, so quad -> quad. The settlement amount is driven by
  // securityDepositHeld vs the destination required deposit.
  const branch = "guadalupe";
  const tenant = await User.create({
    firebaseUid: `fb-${new mongoose.Types.ObjectId()}`, email: `t-${Date.now()}@ex.test`,
    username: `t_${Date.now()}`, firstName: "D", lastName: "C", role: "tenant", tenantStatus: "active",
  });
  const roomA = await Room.create({
    name: "QA", roomNumber: "QA1", branch, type: "quadruple-sharing", capacity: 4, currentOccupancy: 1, price: 5400,
    beds: ["b1", "b2", "b3", "b4"].map((id, i) => ({
      id: `qa-${id}`, position: i % 2 ? "upper" : "lower",
      status: i === 0 ? "occupied" : "available",
      ...(i === 0 ? { occupiedBy: { userId: tenant._id } } : {}),
    })),
  });
  const roomB = await Room.create({
    name: "QB", roomNumber: "QB1", branch, type: "quadruple-sharing", capacity: 4, currentOccupancy: 0, price: 5400,
    beds: ["b1", "b2", "b3", "b4"].map((id, i) => ({ id: `qb-${id}`, position: i % 2 ? "upper" : "lower", status: "available" })),
  });
  const res = await Reservation.create({
    userId: tenant._id, roomId: roomA._id, status: "moveIn", leaseDuration: 12,
    reservationFeeAmount: 2000, preferredRoomType: "quadruple-sharing",
    agreedToPrivacy: true, agreedToCertification: true,
    totalPrice: 5400, monthlyRent: 5400, selectedBed: { id: "qa-b1" }, moveInDate: MOVE_IN,
    // Deliberately LOW held deposit so an additional-deposit-due exists on
    // transfer (destination required ≈ 1x the ~₱4,860 discounted quad rate).
    securityDepositHeld: 1000,
  });
  roomA.beds[0].occupiedBy.reservationId = res._id;
  await roomA.save();
  const stay = await Stay.create({
    tenantId: tenant._id, reservationId: res._id, branch, roomId: roomA._id, bedId: "qa-b1",
    leaseStartDate: MOVE_IN, leaseEndDate: LEASE_END, monthlyRent: 5400, status: "active",
  });
  await BedHistory.create({
    bedId: "qa-b1", roomId: roomA._id, tenantId: tenant._id, reservationId: res._id, stayId: stay._id,
    branch, moveInDate: MOVE_IN, effectiveStartDate: MOVE_IN, status: "active",
  });
  const actorId = new mongoose.Types.ObjectId();
  const num = await generateContractNumber(branch, new Date());
  await Contract.create({
    ...num, contractPurpose: "initial", tenantId: tenant._id, applicationId: res._id,
    reservationId: res._id, stayId: stay._id, roomId: roomA._id, branch,
    propertyName: "L", propertyAddress: "x", roomNumber: "QA1", roomType: "quadruple-sharing",
    leaseType: "long_term", approvedMonthlyRate: 5400, securityDepositAmount: 1000,
    leaseStartDate: MOVE_IN, leaseEndDate: LEASE_END, leaseDurationMonths: 12,
    status: "active", isCurrent: true,
    statusHistory: [{ status: "active", changedBy: actorId, reason: "s" }],
    createdBy: actorId, updatedBy: actorId,
  });
  return { tenant, res, roomA, roomB, actorId };
}

/** Schedule for TODAY, then back-date the record to simulate "scheduled N days ago". */
async function scheduleThenBackdate({ res, roomB, actorId, daysAgo }) {
  const today = new Date();
  today.setHours(9, 0, 0, 0);
  const { scheduledTransfer } = await scheduleRoomTransfer({
    reservationId: res._id,
    payload: {
      confirm: true, targetRoomId: String(roomB._id),
      targetBedId: "qb-b1",
      effectiveTransferDate: today.toISOString(),
      effectiveTransferTimeMinutes: 540,
      reason: "delayed-completion test",
    },
    actorId: actorId,
  });
  const back = new Date();
  back.setDate(back.getDate() - daysAgo);
  back.setHours(0, 0, 0, 0);
  // Back-date the effective date (as if scheduled `daysAgo` ago and only now
  // being completed). Also back-date the prepared Addendum draft + its
  // scheduleHistory[0] entry so the "originally scheduled date" the test reads
  // truly precedes today.
  await ScheduledRoomTransfer.updateOne(
    { _id: scheduledTransfer._id },
    {
      $set: {
        effectiveTransferDate: back,
        "scheduleHistory.0.newDate": back,
      },
    },
  );
  if (scheduledTransfer.addendumContractId) {
    await Contract.updateOne(
      { _id: scheduledTransfer.addendumContractId },
      { $set: { amendmentEffectiveDate: back } },
    );
  }
  const originalDate = back;
  return { schedId: scheduledTransfer._id, originalDate };
}

let mongo;
beforeAll(async () => {
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  await mongoose.connect(mongo.getUri(), { dbName: "sched_delayed_completion" });
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
    Bill.deleteMany({}), BusinessSettings.deleteMany({}), Payment.deleteMany({}),
    UtilityReading.deleteMany({}), UtilityPeriod.deleteMany({}),
    UtilityFinalization.deleteMany({}), ScheduledRoomTransfer.deleteMany({}),
  ]);
  mockGenerate.mockClear();
});

describe("rescheduleRoomTransfer — no office-hours restriction", () => {
  test("reschedule to a FUTURE date + any time (e.g. 21:00 on a weekend) is accepted and appends schedule history", async () => {
    const { res, roomB, actorId } = await seed();
    const today = new Date(); today.setHours(9, 0, 0, 0);
    await scheduleRoomTransfer({
      reservationId: res._id,
      payload: {
        confirm: true, targetRoomId: String(roomB._id), targetBedId: "qb-b1",
        effectiveTransferDate: today.toISOString(), effectiveTransferTimeMinutes: 540,
        reason: "reschedule test",
      },
      actorId,
    });
    const future = new Date(); future.setDate(future.getDate() + 11); future.setHours(0, 0, 0, 0);
    const { scheduledTransfer } = await rescheduleRoomTransfer({
      reservationId: res._id,
      payload: { effectiveTransferDate: future.toISOString(), effectiveTransferTimeMinutes: 21 * 60, reason: "tenant asked" },
      actorId,
    });
    expect(scheduledTransfer.effectiveTransferTimeMinutes).toBe(21 * 60);
    const hist = scheduledTransfer.scheduleHistory.at(-1);
    expect(hist.kind).toBe("rescheduled");
  });

  test("reschedule to a PAST date is still rejected (PAST_TRANSFER_DATE)", async () => {
    const { res, roomB, actorId } = await seed();
    const today = new Date(); today.setHours(9, 0, 0, 0);
    await scheduleRoomTransfer({
      reservationId: res._id,
      payload: {
        confirm: true, targetRoomId: String(roomB._id), targetBedId: "qb-b1",
        effectiveTransferDate: today.toISOString(), effectiveTransferTimeMinutes: 540,
        reason: "reschedule past test",
      },
      actorId,
    });
    const past = new Date(); past.setDate(past.getDate() - 3); past.setHours(0, 0, 0, 0);
    await expect(rescheduleRoomTransfer({
      reservationId: res._id,
      payload: { effectiveTransferDate: past.toISOString(), effectiveTransferTimeMinutes: 10 * 60 },
      actorId,
    })).rejects.toMatchObject({ code: "PAST_TRANSFER_DATE" });
  });
});

describe("completeRoomTransfer — delayed completion settles as of TODAY", () => {
  test("delayed completion: unpaid transfer_settlement Bill is (re)created/reshaped as of today; NOT the stale scheduled date", async () => {
    const { res, roomB, actorId } = await seed();
    const { schedId } = await scheduleThenBackdate({ res, roomB, actorId, daysAgo: 20 });

    // No Bill was created at scheduling time (round-2 decision).
    expect(await Bill.findOne({ reservationId: res._id, billType: "transfer_settlement" })).toBeNull();

    // Complete now -> awaiting_settlement with a Bill sized as of TODAY.
    const r1 = await completeRoomTransfer({ reservationId: res._id, payload: {}, actorId });
    expect(r1.outcome).toBe("awaiting_settlement");
    expect(r1.reason).toBe("TRANSFER_BALANCE_UNPAID");
    expect(r1.bill).toBeTruthy();

    const bill = await Bill.findById(r1.bill._id).lean();
    expect(bill.billType).toBe("transfer_settlement");
    // billingMonth is TODAY (the actual completion), not 20 days ago.
    const { formatManilaDate } = await import("../utils/dateUtils.js");
    expect(formatManilaDate(bill.billingMonth, "YYYY-MM-DD")).toBe(formatManilaDate(new Date(), "YYYY-MM-DD"));
    expect(Number(bill.totalAmount)).toBeGreaterThan(0);
    // Still fully unpaid.
    expect(Number(bill.paidAmount || 0)).toBe(0);

    // No cutover happened.
    const stay = await Stay.findOne({ reservationId: res._id }).lean();
    expect(String(stay.roomId)).toBe(String((await Reservation.findById(res._id).lean()).roomId));
    const schedAfter = await ScheduledRoomTransfer.findById(schedId).lean();
    expect(schedAfter.status).toBe("action_required");
    expect(schedAfter.executedAt).toBeFalsy();
  });

  test("delayed completion, then settle in full -> completes; executedAt is TODAY; scheduleHistory keeps the ORIGINAL scheduled date", async () => {
    const { res, roomB, actorId } = await seed();
    const { schedId, originalDate } = await scheduleThenBackdate({ res, roomB, actorId, daysAgo: 15 });
    const { formatManilaDate } = await import("../utils/dateUtils.js");
    const originalDay = formatManilaDate(originalDate, "YYYY-MM-DD");

    // 1st completion -> awaiting settlement, Bill created.
    const r1 = await completeRoomTransfer({ reservationId: res._id, payload: {}, actorId });
    expect(r1.outcome).toBe("awaiting_settlement");
    const billId = r1.bill._id;

    // Pay it in full via the canonical path.
    const billDoc = await Bill.findById(billId);
    await applyBillPayment({
      bill: billDoc, amount: Number(billDoc.totalAmount), method: "offline_cash",
      source: "admin-manual", now: new Date(),
    });

    // 2nd completion -> executed.
    const r2 = await completeRoomTransfer({ reservationId: res._id, payload: {}, actorId });
    expect(r2.outcome).toBe("executed");

    const sched = await ScheduledRoomTransfer.findById(schedId).lean();
    expect(sched.status).toBe("executed");
    // executedAt / cutoverAt land on the ACTUAL completion day (today).
    expect(formatManilaDate(sched.executedAt, "YYYY-MM-DD")).toBe(formatManilaDate(new Date(), "YYYY-MM-DD"));
    expect(formatManilaDate(sched.executedSettlement.cutoverAt, "YYYY-MM-DD")).toBe(formatManilaDate(new Date(), "YYYY-MM-DD"));

    // scheduleHistory[0] STILL records the original scheduled date — never mutated.
    expect(Array.isArray(sched.scheduleHistory)).toBe(true);
    expect(sched.scheduleHistory.length).toBeGreaterThanOrEqual(1);
    expect(formatManilaDate(sched.scheduleHistory[0].newDate, "YYYY-MM-DD")).toBe(originalDay);
    expect(sched.scheduleHistory[0].kind).toBe("scheduled");

    // The serialized view exposes the schedule history unchanged.
    const viewed = await serializeScheduledRoomTransfer(await ScheduledRoomTransfer.findById(schedId));
    expect(viewed.scheduleHistory[0].kind).toBe("scheduled");
    expect(formatManilaDate(viewed.scheduleHistory[0].newDate, "YYYY-MM-DD")).toBe(originalDay);

    // Physical cutover happened.
    const stay = await Stay.findOne({ reservationId: res._id }).lean();
    expect(String(stay.roomId)).toBe(String(roomB._id));
  });

  test("delayed completion after a PARTIAL payment whose recompute is higher -> ADDITIONAL_BALANCE_DUE, no cutover, paid Bill NOT silently mutated", async () => {
    const { res, roomB, actorId } = await seed();
    const { schedId } = await scheduleThenBackdate({ res, roomB, actorId, daysAgo: 10 });

    // 1st completion -> Bill created (awaiting settlement).
    const r1 = await completeRoomTransfer({ reservationId: res._id, payload: {}, actorId });
    expect(r1.outcome).toBe("awaiting_settlement");
    const billId = r1.bill._id;
    const billBefore = await Bill.findById(billId).lean();
    const originalTotal = Number(billBefore.totalAmount);
    const originalCharges = { ...billBefore.charges };

    // Pay a SMALL amount — below the rent component — so the payment ledger's
    // deposit-funding (allocation: rent/util first, then deposit) funds NOTHING
    // and does NOT raise securityDepositHeld. The Bill now carries a real
    // (partial) payment but no deposit-settlement ledger entry.
    const smallPayment = Math.max(1, round(Number(originalCharges.rent || 0) / 2) || 1);
    const billDoc = await Bill.findById(billId);
    await applyBillPayment({
      bill: billDoc, amount: smallPayment, method: "offline_cash",
      source: "admin-manual", now: new Date(),
    });

    // Now the recompute genuinely gets HIGHER: drop securityDepositHeld to 0 so
    // the additional-deposit-due grows. Because no deposit component was funded,
    // there is no depositHeldOverride to mask this on the re-attempt.
    await Reservation.updateOne({ _id: res._id }, { $set: { securityDepositHeld: 0 } });

    // 2nd completion -> the recomputed total (now includes a full destination
    // deposit) exceeds the partially-paid Bill total.
    const r2 = await completeRoomTransfer({ reservationId: res._id, payload: {}, actorId });
    expect(r2.outcome).toBe("action_required");
    expect(r2.reason).toBe("ADDITIONAL_BALANCE_DUE");

    // No cutover.
    const stay = await Stay.findOne({ reservationId: res._id }).lean();
    expect(String(stay.roomId)).not.toBe(String(roomB._id));
    const sched = await ScheduledRoomTransfer.findById(schedId).lean();
    expect(sched.status).toBe("action_required");
    expect(sched.executedAt).toBeFalsy();

    // The PAID Bill's charges were NOT silently rewritten (a payment is present).
    const billAfter = await Bill.findById(billId).lean();
    expect(Number(billAfter.paidAmount)).toBeGreaterThan(0);
    expect(Number(billAfter.totalAmount)).toBe(originalTotal);
    expect(billAfter.charges.rent).toBe(originalCharges.rent);
    expect(billAfter.charges.securityDeposit).toBe(originalCharges.securityDeposit);
  });
});

describe("Addendum effective date on LATE completion (audit item 3)", () => {
  test("successful delayed completion aligns the current Contract's amendmentEffectiveDate to the ACTUAL cutover day, not the scheduled date", async () => {
    const { res, roomB, actorId } = await seed();
    const { schedId, originalDate } = await scheduleThenBackdate({ res, roomB, actorId, daysAgo: 18 });
    const { formatManilaDate } = await import("../utils/dateUtils.js");
    const originalDay = formatManilaDate(originalDate, "YYYY-MM-DD");
    const todayDay = formatManilaDate(new Date(), "YYYY-MM-DD");
    expect(originalDay).not.toBe(todayDay);

    // 1st completion -> Bill; settle it; 2nd -> executed.
    const r1 = await completeRoomTransfer({ reservationId: res._id, payload: {}, actorId });
    expect(r1.outcome).toBe("awaiting_settlement");
    const billDoc = await Bill.findById(r1.bill._id);
    await applyBillPayment({
      bill: billDoc, amount: Number(billDoc.totalAmount), method: "offline_cash",
      source: "admin-manual", now: new Date(),
    });
    const r2 = await completeRoomTransfer({ reservationId: res._id, payload: {}, actorId });
    expect(r2.outcome).toBe("executed");

    // The tenant's CURRENT Contract (the activated room-transfer successor) must
    // carry amendmentEffectiveDate = the ACTUAL cutover day.
    const current = await Contract.findOne({ reservationId: res._id, isCurrent: true }).lean();
    expect(current).toBeTruthy();
    expect(["amendment", "replacement"]).toContain(current.contractPurpose);
    expect(formatManilaDate(current.amendmentEffectiveDate, "YYYY-MM-DD")).toBe(todayDay);
    expect(formatManilaDate(current.amendmentEffectiveDate, "YYYY-MM-DD")).not.toBe(originalDay);

    // The schedule history still records the ORIGINAL scheduled date — the
    // planning record and the contract date do not silently disagree; each is
    // authoritative for its own purpose.
    const sched = await ScheduledRoomTransfer.findById(schedId).lean();
    expect(formatManilaDate(sched.scheduleHistory[0].newDate, "YYYY-MM-DD")).toBe(originalDay);
  });

  test("if the Addendum draft was already ACKNOWLEDGED for the scheduled date, a later completion is BLOCKED (ADDENDUM_EFFECTIVE_DATE_LOCKED) — never silently re-dated", async () => {
    const { res, roomB, actorId } = await seed();
    const { schedId } = await scheduleThenBackdate({ res, roomB, actorId, daysAgo: 12 });

    // Simulate the tenant acknowledging the prepared Addendum draft (bound to
    // the scheduled date) BEFORE the transfer is completed.
    const { Contract, ContractAcknowledgement } = await import("../models/index.js");
    const draft = await Contract.findOne({
      reservationId: res._id,
      contractPurpose: { $in: ["amendment", "replacement"] },
      isCurrent: { $ne: true },
    }).lean();
    expect(draft).toBeTruthy();
    await ContractAcknowledgement.create({
      contractId: draft._id,
      tenantId: (await Reservation.findById(res._id).lean()).userId,
      acknowledgedAt: new Date(),
      documentVersion: 1,
      documentFileHash: `ack-${draft._id}`,
    });

    // 1st completion -> Bill; settle in full.
    const r1 = await completeRoomTransfer({ reservationId: res._id, payload: {}, actorId });
    expect(r1.outcome).toBe("awaiting_settlement");
    const billDoc = await Bill.findById(r1.bill._id);
    await applyBillPayment({
      bill: billDoc, amount: Number(billDoc.totalAmount), method: "offline_cash",
      source: "admin-manual", now: new Date(),
    });

    // 2nd completion -> blocked: the Addendum is locked to the scheduled date.
    const r2 = await completeRoomTransfer({ reservationId: res._id, payload: {}, actorId });
    expect(r2.outcome).toBe("action_required");
    expect(r2.reason).toBe("ADDENDUM_EFFECTIVE_DATE_LOCKED");

    // No cutover; the acknowledged document was NOT re-dated.
    const stay = await Stay.findOne({ reservationId: res._id }).lean();
    expect(String(stay.roomId)).not.toBe(String(roomB._id));
    const sched = await ScheduledRoomTransfer.findById(schedId).lean();
    expect(sched.status).toBe("action_required");
    const draftAfter = await Contract.findById(draft._id).lean();
    expect(draftAfter.amendmentEffectiveDate.toISOString()).toBe(draft.amendmentEffectiveDate.toISOString());
  });
});
