/**
 * ============================================================================
 * DEPOSIT UTILITY — Frontend canonical formula (mirrors server/utils/depositUtils.js)
 * ============================================================================
 * Single source of truth for security deposit resolution on the client side.
 * All modals, calculators, and display components MUST use these helpers.
 *
 * Canonical formula:
 *   securityDeposit    = monthlyRent × 1
 *   advanceRent        = monthlyRent × 1
 *   grossTotal         = monthlyRent × 2
 *   netAmountDue       = grossTotal − reservationFeeAmount
 */

export const DEFAULT_RESERVATION_FEE = 2000;

/**
 * Resolves the security deposit for a reservation object received from the API.
 *
 * Priority:
 *   1. reservation.moveInCashOut.securityDeposit  ← locked at booking time
 *   2. reservation.finalSettlementSummary.securityDeposit
 *   3. Formula fallback: reservation.monthlyRent × 1
 *   4. reservation.totalPrice (legacy field)
 *   5. 0
 *
 * @param {object} reservation — reservation or paymentInfo object from API
 * @returns {number}
 */
export function resolveSecurityDeposit(reservation = {}) {
  const stored =
    reservation?.moveInCashOut?.securityDeposit ??
    reservation?.finalSettlementSummary?.securityDeposit;

  if (Number.isFinite(Number(stored)) && Number(stored) > 0) {
    return Number(stored);
  }

  // Formula fallback for legacy records
  const monthlyRent = reservation?.monthlyRent ?? reservation?.totalPrice ?? 0;
  return Number(monthlyRent) || 0;
}

/**
 * Resolves security deposit from a tenant modal paymentInfo block
 * (TenantsWorkspacePage shape: { securityDeposit, monthlyRent, moveInCashOut }).
 *
 * @param {object} paymentInfo
 * @param {number} [fallbackMonthlyRent]
 * @returns {number}
 */
export function resolveDepositFromPaymentInfo(paymentInfo = {}, fallbackMonthlyRent = 0) {
  const stored =
    paymentInfo?.securityDeposit ??
    paymentInfo?.moveInCashOut?.securityDeposit;

  if (Number.isFinite(Number(stored)) && Number(stored) > 0) {
    return Number(stored);
  }

  return Number(fallbackMonthlyRent) || 0;
}

/**
 * Computes the canonical move-in cash-out breakdown.
 * Use for previews and new booking calculators.
 *
 * @param {number} monthlyRent
 * @param {number} [reservationFeeAmount]
 */
export function computeMoveInCashOut(
  monthlyRent,
  reservationFeeAmount = DEFAULT_RESERVATION_FEE,
) {
  const monthly = Math.max(0, Number(monthlyRent) || 0);
  const fee = Math.max(0, Number(reservationFeeAmount) || DEFAULT_RESERVATION_FEE);
  const securityDeposit = monthly;
  const grossTotal = monthly + securityDeposit;
  const netAmountDue = Math.max(0, grossTotal - fee);

  return {
    monthlyAdvance: monthly,
    securityDeposit,
    grossTotal,
    reservationFeeDeductible: fee,
    netAmountDue,
  };
}
