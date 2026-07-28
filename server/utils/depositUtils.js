/**
 * ============================================================================
 * DEPOSIT UTILITY — Server-side canonical formula
 * ============================================================================
 * Single source of truth for security deposit resolution and move-in cash-out
 * computation. All controllers, services, and action handlers MUST use these
 * helpers instead of ad-hoc derivations from monthlyRent or totalPrice.
 *
 * Canonical formula (matches _helpers.js + ReservationPaymentStep.jsx):
 *   securityDeposit    = monthlyRent × 1
 *   advanceRent        = monthlyRent × 1
 *   grossTotal         = monthlyRent × 2
 *   netAmountDue       = grossTotal − reservationFeeAmount
 */

export const DEFAULT_RESERVATION_FEE = 2000;

/**
 * Resolves the security deposit for a reservation.
 *
 * Priority:
 *   1. reservation.moveInCashOut.securityDeposit  ← locked at booking time
 *   2. reservation.finalSettlementSummary.securityDeposit  ← persisted at move-out
 *   3. Formula fallback: reservation.monthlyRent × 1
 *   4. reservation.totalPrice (legacy field)
 *   5. 0
 *
 * @param {object} reservation — Mongoose document or plain object
 * @returns {number}
 */
export function resolveSecurityDeposit(reservation = {}) {
  const stored =
    reservation?.moveInCashOut?.securityDeposit ??
    reservation?.finalSettlementSummary?.securityDeposit;

  if (Number.isFinite(Number(stored)) && Number(stored) > 0) {
    return Number(stored);
  }

  // Formula fallback (for legacy records that pre-date moveInCashOut storage)
  const monthlyRent = reservation?.monthlyRent ?? reservation?.totalPrice ?? 0;
  return Number(monthlyRent) || 0;
}

/**
 * Computes the canonical move-in cash-out breakdown.
 * Use this for previews and new reservations (where no stored value exists yet).
 *
 * @param {number} monthlyRent
 * @param {number} [reservationFeeAmount]
 * @returns {{ monthlyAdvance, securityDeposit, grossTotal, reservationFeeDeductible, netAmountDue }}
 */
export function computeMoveInCashOut(
  monthlyRent,
  reservationFeeAmount = DEFAULT_RESERVATION_FEE,
) {
  const monthly = Math.max(0, Number(monthlyRent) || 0);
  const fee = Math.max(0, Number(reservationFeeAmount) || DEFAULT_RESERVATION_FEE);
  const securityDeposit = monthly; // 1× monthly
  const grossTotal = monthly + securityDeposit; // 2× monthly
  const netAmountDue = Math.max(0, grossTotal - fee);

  return {
    monthlyAdvance: monthly,
    securityDeposit,
    grossTotal,
    reservationFeeDeductible: fee,
    netAmountDue,
  };
}
