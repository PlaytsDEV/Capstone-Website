import dayjs from "dayjs";

/**
 * ============================================================================
 * OFFBOARDING FINANCIAL SETTLEMENT & DEPOSIT RECONCILIATION SERVICE
 * ============================================================================
 * Handles security deposit settlement calculations, key penalties, early vacancy
 * forfeiture checks, refund state machine transitions, and SLA alert tracking.
 */

export const KEY_NON_RETURN_PENALTY = 500;
export const REFUND_SLA_DAYS = 30;

/**
 * Calculates offboarding financial settlement breakdown.
 */
export function calculateOffboardingSettlement({
  leaseEndDate = null,
  moveOutDate = new Date(),
  securityDeposit = null,
  monthlyRent = 0,
  totalPrice = 0,
  outstandingBalance = 0,
  damageDeductions = 0,
  keyReturned = true,
  finalUtilityReading = 0,
} = {}) {
  const moveOutAt = moveOutDate ? new Date(moveOutDate) : new Date();
  const leaseEndAt = leaseEndDate ? new Date(leaseEndDate) : null;

  const isEarlyVacancy = Boolean(leaseEndAt && moveOutAt < leaseEndAt);
  // Use stored deposit first; fall back to formula for legacy records
  const securityDepositAmount = Number(securityDeposit || monthlyRent || totalPrice || 0);
  const outstandingBal = Math.max(0, Number(outstandingBalance || 0));
  const damageFees = Math.max(0, Number(damageDeductions || 0));
  const keyDeduction = keyReturned === false ? KEY_NON_RETURN_PENALTY : 0;
  const utilityReadingCharge = Math.max(0, Number(finalUtilityReading || 0));

  const totalDeductions = outstandingBal + damageFees + keyDeduction;

  if (isEarlyVacancy) {
    return {
      securityDeposit: securityDepositAmount,
      outstandingBalance: outstandingBal,
      damageDeductions: damageFees,
      keyDeduction,
      finalUtilityCharge: utilityReadingCharge,
      totalDeductions,
      netAmount: 0,
      isEarlyVacancy: true,
      depositForfeited: true,
      depositForfeitureReason: "early_vacancy",
      depositForfeitedAt: moveOutAt,
      depositRefundDeadline: null,
      depositRefundAmount: 0,
      depositRefundStatus: "forfeited",
      settlementType: "forfeited",
      settledAt: new Date(),
    };
  }

  const netAmount = Math.max(0, securityDepositAmount - totalDeductions);
  const refundDeadline = dayjs(moveOutAt).add(REFUND_SLA_DAYS, "day").toDate();

  let settlementType = "zero_balance";
  if (netAmount > 0) {
    settlementType = "refund";
  } else if (totalDeductions > securityDepositAmount) {
    settlementType = "payment_due";
  }

  return {
    securityDeposit: securityDepositAmount,
    outstandingBalance: outstandingBal,
    damageDeductions: damageFees,
    keyDeduction,
    finalUtilityCharge: utilityReadingCharge,
    totalDeductions,
    netAmount,
    isEarlyVacancy: false,
    depositForfeited: false,
    depositForfeitureReason: null,
    depositForfeitedAt: null,
    depositRefundDeadline: refundDeadline,
    depositRefundAmount: netAmount,
    depositRefundStatus: "pending",
    settlementType,
    settledAt: new Date(),
  };
}

/**
 * Validates deposit refund status state machine transitions.
 */
export function validateDepositRefundTransition(currentStatus = "pending", targetStatus) {
  const VALID_TRANSITIONS = {
    pending: ["approved", "processed", "forfeited"],
    approved: ["processed", "forfeited"],
    processed: [],
    forfeited: [],
  };

  const allowed = VALID_TRANSITIONS[currentStatus] || [];
  if (!allowed.includes(targetStatus)) {
    return {
      valid: false,
      error: `Cannot transition deposit refund status from '${currentStatus}' to '${targetStatus}'. Allowed target statuses: [${allowed.join(", ")}]`,
    };
  }

  return { valid: true };
}

/**
 * Evaluates deposit refund SLA deadline against reference date.
 */
export function evaluateDepositRefundSLA(reservation, referenceDate = new Date()) {
  const status = reservation?.depositRefundStatus || "pending";
  const deadline = reservation?.depositRefundDeadline
    ? new Date(reservation.depositRefundDeadline)
    : null;

  if (status === "processed" || status === "forfeited") {
    return {
      slaStatus: "completed",
      daysRemaining: null,
      isOverdue: false,
      message: `Deposit refund completed with status '${status}'`,
    };
  }

  if (!deadline) {
    return {
      slaStatus: "none",
      daysRemaining: null,
      isOverdue: false,
      message: "No refund deadline set",
    };
  }

  const ref = dayjs(referenceDate);
  const due = dayjs(deadline);
  const diffDays = due.diff(ref, "day");

  if (diffDays < 0) {
    return {
      slaStatus: "overdue",
      daysRemaining: diffDays,
      isOverdue: true,
      message: `Deposit refund is overdue by ${Math.abs(diffDays)} day(s)`,
    };
  }

  if (diffDays <= 5) {
    return {
      slaStatus: "warning",
      daysRemaining: diffDays,
      isOverdue: false,
      message: `Deposit refund deadline approaching in ${diffDays} day(s)`,
    };
  }

  return {
    slaStatus: "healthy",
    daysRemaining: diffDays,
    isOverdue: false,
    message: `Deposit refund on track (${diffDays} days remaining)`,
  };
}
