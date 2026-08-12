/**
 * ============================================================================
 * PENALTY CALCULATOR SERVICE
 * ============================================================================
 *
 * Unified penalty calculation service for overdue bills.
 *
 * Plan 4 decisions applied:
 *   D2 — Penalty cap uses contractRentAtMoveIn (contract rate locked at move-in),
 *         not the current room charge (which may have changed).
 *   D4 — No grace period. Penalties start accumulating immediately on Day 1 past due.
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

  // Plan 4 (D4): No grace period — penalties start on Day 1 past due.
  // Every calendar day past the dueDate is a billable day.
  const billableDays = daysLate;
  const rawPenalty = billableDays * ratePerDay;

  // Plan 4 (D2): Use contractRentAtMoveIn (the rent rate locked at the tenant's
  // move-in date) as the base for the cap ceiling. Falls back to charges.rent
  // for bills that pre-date this field being populated.
  const rentBase =
    bill.contractRentAtMoveIn ||
    bill.penaltyDetails?.contractRentAtMoveIn ||
    bill.charges?.rent ||
    0;
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
