const amount = (value) => {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number * 100) / 100 : null;
};
// Structured reservations (financialWorkflowVersion === "structured-initial-payment-v1")
// never write the legacy Reservation.paymentStatus field — their reservation-fee
// settlement is tracked authoritatively in reservationFeePaymentStatus instead.
// Using the legacy field for a structured reservation would permanently read as
// unverified even after a real PayMongo settlement, since nothing ever sets it.
const isReservationFeePaymentVerified = ({
  financialWorkflowVersion,
  reservationFeePaymentStatus,
  reservationPaymentStatus,
}) =>
  financialWorkflowVersion === "structured-initial-payment-v1"
    ? reservationFeePaymentStatus === "verified"
    // Reservation.paymentStatus enum has "paid" and "paid_in_full" as
    // distinct values (models/Reservation.js) — "paid_in_full" is the
    // terminal fully-settled state a legacy reservation reaches, strictly
    // more complete than "partial" (already accepted below), so omitting
    // it here caused every fully-paid legacy reservation to be treated as
    // unverified for reservation-fee-credit purposes.
    : ["partial", "paid", "paid_in_full"].includes(reservationPaymentStatus);

export const buildInitialPaymentSummary = ({
  advanceRentAmount,
  securityDepositAmount,
  reservationFeeAmount,
  approvedReservationFeeCreditAmount,
  reservationPaymentStatus,
  financialWorkflowVersion = null,
  reservationFeePaymentStatus = null,
}) => {
  const advance = amount(advanceRentAmount);
  const deposit = amount(securityDepositAmount);
  const fee = amount(reservationFeeAmount);
  const approvedCredit = amount(approvedReservationFeeCreditAmount);
  if ([advance, deposit, fee, approvedCredit].includes(null)) {
    return {
      valid: false,
      code: "INITIAL_PAYMENT_CALCULATION_INVALID",
      errors: [{ code: "INITIAL_PAYMENT_CALCULATION_INVALID" }],
    };
  }
  const paymentVerified = isReservationFeePaymentVerified({
    financialWorkflowVersion,
    reservationFeePaymentStatus,
    reservationPaymentStatus,
  });
  const verifiedReservationFeePaid = paymentVerified ? fee : 0;
  const totalInitialCharges = Math.round((advance + deposit) * 100) / 100;
  const errors = [];
  if (!paymentVerified && approvedCredit > 0) errors.push({ code: "RESERVATION_FEE_PAYMENT_NOT_VERIFIED" });
  if (approvedCredit > verifiedReservationFeePaid) errors.push({ code: "RESERVATION_FEE_CREDIT_EXCEEDS_PAYMENT" });
  if (approvedCredit > totalInitialCharges) errors.push({ code: "RESERVATION_FEE_CREDIT_EXCEEDS_INITIAL_CHARGES" });
  const reservationFeeCreditApplied = Math.min(
    verifiedReservationFeePaid, approvedCredit, totalInitialCharges,
  );
  const remainingInitialAmountDue = Math.max(
    Math.round((totalInitialCharges - reservationFeeCreditApplied) * 100) / 100, 0,
  );
  return {
    valid: errors.length === 0,
    code: errors[0]?.code || "INITIAL_PAYMENT_VALID",
    errors,
    totalInitialCharges,
    verifiedReservationFeePaid,
    approvedReservationFeeCreditAmount: approvedCredit,
    reservationFeeCreditApplied,
    remainingInitialAmountDue,
    paymentVerified,
  };
};
