/**
 * ============================================================================
 * TRANSFER-DAY UTILITY FINALIZATION (electricity only)
 * ============================================================================
 *
 * Computes the transferring tenant's accrued SOURCE-ROOM electricity liability
 * from the current open period's baseline reading through a FRESH closing
 * reading entered during the admin Complete Transfer flow — using the SAME
 * canonical `computeBilling` engine, rate and sharing rules the normal period
 * close uses. There is NO second electricity formula.
 *
 * This is a READ-ONLY slice: it runs `computeBilling` over
 *   [openPeriod.startReading  ->  freshSourceClosingReading]
 * with the FULL historical participant set (co-occupants + the transferee,
 * the transferee bounded by a synthetic `moveOut` reading at the cutover) and
 * returns ONLY the transferee's `tenantSummary.billAmount`.
 *
 * WATER IS NOT FINALIZED HERE. `buildWaterOccupancyBilling`'s total
 * (`utilityPeriod.ratePerUnit` — a flat whole-cycle amount entered AT CLOSE)
 * and its `totalCoveredDays` denominator (grows with future occupants of the
 * still-open period) are unknowable at transfer time, so a transfer-day water
 * amount cannot be canonically finalized. Water is left to the normal period
 * close, where the Phase-4/5 room-scoped occupancy path already bills the
 * transferee for their `[periodStart, cutover]` days correctly.
 * ============================================================================
 */

import { UtilityPeriod, UtilityReading, Reservation } from "../../models/index.js";
import { computeBilling, sortReadings } from "./billingEngine.js";
import { branchSupportsSeparateUtilityBilling } from "../../config/branches.js";
import {
  buildTenantEventsForPeriod,
  isWaterBillableRoom,
} from "../../utils/utilityFlowRules.js";
import { BILLABLE_RESERVATION_STATUS_QUERY } from "../../utils/lifecycleNaming.js";

const round = (v) => Math.round((Number(v) || 0) * 100) / 100;

/**
 * @param {Object}   args
 * @param {Object}   args.reservation       the transferring tenant's reservation (lean or doc)
 * @param {Object}   args.sourceRoom        the tenant's ACTUAL current room (lean or doc)
 * @param {Date}     args.cutoverDate       the boundary timestamp for the transferee's
 *                                          `moveOut` reading (preview: the intended cutover
 *                                          moment; final: the transaction-local cutoverAt)
 * @param {number}   args.freshSourceClosingReading   kWh the admin entered/confirmed now
 * @param {import("mongoose").ClientSession} [args.session]
 *
 * @returns {Promise<{
 *   applicable: boolean,          // false => branch not sub-metered / no open period / no reading
 *   reason?: string,
 *   utilityPeriodId?: string,
 *   ratePerUnit?: number,
 *   baselineReading?: number,     // the open period's start reading (previous reading)
 *   closingReading?: number,      // = freshSourceClosingReading
 *   kwh?: number,                 // the transferee's share of consumed kWh
 *   amount?: number,              // the transferee's canonical electricity liability
 *   waterNote: string,            // ALWAYS present — informational, non-billed
 * }>}
 */
export async function computeTransfereeSourceElectricityLiability({
  reservation,
  sourceRoom,
  cutoverDate,
  freshSourceClosingReading,
  session = null,
}) {
  const branch = sourceRoom?.branch;
  const waterNote = buildWaterNote({ sourceRoom, cutoverDate });

  if (!branch || !branchSupportsSeparateUtilityBilling(branch, "electricity")) {
    // Guadalupe / fixed-rate — no separate electricity billing at all.
    return { applicable: false, reason: "branch_not_submetered", waterNote };
  }
  if (
    freshSourceClosingReading == null ||
    Number.isNaN(Number(freshSourceClosingReading))
  ) {
    return { applicable: false, reason: "no_fresh_closing_reading", waterNote };
  }

  const q = UtilityPeriod.findOne({
    utilityType: "electricity",
    roomId: sourceRoom._id,
    status: "open",
    isArchived: false,
  }).sort({ startDate: -1 });
  const period = await (session ? q.session(session) : q).lean();
  if (!period) {
    // No open period => nothing has accrued that a period close would bill.
    return { applicable: false, reason: "no_open_period", waterNote };
  }

  const closing = Number(freshSourceClosingReading);
  const baseline = Number(period.startReading || 0);
  if (closing < baseline) {
    // A meter reading below the period baseline is a data error — surface it,
    // do not silently produce a negative/zero charge.
    const err = new Error(
      `The closing meter reading (${closing} kWh) is below the current billing period's opening reading (${baseline} kWh). Verify the reading.`,
    );
    err.statusCode = 400;
    err.code = "CLOSING_READING_BELOW_BASELINE";
    throw err;
  }

  const tenantId = String(reservation.userId?._id || reservation.userId);

  // ── Build the participant set for [periodStart, cutover] ──────────────────
  // Everyone currently billable in the source room (co-occupants) + the
  // transferee, bounded by a synthetic moveOut at the closing reading. We do
  // NOT read BedHistory here — at preview time the transfer's `transferred`
  // row does not exist yet, and the participant set for this bounded slice is
  // exactly "who is in the room now" (their room-scoped move-in is at/ before
  // the period start unless they themselves transferred in mid-period, which
  // the existing readings already express).
  const roomReservations = await Reservation.find({
    roomId: sourceRoom._id,
    status: { $in: BILLABLE_RESERVATION_STATUS_QUERY },
    isArchived: { $ne: true },
  })
    .populate("userId", "firstName lastName email")
    .session(session || null)
    .lean();

  const cutoverAt = cutoverDate ? new Date(cutoverDate) : new Date();

  // Stamp the transferee with a room-scoped move-out at the cutover so
  // buildTenantEventsForPeriod treats them as departing at that boundary; all
  // others keep their natural (unstamped) occupancy.
  const stampedReservations = roomReservations.map((r) => {
    if (String(r.userId?._id || r.userId) === tenantId) {
      return { ...r, _roomScopedMoveOutDate: cutoverAt };
    }
    return r;
  });
  // The transferee must be in the set even if the room query somehow missed
  // them (e.g. their reservation.roomId already flipped in a retry path).
  if (!stampedReservations.some((r) => String(r.userId?._id || r.userId) === tenantId)) {
    const own = await Reservation.findById(reservation._id)
      .populate("userId", "firstName lastName email")
      .session(session || null)
      .lean();
    if (own) stampedReservations.push({ ...own, _roomScopedMoveOutDate: cutoverAt });
  }

  // ── Readings: existing chain in [periodStart, cutover] + synthetic bounds ─
  const rq = UtilityReading.find({
    roomId: sourceRoom._id,
    utilityType: "electricity",
    isArchived: false,
    date: { $gte: period.startDate, $lte: cutoverAt },
  }).sort({ date: 1, createdAt: 1 });
  const existing = await (session ? rq.session(session) : rq).lean();

  const syntheticStart = {
    _id: "synthetic-period-start",
    utilityType: "electricity",
    roomId: sourceRoom._id,
    reading: baseline,
    date: period.startDate,
    eventType: "periodStart",
    tenantId: null,
  };
  const syntheticMoveOut = {
    _id: "synthetic-transferee-moveout",
    utilityType: "electricity",
    roomId: sourceRoom._id,
    reading: closing,
    date: cutoverAt,
    eventType: "moveOut",
    tenantId,
  };
  // Keep the real move-in/move-out events for OTHER tenants that fall in the
  // window; drop any pre-existing periodStart/periodEnd (we supply our own
  // bounds) and any stray reading dated exactly at/after the cutover.
  const midReadings = existing.filter(
    (r) =>
      r.eventType !== "periodStart" &&
      r.eventType !== "periodEnd" &&
      new Date(r.date) < cutoverAt,
  );

  const readings = sortReadings([syntheticStart, ...midReadings, syntheticMoveOut]);

  const cyclePeriod = {
    startDate: period.startDate,
    endDate: cutoverAt,
    startReading: baseline,
    endReading: closing,
    ratePerUnit: period.ratePerUnit,
  };

  const tenantEvents = buildTenantEventsForPeriod({
    period: cyclePeriod,
    reservations: stampedReservations,
    readings,
  });

  const result = computeBilling({
    utilityPeriod: cyclePeriod,
    readings,
    reservations: stampedReservations,
    tenantEvents,
    forceSegmented: true,
    utilityType: "electricity",
    roomType: sourceRoom.type,
  });

  const summary = (result.tenantSummaries || []).find(
    (s) => String(s.tenantId) === tenantId,
  );
  const amount = round(summary?.billAmount || 0);
  const kwh = round(summary?.totalUsage || 0);

  return {
    applicable: true,
    utilityPeriodId: String(period._id),
    ratePerUnit: Number(period.ratePerUnit) || 0,
    baselineReading: baseline,
    closingReading: closing,
    kwh,
    amount,
    waterNote,
  };
}

/**
 * The informational, NON-BILLED water line for the Complete Transfer review.
 * Water cannot be finalized on transfer day (see the module header) — it is
 * settled at the source room's normal water period close, based on the
 * transferee's occupancy through the cutover.
 */
export function buildWaterNote({ sourceRoom, cutoverDate }) {
  const branch = sourceRoom?.branch;
  const dateLabel = cutoverDate
    ? new Date(cutoverDate).toISOString().slice(0, 10)
    : "the transfer date";

  if (!branch || !branchSupportsSeparateUtilityBilling(branch, "water")) {
    return "Water for this branch is included in rent — no separate water settlement applies to this transfer.";
  }
  if (!isWaterBillableRoom(sourceRoom)) {
    return "This room type is not separately water-billed — no water settlement applies to this transfer.";
  }
  return (
    `Old-room water is settled at the normal water period close for this room, ` +
    `based on your occupancy through ${dateLabel}. It is NOT included in the amount due now ` +
    `and is not double-charged.`
  );
}
