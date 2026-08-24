import dayjs from "dayjs";
import { resolveAuthoritativeLeasePricing } from "./contractPricingResolver.js";

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

export function buildStructuredPricingSnapshot({
  reservation,
  room,
  approvedBy = null,
  approvedAt = new Date(),
  businessSettings = {},
} = {}) {
  const leaseDurationMonths = Number(reservation?.leaseDuration || 0);

  if (!room?._id || !room?.branch) {
    const error = new Error("Approved monthly pricing is incomplete.");
    error.code = "PRICING_SNAPSHOT_INCOMPLETE";
    throw error;
  }

  // The server — not the stored flat reservation.monthlyRent, and never a
  // client-submitted rate — is authoritative for the final monthly rate.
  // This mirrors the same admin-configured BusinessSettings discount table
  // used to display room rates, so the approved snapshot cannot diverge from
  // what the applicant was shown / what the room listing advertises.
  let pricing;
  try {
    pricing = resolveAuthoritativeLeasePricing({
      room,
      roomType: room?.type || reservation?.preferredRoomType,
      branch: room?.branch,
      leaseDurationMonths,
      settings: businessSettings,
    });
  } catch (resolverError) {
    const error = new Error(
      resolverError.message || "Approved monthly pricing is incomplete.",
    );
    // Preserve the resolver's specific reason (e.g. LEASE_DURATION_INVALID,
    // ROOM_TYPE_UNSUPPORTED) when available; otherwise use the generic code
    // so the approval endpoint can still return a structured, non-500 error.
    error.code = resolverError.code || "PRICING_CONFIGURATION_INCOMPLETE";
    error.cause = resolverError;
    throw error;
  }

  const { regularMonthlyRate, discountPercentage, discountAmount, finalMonthlyRate } = pricing;
  const reservationFeeAmount = money(reservation?.reservationFeeAmount || 0);
  return {
    regularMonthlyRate: money(regularMonthlyRate),
    discountPercentage,
    discountAmount,
    finalMonthlyRate: money(finalMonthlyRate),
    reservationFeeAmount,
    advanceRentAmount: money(finalMonthlyRate),
    securityDepositAmount: money(finalMonthlyRate),
    approvedInitialCharges: 0,
    roomType: pricing.roomType || room?.type || reservation?.preferredRoomType || "",
    leaseType: pricing.isLongTerm ? "long" : "short",
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
  let generationDate = dayjs(period.coverageStart).subtract(14, "day").toDate();
  if (reference.isBefore(dayjs(generationDate).startOf("day"))) return null;
  while (true) {
    const next = buildRollingRentalPeriod(anchor.toDate(), cycleIndex + 1);
    const nextGeneration = dayjs(next.coverageStart).subtract(14, "day");
    if (reference.isBefore(nextGeneration.startOf("day"))) break;
    cycleIndex += 1;
    period = next;
    generationDate = nextGeneration.toDate();
  }
  return { ...period, generationDate };
}
