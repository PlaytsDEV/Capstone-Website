import dayjs from "dayjs";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const cents = (value) => Math.round(money(value) * 100);
const fromCents = (value) => value / 100;

export function calculateStructuredInitialPayment({
  advanceRent = 0,
  securityDeposit = 0,
  approvedInitialCharges = 0,
  reservationFeeCredit = 0,
} = {}) {
  const values = [advanceRent, securityDeposit, approvedInitialCharges, reservationFeeCredit];
  if (values.some((value) => !Number.isFinite(Number(value)) || Number(value) < 0)) {
    const error = new Error("Initial-payment values must be non-negative amounts.");
    error.code = "INITIAL_PAYMENT_VALUES_INVALID";
    throw error;
  }
  const grossCents = cents(advanceRent) + cents(securityDeposit) + cents(approvedInitialCharges);
  const creditCents = Math.min(cents(reservationFeeCredit), grossCents);
  return {
    advanceRent: fromCents(cents(advanceRent)),
    securityDeposit: fromCents(cents(securityDeposit)),
    approvedInitialCharges: fromCents(cents(approvedInitialCharges)),
    reservationFeeCredit: fromCents(creditCents),
    grossInitialAmount: fromCents(grossCents),
    initialPaymentTotal: fromCents(grossCents - creditCents),
  };
}

export function resolveVerifiedReservationFeeCredit(payment, maximumCredit) {
  if (!payment || !["confirmed", "paid"].includes(payment.status) || payment.method !== "paymongo") return 0;
  return money(Math.min(Number(payment.paidAmount ?? payment.amount ?? 0), Number(maximumCredit || 0)));
}

export function buildStructuredPricingSnapshot({ reservation, room, approvedBy = null, approvedAt = new Date() } = {}) {
  const regularMonthlyRate = money(room?.monthlyPrice ?? room?.price ?? reservation?.monthlyRent);
  const finalMonthlyRate = money(reservation?.monthlyRent ?? regularMonthlyRate);
  const leaseDurationMonths = Number(reservation?.leaseDuration || 0);
  if (
    regularMonthlyRate <= 0 ||
    finalMonthlyRate <= 0 ||
    leaseDurationMonths < 1 ||
    leaseDurationMonths > 12 ||
    !room?._id ||
    !room?.branch
  ) {
    const error = new Error("Approved monthly pricing is incomplete.");
    error.code = "PRICING_SNAPSHOT_INCOMPLETE";
    throw error;
  }
  const discountAmount = money(Math.max(regularMonthlyRate - finalMonthlyRate, 0));
  const discountPercentage = regularMonthlyRate > 0 ? money((discountAmount / regularMonthlyRate) * 100) : 0;
  const reservationFeeAmount = money(reservation?.reservationFeeAmount || 0);
  return {
    regularMonthlyRate,
    discountPercentage,
    discountAmount,
    finalMonthlyRate,
    reservationFeeAmount,
    advanceRentAmount: finalMonthlyRate,
    securityDepositAmount: finalMonthlyRate,
    approvedInitialCharges: 0,
    roomType: room?.type || reservation?.preferredRoomType || "",
    leaseType: leaseDurationMonths >= 6 ? "long" : "short",
    leaseDurationMonths,
    branchId: room?.branch || "",
    roomId: room?._id || reservation?.roomId || null,
    selectedBed: reservation?.selectedBed || null,
    rateEffectiveDate: approvedAt,
    promotionName: null,
    customRateReason: null,
    approvedAt,
    approvedBy,
    snapshotVersion: 1,
  };
}

export function buildRollingRentalPeriod(actualMoveInDate, cycleIndex = 0) {
  const anchor = dayjs(actualMoveInDate).startOf("day");
  if (!anchor.isValid() || cycleIndex < 0) {
    const error = new Error("A valid move-in date and cycle index are required.");
    error.code = "RENTAL_PERIOD_INVALID";
    throw error;
  }
  const start = anchor.add(cycleIndex, "month");
  const endExclusive = anchor.add(cycleIndex + 1, "month");
  return {
    coverageStart: start.toDate(),
    coverageEndExclusive: endExclusive.toDate(),
    displayEnd: endExclusive.subtract(1, "day").toDate(),
    dueDate: start.toDate(),
    cycleIndex,
  };
}

export function resolveVisibleStructuredRentPeriod(actualMoveInDate, referenceDate = new Date()) {
  const reference = dayjs(referenceDate).startOf("day");
  const anchor = dayjs(actualMoveInDate).startOf("day");
  if (!anchor.isValid() || !reference.isValid()) return null;
  let cycleIndex = 1;
  let period = buildRollingRentalPeriod(anchor.toDate(), cycleIndex);
  let generationDate = dayjs(period.coverageStart).subtract(5, "day").toDate();
  if (reference.isBefore(dayjs(generationDate).startOf("day"))) return null;
  while (true) {
    const next = buildRollingRentalPeriod(anchor.toDate(), cycleIndex + 1);
    const nextGeneration = dayjs(next.coverageStart).subtract(5, "day");
    if (reference.isBefore(nextGeneration.startOf("day"))) break;
    cycleIndex += 1;
    period = next;
    generationDate = nextGeneration.toDate();
  }
  return { ...period, generationDate };
}
