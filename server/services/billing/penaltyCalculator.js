/**
 * ============================================================================
 * PENALTY CALCULATOR SERVICE
 * ============================================================================
 *
 * Unified penalty calculation service for overdue bills.
 */

import dayjs from "dayjs";
import { diffManilaDays } from "../../utils/dateUtils.js";
import {
  getPenaltyRatePerDay,
  getMaxPenaltyCapPercent,
  resolvePenaltyRatePerDay,
} from "../../utils/businessSettings.js";

/**
 * Compute the penalty amount for a single overdue bill.
 */
export async function computePenalty(bill, settings = null, now = dayjs()) {
  const [configuredRate, maxCapPercent] = settings
    ? [settings.penaltyRatePerDay, settings.maxCapPercent]
    : await Promise.all([getPenaltyRatePerDay(), getMaxPenaltyCapPercent()]);

  // Compare calendar dates only (Asia/Manila billing day boundaries) —
  // using diffManilaDays ensures accurate day-difference calculation regardless of server timezone.
  const daysLate = diffManilaDays(now, bill.dueDate);

  if (!Number.isFinite(daysLate) || daysLate <= 0) {
    return { penalty: 0, daysLate: 0, ratePerDay: configuredRate, capped: false };
  }

  const ratePerDay = resolvePenaltyRatePerDay(
    bill.penaltyDetails?.ratePerDay,
    configuredRate,
  );

  // First day overdue is a grace day (no penalty). Penalty accrues starting
  // the second day late, at ratePerDay per billable day.
  const billableDays = Math.max(0, daysLate - 1);
  const rawPenalty = billableDays * ratePerDay;
  const rentBase = bill.charges?.rent || 0;
  const cap = rentBase > 0 ? (rentBase * maxCapPercent) / 100 : Infinity;
  const penalty = billableDays > 0 ? Math.min(rawPenalty, cap) : 0;

  return {
    penalty,
    daysLate,
    ratePerDay,
    capped: penalty < rawPenalty,
  };
}

/**
 * Fetch shared settings once and return a handle usable for multiple
 * computePenalty calls.
 */
export async function fetchPenaltySettings() {
  const [penaltyRatePerDay, maxCapPercent] = await Promise.all([
    getPenaltyRatePerDay(),
    getMaxPenaltyCapPercent(),
  ]);
  return { penaltyRatePerDay, maxCapPercent };
}
