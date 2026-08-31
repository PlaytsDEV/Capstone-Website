/**
 * ============================================================================
 * ROOM-TRANSFER FINANCIAL-INPUT RESOLVERS (read-only)
 * ============================================================================
 * Resolves the two rate inputs room-transfer settlement needs for the SOURCE
 * room, so roomTransferSettlement.js's pure math never has to guess them:
 *
 *   resolveSourceEffectiveRentForTransfer — what rate values the days
 *   already consumed in the source room. This MUST mirror
 *   rentGenerator.resolveReservationRentAmount's own precedence, because
 *   "the rate the tenant was being billed in the source room" is exactly
 *   what that resolver returns:
 *
 *     1. reservation.recurringRentRate — set by a PRIOR room transfer's
 *        cutover to the then-destination approved rate. On a SECOND transfer
 *        this is the tenant's current effective recurring rent (e.g. after
 *        Quad->Double it holds 8000), and it must be the SOURCE rate for the
 *        next transfer — NOT the original pricingSnapshot, which still
 *        describes the very first room (5400) and is intentionally immutable.
 *        This is the B9 fix: reuse the one field the rent generator already
 *        treats as authoritative rather than inventing another rate source.
 *     2. structured pricingSnapshot.finalMonthlyRate — the tenant's actual
 *        approved (possibly discounted) first-room rent. A Contract's
 *        approvedMonthlyRate can drift from this over time (e.g. a renewal
 *        successor Contract re-resolving pricing from the current
 *        Room/BusinessSettings list price instead of the originally approved
 *        discount), so for a structured reservation with an approved
 *        snapshot it is preferred over the Contract field.
 *     3. predecessorContract.approvedMonthlyRate — flat-rate fallback.
 *
 *   resolveApplicablePrepaidRentForTransfer — how much same-cycle rent is
 *   already represented by canonical billing. A structured first period uses
 *   verified paid advance rent. Every later period uses its monthly Bill's
 *   full charges.rent regardless of payment status: unpaid/partial status is
 *   an outstanding-balance concern, not permission to bill the same rent
 *   liability again in the transfer settlement.
 *
 * KNOWN CONTRACT-VS-SNAPSHOT MISMATCH (documented, not fixed here): a
 * structured reservation's INITIAL Contract is created with
 * approvedMonthlyRate === pricingSnapshot.finalMonthlyRate exactly
 * (contractService.js's structuredSnapshot branch). The mismatch this
 * module guards against arises later, when a renewal successor Contract is
 * created: tenantActionService.js's renewal-acceptance path resolves the
 * new Stay/Contract rate via getMonthlyRent(reservation), which falls back
 * to reservation.monthlyRent / roomId.monthlyPrice — fields that do not
 * consult pricingSnapshot.finalMonthlyRate at all — so a Contract created
 * after a renewal can silently drift to the room's undiscounted list price.
 * That is a pre-existing renewal-pricing gap in Contract generation, out of
 * this phase's scope (no Contract/renewal redesign, no rewriting of
 * historical Contract records) — this module only ensures room-transfer
 * settlement itself never inherits that drift for a structured tenant whose
 * pricingSnapshot remains the immutable source of truth for their approved
 * rent.
 *
 * Both resolvers only read already-resolved data the caller passes in
 * (reservation, predecessorContract, currentBillingCycle) or query Bill
 * read-only. Neither mutates Reservation.pricingSnapshot, Bill, Contract,
 * or any payment state — callers remain responsible for all persistence.
 * ============================================================================
 */
import { Bill } from "../../models/index.js";
import { roundMoney } from "./billingPolicy.js";
import { usesStructuredInitialPayment } from "../../config/structuredInitialPayment.js";

function hasApprovedStructuredSnapshot(reservation) {
  return Boolean(
    usesStructuredInitialPayment(reservation) && reservation?.pricingSnapshot?.approvedAt,
  );
}

/**
 * Resolves the rate that values days actually consumed in the source room.
 * @param {Object} params
 * @param {Object} params.reservation - must include pricingSnapshot/financialWorkflowVersion.
 * @param {Object} params.predecessorContract - the tenant's current, active source-room Contract.
 * @returns {{sourceEffectiveRate: number, sourceRateSource: string}}
 */
export function resolveSourceEffectiveRentForTransfer({ reservation, predecessorContract } = {}) {
  // (1) A prior transfer already set the tenant's current effective recurring
  // rent here — this is what rentGenerator.resolveReservationRentAmount bills
  // TODAY, so on a subsequent transfer it is the correct SOURCE rate. Wins
  // over the immutable original pricingSnapshot (B9).
  const priorTransferRate = Number(reservation?.recurringRentRate);
  if (Number.isFinite(priorTransferRate) && priorTransferRate > 0) {
    return {
      sourceEffectiveRate: roundMoney(priorTransferRate),
      sourceRateSource: "prior_transfer_recurring_rate",
    };
  }
  if (hasApprovedStructuredSnapshot(reservation)) {
    const finalMonthlyRate = Number(reservation.pricingSnapshot.finalMonthlyRate);
    if (Number.isFinite(finalMonthlyRate) && finalMonthlyRate > 0) {
      return {
        sourceEffectiveRate: roundMoney(finalMonthlyRate),
        sourceRateSource: "structured_final_monthly_rate",
      };
    }
  }
  return {
    sourceEffectiveRate: roundMoney(predecessorContract?.approvedMonthlyRate),
    sourceRateSource: "contract_approved_monthly_rate",
  };
}

/**
 * @param {Object} params
 * @param {Object} params.reservation - the Reservation document (must include pricingSnapshot,
 *   financialWorkflowVersion, initialPaymentBillId when structured).
 * @param {number} params.sourceEffectiveRate - the resolved source-room rate from
 *   resolveSourceEffectiveRentForTransfer, used ONLY as the initial-period (cycle 0)
 *   funded-amount basis for a non-structured (or unapproved-snapshot) reservation —
 *   never as a substitute for real evidence in a later period.
 * @param {{billingCycleStart: Date, cycleIndex: number}} params.currentBillingCycle - the
 *   resolved current rent-billing-cycle boundaries (billingPolicy.js resolveCurrentBillingCycle).
 * @param {import("mongoose").ClientSession} [params.session]
 * @returns {Promise<{applicablePrepaidRent: number, prepaidRentSource: string, sourceBillId: (string|null)}>}
 */
export async function resolveApplicablePrepaidRentForTransfer({
  reservation,
  sourceEffectiveRate,
  currentBillingCycle,
  session,
} = {}) {
  // Degenerate/missing period input (e.g. no resolvable moveInDate) — there
  // is no cycle to reason about at all; fall back to the source rate as the
  // best available single-period basis, same as Phase 4B's original default.
  if (!currentBillingCycle?.billingCycleStart) {
    return {
      applicablePrepaidRent: roundMoney(sourceEffectiveRate),
      prepaidRentSource: "contract_rate_fallback",
      sourceBillId: null,
      sourceBillType: null,
    };
  }

  const cycleIndex = Number(currentBillingCycle.cycleIndex);

  // Cycle index 0 is the first rental period. For structured reservations it
  // is funded up front by the one-time advance-rent amount captured on the
  // immutable pricingSnapshot — never by a regular "monthly" Bill (see
  // structuredInitialPaymentService.js / rentGenerator.js's advance-coverage
  // skip). Flat-rate reservations (or a structured reservation whose
  // snapshot is somehow not yet approved) have no such advance figure; the
  // one-month-advance-equivalent Contract-basis rate remains correct for
  // their first period only — this does NOT generalize to later periods
  // (see the cycleIndex >= 1 branch below).
  if (cycleIndex === 0) {
    if (hasApprovedStructuredSnapshot(reservation)) {
      const initialBill = reservation.initialPaymentBillId
        ? await Bill.findById(reservation.initialPaymentBillId).session(session || null)
        : null;
      const remaining = Number(initialBill?.remainingAmount);
      const provenPaid =
        initialBill?.billType === "initial_payment" &&
        initialBill?.status === "paid" &&
        Number.isFinite(remaining) &&
        roundMoney(remaining) === 0;
      const advanceRentAmount = Number(
        initialBill?.initialPaymentBreakdown?.advanceRent ??
          reservation.pricingSnapshot.advanceRentAmount,
      );
      if (provenPaid && Number.isFinite(advanceRentAmount)) {
        return {
          applicablePrepaidRent: roundMoney(advanceRentAmount),
          prepaidRentSource: "verified_initial_payment_bill",
          sourceBillId: initialBill._id,
          sourceBillType: "initial_payment",
        };
      }
      return {
        applicablePrepaidRent: 0,
        prepaidRentSource: "initial_advance_unverified",
        sourceBillId: reservation.initialPaymentBillId || null,
        sourceBillType: "initial_payment",
        requiresManualReview: true,
        manualReviewReason: "ROOM_TRANSFER_ADVANCE_PAYMENT_UNVERIFIED",
      };
    }
    return {
      applicablePrepaidRent: roundMoney(sourceEffectiveRate),
      prepaidRentSource: "initial_period_contract_rate",
      sourceBillId: null,
      sourceBillType: null,
    };
  }

  // Later periods: the authoritative represented amount is whatever the
  // current period's own regular rent Bill charged — never a re-derived
  // Contract rate and never the original initial-period advance snapshot,
  // which only ever funded cycle 0.
  const currentBill = await Bill.findOne({
    reservationId: reservation._id,
    billType: "monthly",
    billingCycleStart: currentBillingCycle.billingCycleStart,
    isArchived: { $ne: true },
  }).session(session || null);

  if (!currentBill) {
    // A missing Bill for a LATER period is not evidence that rent was
    // funded — it may simply not have been generated yet (pre-generation
    // lead window), a delayed billing job, or a data inconsistency. Unlike
    // cycle 0 (where advance coverage intentionally skips Bill generation),
    // there is no authoritative signal here that this period is prepaid, so
    // no credit is granted rather than assuming a full nominal rent amount.
    return {
      applicablePrepaidRent: 0,
      prepaidRentSource: "no_current_bill_unfunded",
      sourceBillId: null,
      sourceBillType: null,
    };
  }

  const rentCharge = roundMoney(currentBill.charges?.rent);
  return {
    applicablePrepaidRent: rentCharge,
    prepaidRentSource: "current_bill_billed_rent",
    sourceBillId: currentBill._id,
    sourceBillType: "monthly",
  };
}
