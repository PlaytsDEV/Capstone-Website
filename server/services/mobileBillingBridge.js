/**
 * ============================================================================
 * MOBILE BILLING BRIDGE
 * ============================================================================
 *
 * Pure mapping functions between the canonical Bill model / billingPolicy
 * engine and the mobile app's existing (legacy-mobile-backend-shaped) JSON
 * contract, so mobile screens keep working unmodified while the data
 * underneath is the authoritative canonical Bill — the same pattern already
 * used by routes/mobileContractRoutes.js.
 *
 * This module must NEVER write to the database and must NEVER derive its
 * output from anything client-supplied — only from a resolved canonical
 * Bill document (plus the shared billingPolicy snapshot for that bill).
 */

import { getVisibleBillSnapshot, getUtilityDispatchEntry } from "../utils/billingPolicy.js";
import { PAYMENT_METHOD_LABELS } from "../utils/paymongoPaymentMethod.js";

/**
 * Mobile-facing effective status vocabulary. This is the ONLY status
 * vocabulary the mobile app is shown — never the raw canonical Bill.status
 * enum, and never the mobile-only legacy vocabulary either.
 */
export const MOBILE_BILL_STATUSES = Object.freeze([
  "unpaid",
  "pending_verification",
  "partially_paid",
  "rejected",
  "paid",
  "cancelled",
]);

const MOBILE_STATUS_LABELS = Object.freeze({
  unpaid: "Unpaid",
  pending_verification: "Pending Verification",
  partially_paid: "Partially Paid",
  rejected: "Rejected",
  paid: "Paid",
  cancelled: "Cancelled",
});

/**
 * Derive the mobile-facing effective status purely from canonical evidence.
 *
 * Precedence (strongest evidence wins — never let a stale/derived field
 * override stronger payment evidence, and never let an in-flight
 * verification flag claim "paid" before the balance is actually zero):
 *   1. status === "voided"                        -> cancelled
 *   2. remainingAmount <= 0 (or status === "waived") -> paid
 *   3. paymentProof pending-verification            -> pending_verification
 *   4. paymentProof rejected                        -> rejected
 *   5. paidAmount > 0                               -> partially_paid
 *   6. otherwise                                    -> unpaid
 *
 * `status === "adjusted"` is a modifier, not a lifecycle terminus, so it
 * intentionally falls through to the payment-evidence rules above.
 * `status === "draft"` bills must never reach this function — callers are
 * expected to filter drafts out before mapping (mirrors every canonical
 * tenant-facing billing query, e.g. billingQueryController.js).
 *
 * @param {{status: string, remainingAmount: number, paidAmount: number, paymentProof?: {verificationStatus?: string}}} evidence
 * @returns {string} one of MOBILE_BILL_STATUSES
 */
export function resolveMobileBillStatus(evidence = {}) {
  const status = String(evidence.status || "").toLowerCase();
  const remainingAmount = Number(evidence.remainingAmount || 0);
  const paidAmount = Number(evidence.paidAmount || 0);
  const proofStatus = String(evidence.paymentProof?.verificationStatus || "none");

  if (status === "voided") return "cancelled";
  if (remainingAmount <= 0) return "paid";
  if (status === "waived") return "paid";
  if (proofStatus === "pending-verification") return "pending_verification";
  if (proofStatus === "rejected") return "rejected";
  if (paidAmount > 0) return "partially_paid";
  return "unpaid";
}

export function mobileBillStatusLabel(mobileStatus) {
  return MOBILE_STATUS_LABELS[mobileStatus] || "Unpaid";
}

/**
 * Map a raw canonical payment-method enum value (Bill.paymentMethod, see
 * config/paymentMethods.js PAYMENT_METHODS) to a human-readable mobile
 * label. Never returns the literal string "PayMongo" as a channel name —
 * "paymongo" is a settlement rail, not a tenant-facing payment method, so it
 * maps to a neutral, accurate "Online Payment (PayMongo)" label instead.
 * Returns null (not a guess) when there is no reliable evidence at all.
 *
 * @param {string|null|undefined} rawMethod
 * @returns {string|null}
 */
export function toMobilePaymentMethodLabel(rawMethod) {
  const key = String(rawMethod || "").trim().toLowerCase();
  if (!key) return null;

  const extraLabels = {
    bank: "Bank Transfer",
    check: "Check",
    offline_cash: "Cash (Branch)",
    offline_bank_transfer: "Bank Transfer (Branch)",
    online: "Online Payment (PayMongo)",
    paymongo: "Online Payment (PayMongo)",
  };

  return PAYMENT_METHOD_LABELS[key] || extraLabels[key] || null;
}

/**
 * Map a bill's per-utility dispatch state (billingPolicy.js
 * getUtilityDispatchEntry — the SAME authoritative "is this utility charge
 * actually released to the tenant yet" signal the canonical web app already
 * uses via isUtilityChargeVisible/getVisibleBillCharges) into the
 * { billReleaseDate, finalDueDate, meterReadingDate } shape the mobile
 * frontend's billingStatus.js already expects.
 *
 * Only includes a utility once its dispatch state is genuinely "sent" — a
 * still-draft utility charge correctly produces no entry here, which is
 * what makes the mobile "Your utility bill has not been released yet."
 * copy accurate instead of a permanent false contradiction against a
 * bill that already shows "Paid" (the bug this bridge exists to prevent).
 *
 * @param {Object} bill - canonical Bill (Mongoose document or plain object)
 * @param {{electricity: number, water: number}} charges - visible charges
 * @returns {Object} keyed by utility type, only for genuinely-dispatched charges
 */
function mobileUtilityDeadlines(bill, charges = {}) {
  const deadlines = {};
  for (const utilityType of ["electricity", "water"]) {
    if (Number(charges[utilityType] || 0) <= 0) continue;
    const entry = getUtilityDispatchEntry(bill, utilityType);
    if (entry.state !== "sent") continue;
    deadlines[utilityType] = {
      billReleaseDate: entry.issuedAt || null,
      finalDueDate: entry.dueDate || null,
      meterReadingDate: entry.publishedAt || null,
    };
  }
  return deadlines;
}

/**
 * Map a canonical Bill (Mongoose document or .lean() object) to the flat,
 * legacy-mobile-shaped JSON the current mobile frontend already expects
 * (see server/mobile/controllers/billing.controller.js `mapRealBill()`,
 * which this intentionally mirrors field-for-field so no mobile screen
 * needs to change). The ONLY difference from the legacy mapper is that
 * `status` here is the explicit mobile effective-status vocabulary
 * (MOBILE_BILL_STATUSES) derived from canonical evidence, never a raw
 * canonical or legacy status string, and `payment_method` is a
 * human-readable label rather than a raw enum/settlement-rail value.
 *
 * @param {import("mongoose").Document|Object} bill - canonical Bill
 * @returns {Object} mobile-shaped bill JSON
 */
export function toMobileBill(bill) {
  const visible = getVisibleBillSnapshot(bill);
  const mobileStatus = resolveMobileBillStatus({
    status: bill.status,
    remainingAmount: visible.remainingAmount,
    paidAmount: bill.paidAmount || 0,
    paymentProof: bill.paymentProof,
  });

  let billingPeriod = bill.billingMonth || "";
  try {
    billingPeriod = billingPeriod
      ? new Date(billingPeriod).toLocaleDateString("en-US", { month: "long", year: "numeric" })
      : "";
  } catch {
    billingPeriod = "";
  }

  const charges = visible.charges || {};

  return {
    billing_id: String(bill._id),
    description: billingPeriod ? `${billingPeriod} Billing Statement` : "Billing Statement",
    billing_period: billingPeriod,
    billing_type: "consolidated",
    due_date: visible.dueDate,
    release_date: bill.billingCycleStart || visible.issuedAt || null,
    status: mobileStatus,
    status_label: mobileBillStatusLabel(mobileStatus),
    rent: charges.rent || 0,
    electricity: charges.electricity || 0,
    water: charges.water || 0,
    penalties: (charges.penalty || 0) + (charges.applianceFees || 0) + (charges.corkageFees || 0),
    amount: visible.totalAmount,
    total: visible.totalAmount,
    gross_amount: visible.grossAmount,
    remaining_amount: visible.remainingAmount,
    paid_amount: bill.paidAmount || 0,
    payment_method: toMobilePaymentMethodLabel(bill.paymentMethod),
    payment_date: bill.paymentDate || null,
    paymongo_reference: bill.paymongoPaymentId || null,
    additional_charges: bill.additionalCharges || [],
    payment_proof_status: bill.paymentProof?.verificationStatus || "none",
    created_at: bill.createdAt || null,
    utility_deadlines: mobileUtilityDeadlines(bill, charges),
  };
}

/**
 * True when the canonical Bill's mobile effective status is "paid" —
 * used to build the mobile "paid history" list (GET /billing/history/paid)
 * by filtering the same canonical Bill collection used for regular history,
 * preserving the mobile app's existing bill-shaped (not ledger-shaped)
 * response contract for that endpoint.
 */
export function isMobileEffectivelyPaid(bill) {
  const visible = getVisibleBillSnapshot(bill);
  return resolveMobileBillStatus({
    status: bill.status,
    remainingAmount: visible.remainingAmount,
    paidAmount: bill.paidAmount || 0,
    paymentProof: bill.paymentProof,
  }) === "paid";
}
