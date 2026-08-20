/**
 * ============================================================================
 * ROOM-TRANSFER RENT SETTLEMENT (pure calculation)
 * ============================================================================
 * Implements Lilycrest's confirmed room-transfer payment rule: when a tenant
 * changes rooms partway through an already-paid rental period, charge only
 * for the actual days spent in each accommodation. The unused prepaid value
 * of the old room becomes a credit against the prorated destination-room
 * amount for the remaining days of that SAME period — never a second full
 * month's rent for either room.
 *
 * Pure function — no DB access, no Contract/Reservation/Room/Bed mutation.
 * Callers are responsible for resolving the correct inputs (the current
 * rent-billing-cycle boundaries via billingPolicy.js's
 * resolveCurrentBillingCycle, and the Contract-approved rates — never a
 * mutable Room master price — for sourceApprovedRate/destinationApprovedRate).
 *
 * sourceDays + destinationDays always equals totalCoverageDays by
 * construction (both are derived from the same three dates), so there is
 * never a missing or double-counted day. unusedPrepaidCredit is defined as
 * the complement of sourceConsumedValue against applicablePrepaidRent
 * (subtraction, not an independently re-prorated value), so
 * sourceConsumedValue + unusedPrepaidCredit reconciles to
 * applicablePrepaidRent exactly, with zero rounding drift.
 * ============================================================================
 */
import { roundMoney } from "./billingPolicy.js";
import { diffManilaDays, toManilaStartOfDay } from "../../utils/dateUtils.js";

/**
 * @param {Object} params
 * @param {Date|string} params.periodStart - start of the current rent billing cycle
 * @param {Date|string} params.periodEnd - end of the current rent billing cycle (exclusive)
 * @param {Date|string} params.transferDate - the effective room-transfer date
 * @param {number} params.sourceApprovedRate - the old room's Contract-approved monthly rate
 * @param {number} params.destinationApprovedRate - the new room's Contract-approved monthly rate
 * @param {number} [params.applicablePrepaidRent] - the rent amount already paid/applicable for
 *   this period at the old rate; defaults to sourceApprovedRate (the tenant prepaid the full
 *   period at the old room's rate)
 * @returns {{
 *   totalCoverageDays: number, sourceDays: number, destinationDays: number,
 *   sourceConsumedValue: number, unusedPrepaidCredit: number,
 *   destinationProratedValue: number, settlementAmount: number,
 *   additionalAmountDue: number, excessCredit: number,
 * }}
 */
export function calculateRoomTransferRentSettlement({
  periodStart,
  periodEnd,
  transferDate,
  sourceApprovedRate,
  destinationApprovedRate,
  applicablePrepaidRent,
}) {
  const start = toManilaStartOfDay(periodStart);
  const end = toManilaStartOfDay(periodEnd);
  const transfer = toManilaStartOfDay(transferDate);

  const sourceRate = Number(sourceApprovedRate) || 0;
  const destinationRate = Number(destinationApprovedRate) || 0;
  const prepaidRent = Number.isFinite(Number(applicablePrepaidRent))
    ? Number(applicablePrepaidRent)
    : sourceRate;

  const totalCoverageDays = start && end ? diffManilaDays(end, start) : 0;

  if (!start || !end || !transfer || totalCoverageDays <= 0) {
    return {
      totalCoverageDays: 0,
      sourceDays: 0,
      destinationDays: 0,
      sourceConsumedValue: 0,
      unusedPrepaidCredit: roundMoney(prepaidRent),
      destinationProratedValue: 0,
      settlementAmount: roundMoney(-prepaidRent),
      additionalAmountDue: 0,
      excessCredit: roundMoney(prepaidRent),
    };
  }

  // Clamp so a transfer date outside the resolved period never produces a
  // negative day count or double-counts days beyond the period bounds.
  const sourceDays = Math.min(Math.max(diffManilaDays(transfer, start), 0), totalCoverageDays);
  const destinationDays = totalCoverageDays - sourceDays;

  const sourceConsumedValue = roundMoney((sourceRate / totalCoverageDays) * sourceDays);
  const unusedPrepaidCredit = roundMoney(prepaidRent - sourceConsumedValue);
  const destinationProratedValue = roundMoney((destinationRate / totalCoverageDays) * destinationDays);
  const settlementAmount = roundMoney(destinationProratedValue - unusedPrepaidCredit);

  return {
    totalCoverageDays,
    sourceDays,
    destinationDays,
    sourceConsumedValue,
    unusedPrepaidCredit,
    destinationProratedValue,
    settlementAmount,
    additionalAmountDue: settlementAmount > 0 ? settlementAmount : 0,
    excessCredit: settlementAmount < 0 ? roundMoney(-settlementAmount) : 0,
  };
}
