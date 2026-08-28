/**
 * ============================================================================
 * SCHEDULED ROOM TRANSFER — SERIALIZATION
 * ============================================================================
 *
 * The single canonical shape returned to Admin + Tenant (web & mobile) for a
 * scheduled room transfer. Callers never build their own — so the
 * user-facing status vocabulary is defined in exactly one place.
 *
 * USER-FACING STATUS (derived — never a raw enum leak):
 *   "awaiting_payment" — scheduled, a transfer balance exists and is not fully
 *                        settled.
 *   "ready"            — scheduled, transfer balance fully settled OR zero
 *                        balance; waiting for the effective date.
 *   "completed"        — executed.
 *   "action_required"  — the system cannot safely execute automatically;
 *                        `actionRequiredReason` carries the sub-reason.
 *   "cancelled"        — cancelled pre-cutover.
 *
 * Phase 2C ships this with the balance always treated as settled (no Bill yet
 * — 2D adds Bill creation and wires the real payment lookup here).
 * ============================================================================
 */

import { Bill } from "../models/index.js";

export const SCHEDULED_TRANSFER_USER_STATUSES = Object.freeze([
  "awaiting_payment",
  "ready",
  "completed",
  "action_required",
  "cancelled",
]);

/**
 * Resolve the payment state of a scheduled transfer's balance Bill.
 * @returns {{ hasBill:boolean, billId:string|null, amountDue:number,
 *   amountPaid:number, remaining:number, paymentState:"none"|"unpaid"|"partial"|"paid" }}
 */
export async function resolveScheduledTransferBalance(scheduledTransfer, { session = null } = {}) {
  // The balance Bill is the transfer_settlement Bill linked from
  // settlementBillId (2D). Absent => nothing to pay.
  const billId = scheduledTransfer.settlementBillId || null;
  if (!billId) {
    return {
      hasBill: false,
      billId: null,
      amountDue: 0,
      amountPaid: 0,
      remaining: 0,
      paymentState: "none",
    };
  }
  const q = Bill.findById(billId);
  const bill = await (session ? q.session(session) : q).lean();
  if (!bill || bill.status === "voided") {
    return {
      hasBill: false,
      billId: String(billId),
      amountDue: 0,
      amountPaid: 0,
      remaining: 0,
      paymentState: "none",
    };
  }
  const amountDue = Number(bill.totalAmount || 0);
  const amountPaid = Number(bill.amountPaid ?? bill.paidAmount ?? 0);
  const remaining = Math.max(0, Math.round((amountDue - amountPaid) * 100) / 100);
  let paymentState = "unpaid";
  if (amountDue <= 0 || remaining <= 0) paymentState = "paid";
  else if (amountPaid > 0) paymentState = "partial";
  return {
    hasBill: true,
    billId: String(billId),
    amountDue,
    amountPaid,
    remaining,
    paymentState,
  };
}

/**
 * Derive the user-facing status from the record's internal status + balance.
 */
export function deriveScheduledTransferUserStatus(scheduledTransfer, balance) {
  switch (scheduledTransfer.status) {
    case "executed":
      return "completed";
    case "cancelled":
      return "cancelled";
    case "action_required":
      return "action_required";
    case "scheduled":
    default: {
      // Nothing owed (zero-balance transfer, or the balance Bill is fully
      // settled / absent) => Ready. Otherwise Awaiting Payment.
      if (!balance || balance.paymentState === "none" || balance.paymentState === "paid") {
        return "ready";
      }
      return "awaiting_payment";
    }
  }
}

/**
 * The canonical serialized shape. Safe for Admin, Tenant web and Tenant
 * mobile — no internal-only fields.
 */
export async function serializeScheduledRoomTransfer(scheduledTransfer, { session = null } = {}) {
  if (!scheduledTransfer) return null;
  const doc = typeof scheduledTransfer.toObject === "function"
    ? scheduledTransfer.toObject()
    : scheduledTransfer;

  const balance = await resolveScheduledTransferBalance(doc, { session });
  const userStatus = deriveScheduledTransferUserStatus(doc, balance);

  const preview = doc.previewSnapshot || null;
  const executed = doc.executedSettlement || null;
  const figures = executed || preview || null;

  return {
    id: String(doc._id),
    reservationId: String(doc.reservationId),
    tenantId: doc.tenantId ? String(doc.tenantId) : null,
    branch: doc.branch,

    currentRoom: {
      id: doc.sourceRoomId ? String(doc.sourceRoomId) : null,
      name: preview?.fromRoom?.name || null,
      type: preview?.fromRoom?.type || null,
      bedId: doc.sourceBedId || null,
    },
    scheduledRoom: {
      id: doc.destinationRoomId ? String(doc.destinationRoomId) : null,
      name: preview?.toRoom?.name || null,
      type: preview?.toRoom?.type || null,
      bedId: doc.destinationBedId || null,
      needsBed: doc.destinationNeedsBed,
    },

    effectiveTransferDate: doc.effectiveTransferDate,
    status: userStatus,
    actionRequiredReason: doc.status === "action_required" ? (doc.lastError || null) : null,

    // Rent / deposit figures — the executed settlement once it exists,
    // otherwise the scheduling-time preview.
    currentMonthlyRent: figures?.rent?.sourceEffectiveRate ?? null,
    newMonthlyRent: figures?.rent?.destinationApprovedRate ?? null,
    rentAdjustment: figures?.rent?.adjustmentDue ?? null,
    additionalSecurityDeposit: figures?.deposit?.balanceDue ?? null,
    // Informational-until-execution figures for a cheaper destination.
    estimatedRentCreditAfterTransfer: figures?.rent?.excessCredit ?? null,
    estimatedExcessDepositHeld: figures?.deposit?.excessHeld ?? null,

    transferBalance: {
      hasBill: balance.hasBill,
      billId: balance.billId,
      amountDue: balance.amountDue,
      amountPaid: balance.amountPaid,
      remaining: balance.remaining,
      paymentState: balance.paymentState, // none | unpaid | partial | paid
      dueDate: doc.effectiveTransferDate,
    },

    utilitiesNote:
      "Electricity and water follow the normal utility billing after the room-transfer cutoff.",

    addendumContractId: doc.addendumContractId ? String(doc.addendumContractId) : null,

    scheduledAt: doc.scheduledAt || doc.createdAt || null,
    executedAt: doc.executedAt || null,
    cancelledAt: doc.cancelledAt || null,
  };
}

/**
 * Resolve the OPEN scheduled transfer for a reservation (or null), serialized.
 * Convenience for the tenant/admin detail serializers.
 */
export async function getOpenScheduledRoomTransferForReservation(reservationId, { session = null } = {}) {
  const { ScheduledRoomTransfer } = await import("../models/index.js");
  const { OPEN_SCHEDULED_ROOM_TRANSFER_STATUSES } = await import("../models/ScheduledRoomTransfer.js");
  const q = ScheduledRoomTransfer.findOne({
    reservationId,
    status: { $in: [...OPEN_SCHEDULED_ROOM_TRANSFER_STATUSES] },
    isArchived: { $ne: true },
  }).sort({ createdAt: -1 });
  const doc = await (session ? q.session(session) : q);
  if (!doc) return null;
  return serializeScheduledRoomTransfer(doc, { session });
}
