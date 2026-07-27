/**
 * ============================================================================
 * PENALTY CALCULATOR SERVICE
 * ============================================================================
 *
 * Unified penalty calculation service for overdue bills.
 */

import dayjs from "dayjs";
import {
  getPenaltyRatePerDay,
  getMaxPenaltyCapPercent,
  resolvePenaltyRatePerDay,
} from "../../utils/businessSettings.js";

/**
 * Compute the penalty amount for a single overdue bill.
 */
export async function computePenalty(bill, settings = null, now = dayjs()) {
  const nowDayjs = dayjs.isDayjs(now) ? now : dayjs(now);

  const [configuredRate, maxCapPercent] = settings
    ? [settings.penaltyRatePerDay, settings.maxCapPercent]
    : await Promise.all([getPenaltyRatePerDay(), getMaxPenaltyCapPercent()]);

  const daysLate = nowDayjs.diff(dayjs(bill.dueDate), "day");

  if (!Number.isFinite(daysLate) || daysLate <= 0) {
    return { penalty: 0, daysLate: 0, ratePerDay: configuredRate, capped: false };
  }

  const ratePerDay = resolvePenaltyRatePerDay(
    bill.penaltyDetails?.ratePerDay,
    configuredRate,
  );

  const rawPenalty = daysLate * ratePerDay;
  const rentBase = bill.charges?.rent || 0;
  const cap = rentBase > 0 ? (rentBase * maxCapPercent) / 100 : Infinity;
  const penalty = Math.min(rawPenalty, cap);

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
