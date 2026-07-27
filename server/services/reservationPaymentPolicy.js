import { roundMoney } from "./billing/billingPolicy.js";

export const RESERVATION_PAYMENT_CURRENCY = "PHP";

export function resolveReservationInitialCharges(reservation = {}) {
  const approvedMonthlyRate = roundMoney(reservation.monthlyRent ?? reservation.totalPrice);
  const reservationFeeAmount = roundMoney(reservation.reservationFeeAmount);
  const advanceRent = approvedMonthlyRate;
  const securityDeposit = approvedMonthlyRate;
  const initialCharges = roundMoney(advanceRent + securityDeposit);
  const remainingInitialAmount = roundMoney(Math.max(0, initialCharges - reservationFeeAmount));
  return {
    approvedMonthlyRate,
    advanceRent,
    securityDeposit,
    reservationFeeAmount,
    initialCharges,
    remainingInitialAmount,
    currency: RESERVATION_PAYMENT_CURRENCY,
  };
}

export function getReservationCheckoutBlockers(reservation = {}) {
  const pricing = resolveReservationInitialCharges(reservation);
  const blockers = [];
  if (!reservation.applicationReviewedAt || !reservation.applicationReviewedBy) {
    blockers.push("APPLICATION_APPROVAL_MISSING");
  }
  if (!reservation.approvedForPaymentAt) blockers.push("PAYMENT_APPROVAL_MISSING");
  if (!(pricing.approvedMonthlyRate > 0)) blockers.push("PRICING_SNAPSHOT_MISSING");
  if (!(pricing.remainingInitialAmount > 0)) blockers.push("INITIAL_AMOUNT_NOT_DUE");
  return { blockers, pricing };
}
