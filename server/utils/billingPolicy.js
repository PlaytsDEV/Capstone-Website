import dayjs from "dayjs";

export const roundMoney = (value) => Math.round((Number(value) || 0) * 100) / 100;
export const UTILITY_CYCLE_DAY = 15;

export function sumBillCharges(charges = {}) {
  return roundMoney(
    (charges.rent || 0) +
    (charges.electricity || 0) +
    (charges.water || 0) +
    (charges.applianceFees || 0) +
    (charges.corkageFees || 0) +
    (charges.penalty || 0) -
    (charges.discount || 0),
  );
}

export function getBillRemainingAmount(billLike = {}) {
  return roundMoney(
    Math.max((billLike.totalAmount || 0) - (billLike.paidAmount || 0), 0),
  );
}

export function resolveBillStatus(billLike, now = new Date()) {
  if (billLike.status === "draft") return "draft";

  const remaining = getBillRemainingAmount(billLike);
  if (remaining <= 0) return "paid";

  if ((billLike.paidAmount || 0) > 0) {
    if (billLike.dueDate && new Date(billLike.dueDate) < now) {
      return "overdue";
    }
    return "partially-paid";
  }

  if (billLike.dueDate && new Date(billLike.dueDate) < now) {
    return "overdue";
  }

  return "pending";
}

export function syncBillAmounts(bill, { preserveStatus = false } = {}) {
  bill.grossAmount = sumBillCharges(bill.charges);
  bill.totalAmount = roundMoney(
    Math.max((bill.grossAmount || 0) - (bill.reservationCreditApplied || 0), 0),
  );
  bill.remainingAmount = getBillRemainingAmount(bill);

  if (!preserveStatus) {
    bill.status = resolveBillStatus(bill);
  }

  if (bill.status === "paid" && !bill.paymentDate) {
    bill.paymentDate = new Date();
  }

  if (bill.status !== "paid" && bill.paymentDate && bill.remainingAmount > 0) {
    bill.paymentDate = null;
  }

  return bill;
}

export function buildBillingCycle(checkInDate, cycleIndex = 0) {
  const start = dayjs(checkInDate).add(cycleIndex, "month");
  const end = start.add(1, "month");

  return {
    billingMonth: start.startOf("day").toDate(),
    billingCycleStart: start.startOf("day").toDate(),
    billingCycleEnd: end.startOf("day").toDate(),
    dueDate: end.startOf("day").toDate(),
  };
}

export function getNextUtilityCycleBoundary(dateLike, cycleDay = UTILITY_CYCLE_DAY) {
  const anchor = dayjs(dateLike).startOf("day");
  if (!anchor.isValid()) {
    return null;
  }

  const sameMonthBoundary = anchor.date(cycleDay).startOf("day");
  if (anchor.isBefore(sameMonthBoundary)) {
    return sameMonthBoundary.toDate();
  }

  return sameMonthBoundary.add(1, "month").startOf("day").toDate();
}

export function getPreviousUtilityCycleBoundary(dateLike, cycleDay = UTILITY_CYCLE_DAY) {
  const anchor = dayjs(dateLike).startOf("day");
  if (!anchor.isValid()) {
    return null;
  }

  const sameMonthBoundary = anchor.date(cycleDay).startOf("day");
  if (anchor.isSame(sameMonthBoundary) || anchor.isAfter(sameMonthBoundary)) {
    return sameMonthBoundary.toDate();
  }

  return sameMonthBoundary.subtract(1, "month").startOf("day").toDate();
}

export function getUtilityTargetCloseDate(startDate, cycleDay = UTILITY_CYCLE_DAY) {
  return getNextUtilityCycleBoundary(startDate, cycleDay);
}

export function isSameUtilityCycleBoundary(dateA, dateB) {
  if (!dateA || !dateB) return false;
  const left = dayjs(dateA).startOf("day");
  const right = dayjs(dateB).startOf("day");
  if (!left.isValid() || !right.isValid()) return false;
  return left.isSame(right);
}

export function resolveUtilityAutoOpenStartDate({
  anchorDate,
  previousPeriodEndDate = null,
  cycleDay = UTILITY_CYCLE_DAY,
} = {}) {
  if (previousPeriodEndDate) {
    const normalizedPreviousEnd = dayjs(previousPeriodEndDate).startOf("day");
    if (normalizedPreviousEnd.isValid()) {
      return normalizedPreviousEnd.toDate();
    }
  }

  return getPreviousUtilityCycleBoundary(anchorDate, cycleDay);
}

export function getUtilityCycleFromPeriod(periodLike = {}) {
  const cycleStart = periodLike?.startDate ? dayjs(periodLike.startDate).startOf("day").toDate() : null;
  const cycleEnd = periodLike?.endDate ? dayjs(periodLike.endDate).startOf("day").toDate() : null;
  const readingDate = cycleEnd;

  return {
    utilityCycleStart: cycleStart,
    utilityCycleEnd: cycleEnd,
    utilityReadingDate: readingDate,
  };
}

export function getNextWorkingDay(date, { includeSameDay = false } = {}) {
  let cursor = dayjs(date).startOf("day");
  if (!includeSameDay) {
    cursor = cursor.add(1, "day");
  }

  while (cursor.day() === 0 || cursor.day() === 6) {
    cursor = cursor.add(1, "day");
  }

  return cursor.toDate();
}

export function getUtilityIssueDate({ readingDate, finalizedAt = new Date() } = {}) {
  const finalizedDay = dayjs(finalizedAt).startOf("day");
  const earliestIssueDay = readingDate
    ? dayjs(readingDate).startOf("day").add(1, "day")
    : finalizedDay;
  const baseDay = finalizedDay.isAfter(earliestIssueDay) ? finalizedDay : earliestIssueDay;

  return getNextWorkingDay(baseDay.toDate(), { includeSameDay: true });
}

export function getUtilityDueDate(issueDate) {
  return dayjs(issueDate).startOf("day").add(7, "day").toDate();
}

export function getReservationCreditAvailable(reservation) {
  if (!reservation) return 0;
  if (reservation.paymentStatus !== "paid") return 0;
  if (reservation.reservationCreditConsumedAt || reservation.reservationCreditAppliedBillId) return 0;
  return roundMoney(reservation.reservationFeeAmount || 0);
}
