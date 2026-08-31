/**
 * ============================================================================
 * PENALTY CALCULATOR SERVICE
 * ============================================================================
 *
 * Unified penalty calculation service for overdue bills.
 *
 * Plan 4 & Grace Period decisions:
 *   D2 — Penalty cap uses contractRentAtMoveIn (contract rate locked at move-in),
 *         not the current room charge (which may have changed).
 *   Grace Period — Configurable grace period (default 1 day). Penalties begin
 *         accruing after the grace period has elapsed.
 */

import dayjs from "dayjs";
import { diffManilaDays } from "../../utils/dateUtils.js";
import {
  getPenaltyRatePerDay,
  getLatePaymentGraceDays,
  resolvePenaltyRatePerDay,
  resolveLatePaymentGraceDays,
} from "../../utils/businessSettings.js";

/**
 * Compute the penalty amount for a single overdue bill.
 */
export async function computePenalty(bill, settings = null, now = dayjs()) {
  const [configuredRate, configuredGraceDays] = settings
    ? [settings.penaltyRatePerDay, settings.latePaymentGraceDays]
    : await Promise.all([
        getPenaltyRatePerDay(),
        getLatePaymentGraceDays(),
      ]);

  // Compare calendar dates only (Asia/Manila billing day boundaries) —
  // using diffManilaDays ensures accurate day-difference calculation regardless of server timezone.
  const daysLate = diffManilaDays(now, bill.dueDate);

  if (!Number.isFinite(daysLate) || daysLate <= 0) {
    return {
      penalty: 0,
      daysLate: 0,
      billableDays: 0,
      graceDays: configuredGraceDays ?? 1,
      isWithinGracePeriod: false,
      ratePerDay: configuredRate,
      capped: false,
    };
  }

  const ratePerDay = resolvePenaltyRatePerDay(
    bill.penaltyDetails?.ratePerDay,
    configuredRate,
  );

  const graceDays = resolveLatePaymentGraceDays(
    bill.penaltyDetails?.graceDays,
    configuredGraceDays,
  );

  // Penalties accrue only after the grace period:
  // e.g. Due 10th with 1-day grace:
  // - 11th: daysLate = 1 <= 1 grace day => billableDays = 0, penalty = ₱0
  // - 12th: daysLate = 2 > 1 grace day => billableDays = 1, penalty = ₱50
  // - 13th: daysLate = 3 > 1 grace day => billableDays = 2, penalty = ₱100
  const billableDays = Math.max(0, daysLate - graceDays);
  const penalty = billableDays > 0 ? billableDays * ratePerDay : 0;

  return {
    penalty,
    daysLate,
    billableDays,
    graceDays,
    isWithinGracePeriod: daysLate > 0 && daysLate <= graceDays,
    ratePerDay,
    capped: false,
  };
}

/**
 * Fetch shared settings once and return a handle usable for multiple
 * computePenalty calls.
 */
export async function fetchPenaltySettings() {
  const [penaltyRatePerDay, latePaymentGraceDays] = await Promise.all([
    getPenaltyRatePerDay(),
    getLatePaymentGraceDays(),
  ]);
  return { penaltyRatePerDay, latePaymentGraceDays };
}
