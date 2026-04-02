import { Bill, Reservation } from "../models/index.js";
import {
  buildBillingCycle,
  getReservationCreditAvailable,
  getUtilityCycleFromPeriod,
  getUtilityDueDate,
  getUtilityIssueDate,
  roundMoney,
  syncBillAmounts,
} from "./billingPolicy.js";

function getUtilityChargeField(utilityType) {
  return utilityType === "water" ? "water" : "electricity";
}

export async function getReservationBillingContextForUser(userId) {
  const reservation = await Reservation.findOne({
    userId,
    status: "checked-in",
    isArchived: { $ne: true },
  }).sort({ checkInDate: 1 });

  if (!reservation?.checkInDate) return null;

  const existingCount = await Bill.countDocuments({
    reservationId: reservation._id,
    isArchived: false,
  });

  return {
    reservation,
    existingCount,
    cycle: buildBillingCycle(reservation.checkInDate, existingCount),
    isFirstCycleBill: existingCount === 0,
    creditAvailable: getReservationCreditAvailable(reservation),
  };
}

export async function getReservationBillingContextForBill(bill) {
  if (!bill?.reservationId) return null;

  const reservation = await Reservation.findById(bill.reservationId);
  if (!reservation?.checkInDate) return null;

  const existingCount = await Bill.countDocuments({
    reservationId: reservation._id,
    isArchived: false,
    _id: { $ne: bill._id },
  });

  return {
    reservation,
    existingCount,
    cycle: buildBillingCycle(reservation.checkInDate, existingCount),
    isFirstCycleBill: existingCount === 0,
    creditAvailable: getReservationCreditAvailable(reservation),
  };
}

export async function upsertDraftBillsForUtility({
  period,
  room,
  tenantSummaries,
  utilityType,
}) {
  const chargeField = getUtilityChargeField(utilityType);
  const updatedSummaries = [];

  for (const summary of tenantSummaries || []) {
    const billingContext = await getReservationBillingContextForUser(summary.tenantId);
    const billingMonth = billingContext?.cycle?.billingMonth || period.startDate;
    const reservationId = billingContext?.reservation?._id || null;

    let bill = await Bill.findOne({
      userId: summary.tenantId,
      reservationId,
      billingMonth,
      isArchived: false,
    });

    if (bill && bill.status !== "draft") {
      const error = new Error(
        `Cannot sync ${utilityType} charges because one or more bills were already sent.`,
      );
      error.statusCode = 409;
      throw error;
    }

    if (!bill) {
      bill = new Bill({
        reservationId,
        userId: summary.tenantId,
        branch: room.branch,
        roomId: room._id,
        billingMonth,
        billingCycleStart: billingContext?.cycle?.billingCycleStart || period.startDate,
        billingCycleEnd: billingContext?.cycle?.billingCycleEnd || period.endDate || period.startDate,
        dueDate: null,
        isFirstCycleBill: !!billingContext?.isFirstCycleBill,
        charges: {
          electricity: 0,
          rent: 0,
          water: 0,
          applianceFees: 0,
          corkageFees: 0,
          penalty: 0,
          discount: 0,
        },
        grossAmount: 0,
        reservationCreditApplied: 0,
        totalAmount: 0,
        remainingAmount: 0,
        status: "draft",
      });
    }

    bill.charges[chargeField] = roundMoney(summary.billAmount || 0);
    syncBillAmounts(bill, { preserveStatus: true });
    await bill.save();

    updatedSummaries.push({
      ...summary,
      billId: bill._id,
    });
  }

  return updatedSummaries;
}

export async function getDraftBillsForSummaryBillIds(tenantSummaries = []) {
  const billIds = tenantSummaries.map((summary) => summary.billId).filter(Boolean);
  if (billIds.length === 0) return [];

  return Bill.find({
    _id: { $in: billIds },
    status: "draft",
    isArchived: false,
  }).populate("userId", "firstName lastName email");
}

export async function sendDraftUtilityBills({
  bills,
  period,
  result,
}) {
  const sentAt = new Date();
  const utilityCycle = getUtilityCycleFromPeriod(period);
  const issuedAt = getUtilityIssueDate({
    readingDate: utilityCycle.utilityReadingDate,
    finalizedAt: sentAt,
  });
  const dueDate = getUtilityDueDate(issuedAt);
  let sent = 0;

  for (const bill of bills) {
    const billingContext = bill.reservationId
      ? await getReservationBillingContextForBill(bill)
      : null;
    const reservationCreditApplied = Math.min(
      bill.grossAmount || bill.totalAmount || 0,
      billingContext?.creditAvailable || 0,
    );

    bill.reservationCreditApplied = reservationCreditApplied;
    bill.billingMonth = billingContext?.cycle?.billingMonth || bill.billingMonth || period.startDate;
    bill.billingCycleStart = billingContext?.cycle?.billingCycleStart || bill.billingCycleStart || period.startDate;
    bill.billingCycleEnd = billingContext?.cycle?.billingCycleEnd || bill.billingCycleEnd || period.endDate || period.startDate;
    bill.utilityCycleStart = utilityCycle.utilityCycleStart;
    bill.utilityCycleEnd = utilityCycle.utilityCycleEnd;
    bill.utilityReadingDate = utilityCycle.utilityReadingDate;
    bill.issuedAt = issuedAt;
    bill.dueDate = dueDate;
    bill.sentAt = sentAt;
    bill.status = "pending";
    syncBillAmounts(bill);
    await bill.save();

    if (billingContext?.reservation && reservationCreditApplied > 0) {
      billingContext.reservation.reservationCreditConsumedAt = sentAt;
      billingContext.reservation.reservationCreditAppliedBillId = bill._id;
      await billingContext.reservation.save();
    }

    const summary = (result?.tenantSummaries || []).find(
      (entry) => String(entry.billId) === String(bill._id),
    );
    if (summary) {
      summary.billId = bill._id;
    }

    sent += 1;
  }

  return { sent, issuedAt, dueDate, sentAt };
}
