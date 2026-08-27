import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { AuditLog, Contract, Payment, Reservation, Room, Stay } from "../models/index.js";
import { hasReservationStatus } from "../utils/lifecycleNaming.js";
import { PAYMENT_METHODS } from "../config/paymentMethods.js";
import {
  generatePaymentReference,
  isRawPaymentGatewayId,
} from "../utils/referenceGenerator.js";

const KNOWN_PAYMENT_METHODS = new Set(PAYMENT_METHODS);

export const RESERVATION_DEPOSIT_SOURCES = Object.freeze([
  "paymongo",
  "manual_proof",
  "legacy_reconciliation",
]);

const ELIGIBLE_STATUSES = Object.freeze([
  "approved_for_payment",
  "payment_pending",
]);

const RECONCILIATION_STATUSES = Object.freeze([
  "cancelled",
  "rejected",
  "archived",
  "moveIn",
  "moveOut",
]);

export class ReservationDepositSettlementError extends Error {
  constructor(message, code, statusCode = 422, details = {}) {
    super(message);
    this.name = "ReservationDepositSettlementError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
  }
}

export const toCentavos = (amount) => {
  const numeric = Number(amount);
  if (!Number.isFinite(numeric)) {
    throw new ReservationDepositSettlementError(
      "A valid payment amount is required.",
      "PAYMENT_AMOUNT_INVALID",
      422,
    );
  }
  return Math.round(numeric * 100);
};

export const amountsMatch = (expectedAmount, paidAmount) =>
  toCentavos(expectedAmount) === toCentavos(paidAmount);

export const resolveReservationFee = async (
  reservation,
  fallbackResolver,
) => {
  const value =
    reservation?.reservationFeeAmount ??
    (typeof fallbackResolver === "function" ? await fallbackResolver() : null);
  if (value == null) {
    throw new ReservationDepositSettlementError(
      "The Reservation pricing snapshot does not include a reservation fee.",
      "PRICING_SNAPSHOT_MISSING",
      422,
    );
  }
  if (toCentavos(value) < 0) {
    throw new ReservationDepositSettlementError(
      "The Reservation fee cannot be negative.",
      "PAYMENT_AMOUNT_INVALID",
      422,
    );
  }
  return Number(value);
};

// "source" identifies the settlement provider/channel (paymongo, manual_proof,
// legacy_reconciliation) — it is NOT the customer-facing payment method and
// must never be persisted into a paymentMethod field. The actual method
// (gcash, card, ...) always comes from evidence.paymentMethod when present.
export const normalizePaymentMethod = (source, evidence = {}) => {
  const raw = evidence.paymentMethod;
  if (raw) {
    const key = String(raw).toLowerCase().trim().replace(/[\s-]/g, "_");
    if (key === "bank_transfer") return "bank";
    if (KNOWN_PAYMENT_METHODS.has(key)) return key;
    // A real PayMongo channel without a dedicated enum value (e.g. dob,
    // qrph, billease) — keep it as a generic online payment rather than
    // silently discarding the fact that a real channel was used.
    return "online";
  }
  // No channel evidence available: fall back to the provider name for
  // paymongo settlements, "bank" for legacy/manual reconciliation.
  return source === "paymongo" ? "paymongo" : "bank";
};

const buildPaymentSource = (source) =>
  source === "legacy_reconciliation" ? "legacy" : source;

const findExistingSettlement = async ({
  reservationId,
  idempotencyKey,
  externalPaymentId,
  session,
}) => {
  const alternatives = [];
  if (idempotencyKey) alternatives.push({ idempotencyKey });
  if (externalPaymentId) alternatives.push({ externalPaymentId });
  if (alternatives.length === 0) return null;

  const exact = await Payment.findOne({
    reservationId,
    purpose: { $in: ["reservation_deposit", "reservation_fee"] },
    status: { $in: ["confirmed", "paid"] },
    $or: alternatives,
  }).session(session);
  if (exact) return exact;

  return Payment.findOne({
    reservationId,
    purpose: { $in: ["reservation_deposit", "reservation_fee"] },
    status: { $in: ["confirmed", "paid"] },
  }).session(session);
};

const markPaymentOutcome = async ({
  existingPayment,
  data,
  session,
}) => {
  if (existingPayment) {
    Object.assign(existingPayment, data);
    await existingPayment.save({ session });
    return existingPayment;
  }
  const [created] = await Payment.create([data], { session });
  return created;
};

const assertRoomAvailability = async ({ reservation, room, session }) => {
  if (!room || room.isArchived) {
    throw new ReservationDepositSettlementError(
      "The selected room is no longer available.",
      "ROOM_NO_LONGER_AVAILABLE",
      409,
    );
  }

  const roomId = room._id;
  const reservationId = reservation._id;
  const selectedBedId = reservation.selectedBed?.id || null;
  const conflictingQuery = {
    _id: { $ne: reservationId },
    roomId,
    isArchived: { $ne: true },
    // FCFS model: a bed is blocked if another reservation has confirmed it (reserved/moveIn)
    // OR is currently in an active payment window (payment_pending).
    // The first applicant to submit payment proof holds the bed for 24 hours.
    status: { $in: ["reserved", "moveIn", "payment_pending"] },
  };
  if (selectedBedId) conflictingQuery["selectedBed.id"] = selectedBedId;

  const conflictingReservation = await Reservation.findOne(conflictingQuery)
    .select("_id")
    .session(session)
    .lean();
  if (conflictingReservation) {
    throw new ReservationDepositSettlementError(
      "The selected room or bed is no longer available.",
      "ROOM_NO_LONGER_AVAILABLE",
      409,
    );
  }

  if (selectedBedId) {
    const bed = room.beds?.find((entry) => entry.id === selectedBedId);
    const occupiedByOther =
      bed?.occupiedBy?.reservationId &&
      String(bed.occupiedBy.reservationId) !== String(reservationId);
    if (!bed || bed.status === "maintenance" || occupiedByOther) {
      throw new ReservationDepositSettlementError(
        "The selected room or bed is no longer available.",
        "ROOM_NO_LONGER_AVAILABLE",
        409,
      );
    }
    const conflictingStay = await Stay.findOne({
      roomId,
      bedId: selectedBedId,
      status: { $in: ["active", "ending_soon"] },
      reservationId: { $ne: reservationId },
    })
      .select("_id")
      .session(session)
      .lean();
    if (conflictingStay) {
      throw new ReservationDepositSettlementError(
        "The selected room or bed is no longer available.",
        "ROOM_NO_LONGER_AVAILABLE",
        409,
      );
    }
    return bed;
  }

  const activeCount = await Reservation.countDocuments({
    _id: { $ne: reservationId },
    roomId,
    isArchived: { $ne: true },
    status: { $in: ["reserved", "moveIn"] },
  }).session(session);
  if (activeCount >= Number(room.capacity || 0)) {
    throw new ReservationDepositSettlementError(
      "The selected room or bed is no longer available.",
      "ROOM_NO_LONGER_AVAILABLE",
      409,
    );
  }
  return null;
};

export async function settleReservationDeposit({
  reservationId,
  source,
  paidAmount,
  externalPaymentId = null,
  externalSessionId = null,
  paymentReference = null,
  idempotencyKey,
  evidence = {},
  actor = {},
  paidAt = new Date(),
  existingPaymentId = null,
  fallbackFeeResolver = null,
}) {
  if (!RESERVATION_DEPOSIT_SOURCES.includes(source)) {
    throw new ReservationDepositSettlementError(
      "Unsupported reservation deposit source.",
      "PAYMENT_SOURCE_INVALID",
      422,
    );
  }
  if (!mongoose.isValidObjectId(reservationId)) {
    throw new ReservationDepositSettlementError(
      "A valid Reservation ID is required.",
      "INVALID_RESERVATION_ID",
      400,
    );
  }
  if (!idempotencyKey || !String(idempotencyKey).trim()) {
    throw new ReservationDepositSettlementError(
      "A stable payment idempotency key is required.",
      "PAYMENT_IDEMPOTENCY_KEY_REQUIRED",
      422,
    );
  }

  const mongoSession = await mongoose.startSession();
  let result = null;
  let deferredError = null;

  try {
    await mongoSession.withTransaction(async () => {
      const reservation = await Reservation.findById(reservationId)
        .session(mongoSession);
      if (!reservation) {
        throw new ReservationDepositSettlementError(
          "Reservation not found.",
          "RESERVATION_NOT_FOUND",
          404,
        );
      }

      const existingSettlement = await findExistingSettlement({
        reservationId,
        idempotencyKey: String(idempotencyKey),
        externalPaymentId,
        session: mongoSession,
      });
      if (existingSettlement) {
        result = {
          reservation,
          payment: existingSettlement,
          idempotent: true,
          settled: true,
        };
        return;
      }

      const existingPayment = existingPaymentId
        ? await Payment.findOne({
            _id: existingPaymentId,
            reservationId,
            purpose: "reservation_deposit",
          }).session(mongoSession)
        : null;
      if (existingPaymentId && !existingPayment) {
        throw new ReservationDepositSettlementError(
          "Payment proof record not found.",
          "PAYMENT_ATTEMPT_NOT_FOUND",
          404,
        );
      }

      const expectedAmount = await resolveReservationFee(
        reservation,
        fallbackFeeResolver,
      );
      const room = await Room.findById(reservation.roomId).session(mongoSession);
      if (!room) {
        throw new ReservationDepositSettlementError(
          "The Reservation room could not be resolved.",
          "ROOM_NOT_FOUND",
          404,
        );
      }
      const expectedCentavos = toCentavos(expectedAmount);
      const paidCentavos = toCentavos(paidAmount);

      const rawExternalPaymentId =
        externalPaymentId || (isRawPaymentGatewayId(paymentReference) ? paymentReference : null);
      const cleanPaymentReference =
        paymentReference && !isRawPaymentGatewayId(paymentReference)
          ? paymentReference
          : (reservation.paymentReference && !isRawPaymentGatewayId(reservation.paymentReference)
              ? reservation.paymentReference
              : generatePaymentReference({ prefix: "PAY", date: new Date(paidAt) }));

      const basePayment = {
        tenantId: reservation.userId,
        reservationId: reservation._id,
        billId: null,
        branch: room.branch,
        purpose:
          reservation.financialWorkflowVersion === "structured-initial-payment-v1"
            ? "reservation_fee"
            : "reservation_deposit",
        amount: Number(paidAmount),
        expectedAmount,
        paidAmount: Number(paidAmount),
        currency: String(evidence.currency || "PHP").toUpperCase(),
        method: normalizePaymentMethod(source, evidence),
        provider: source === "paymongo" ? "paymongo" : null,
        providerPaymentId: source === "paymongo" ? rawExternalPaymentId : null,
        settlementTimestamp: source === "paymongo" ? new Date(paidAt) : null,
        source: buildPaymentSource(source),
        externalPaymentId: rawExternalPaymentId,
        externalSessionId,
        paymentReference: cleanPaymentReference,
        referenceNumber: cleanPaymentReference,
        idempotencyKey: String(idempotencyKey),
        proofUrl: evidence.proofUrl || existingPayment?.proofUrl || null,
        proofImageUrl: evidence.proofUrl || existingPayment?.proofImageUrl || null,
        submittedAt: existingPayment?.submittedAt || evidence.submittedAt || paidAt,
        metadata: {
          ...(existingPayment?.metadata || {}),
          actorRole: actor.role || null,
          settlementSource: source,
          rawPaymentGatewayId: rawExternalPaymentId || null,
        },
      };

      if (basePayment.currency !== "PHP") {
        const payment = await markPaymentOutcome({
          existingPayment,
          data: {
            ...basePayment,
            status: "reconciliation_required",
            processedAt: new Date(),
          },
          session: mongoSession,
        });
        deferredError = new ReservationDepositSettlementError(
          "The payment currency requires administrator reconciliation.",
          "PAYMENT_CURRENCY_MISMATCH",
          422,
          { expectedCurrency: "PHP", paidCurrency: basePayment.currency },
        );
        result = { reservation, payment, reconciliationRequired: true };
        return;
      }

      if (expectedCentavos !== paidCentavos) {
        const payment = await markPaymentOutcome({
          existingPayment,
          data: {
            ...basePayment,
            status: "amount_mismatch",
            processedAt: new Date(),
          },
          session: mongoSession,
        });
        deferredError = new ReservationDepositSettlementError(
          "The confirmed payment amount does not match the expected reservation fee.",
          "PAYMENT_AMOUNT_MISMATCH",
          422,
          { expectedAmount, paidAmount: Number(paidAmount) },
        );
        result = { reservation, payment, reconciliationRequired: true };
        return;
      }

      if (
        RECONCILIATION_STATUSES.some((status) =>
          hasReservationStatus(reservation.status, status),
        )
      ) {
        const payment = await markPaymentOutcome({
          existingPayment,
          data: {
            ...basePayment,
            status: "reconciliation_required",
            processedAt: new Date(),
          },
          session: mongoSession,
        });
        result = { reservation, payment, reconciliationRequired: true };
        return;
      }

      if (!hasReservationStatus(reservation.status, ...ELIGIBLE_STATUSES)) {
        throw new ReservationDepositSettlementError(
          "The Reservation is not eligible for payment settlement.",
          "PAYMENT_READINESS_INCOMPLETE",
          409,
          { reservationStatus: reservation.status },
        );
      }

      const bed = await assertRoomAvailability({
        reservation,
        room,
        session: mongoSession,
      });

      const previousReservationStatus = reservation.status;
      const payment = await markPaymentOutcome({
        existingPayment,
        data: {
          ...basePayment,
          status: "confirmed",
          processedAt: new Date(),
          verifiedAt: new Date(),
          verifiedBy: actor.id || null,
        },
        session: mongoSession,
      });

      reservation.paymentStatus = "paid";
      reservation.reservationFeePaymentStatus = "verified";
      reservation.paymentReference = cleanPaymentReference;
      reservation.paidAt = reservation.paidAt || new Date(paidAt);
      reservation.paymentDate = new Date(paidAt);
      reservation.paymentMethod = normalizePaymentMethod(source, evidence);
      reservation.paymongoPaymentId =
        source === "paymongo"
          ? rawExternalPaymentId || reservation.paymongoPaymentId
          : reservation.paymongoPaymentId;
      reservation.status = "reserved";
      reservation.reservedAt = reservation.reservedAt || new Date();
      reservation.approvedDate = reservation.approvedDate || new Date();
      await reservation.save({ session: mongoSession });

      const occupiedCount = await Reservation.countDocuments({
        roomId: room._id,
        isArchived: { $ne: true },
        status: { $in: ["reserved", "moveIn"] },
      }).session(mongoSession);
      room.currentOccupancy = occupiedCount;
      // Phase 3: clear stale pointers to this reservation on OTHER beds before
      // writing to the target bed — mirrors the Phase 2 sweep in occupancyManager.
      const reservationIdStr = String(reservation._id);
      const targetBedId = reservation.selectedBed?.id;
      for (const otherBed of room.beds) {
        if (targetBedId && otherBed.id === targetBedId) continue;
        if (String(otherBed.occupiedBy?.reservationId) === reservationIdStr) {
          otherBed.status = "available";
          otherBed.lockedBy = null;
          otherBed.lockExpiresAt = null;
          otherBed.occupiedBy = { userId: null, reservationId: null, occupiedSince: null };
        }
      }

      if (bed) {
        bed.status = "reserved";
        bed.lockExpiresAt = null;
        bed.lockedBy = null;
        bed.occupiedBy = {
          userId: reservation.userId,
          reservationId: reservation._id,
          occupiedSince: null,
        };
      }
      room.updateAvailability();
      await room.save({ session: mongoSession });

      await AuditLog.create(
        [
          {
            logId: `LOG-${randomUUID()}`,
            type: "data_modification",
            action:
              source === "paymongo"
                ? "reservation.deposit_confirmed_paymongo"
                : "reservation.payment_proof_approved",
            severity: "high",
            user: actor.id ? String(actor.id) : "paymongo",
            userId: actor.id || null,
            userRole: actor.role || source,
            branch: room.branch,
            entityType: "reservation",
            entityId: String(reservation._id),
            details: "Reservation deposit confirmed through the dedicated settlement workflow.",
            metadata: {
              reservationId: String(reservation._id),
              paymentId: String(payment._id),
              source,
              previousPaymentState: existingPayment?.status || "none",
              newPaymentState: payment.status,
              previousReservationState: previousReservationStatus,
              newReservationState: reservation.status,
              expectedAmount,
              paidAmount: Number(paidAmount),
              externalReference: paymentReference,
              idempotencyKey: String(idempotencyKey),
            },
          },
        ],
        { session: mongoSession },
      );

      result = {
        reservation,
        payment,
        idempotent: false,
        settled: true,
        previousReservationStatus,
      };
    });
  } finally {
    await mongoSession.endSession();
  }

  if (deferredError) {
    deferredError.payment = result?.payment || null;
    throw deferredError;
  }
  const isStructuredWorkflow =
    result?.reservation?.financialWorkflowVersion === "structured-initial-payment-v1";
  if (result?.settled && isStructuredWorkflow) {
    const { createStructuredInitialPaymentBill } = await import(
      "./structuredInitialPaymentService.js"
    );
    result.initialPaymentBill = await createStructuredInitialPaymentBill({
      reservation: result.reservation,
      reservationFeePayment: result.payment,
      now: new Date(paidAt),
    });
  }
  // AUTHORITATIVE RULE: A Reservation is not yet a Contract. Contract
  // generation requires BOTH the Reservation Fee AND the Advance + Security
  // Deposit to be fully paid/verified — this settlement function only ever
  // confirms the Reservation Fee (see resolveReservationFee above, and
  // Reservation.reservationFeePaymentStatus="verified" a few lines up). For
  // structured-workflow reservations, the Advance + Deposit is a distinct,
  // separate "initial_payment" Bill (just created above) that only reaches
  // ₱0 remaining later, at which point autoGenerateDepositSettledContract
  // (wired into structuredInitialPaymentService.syncStructuredReservationAfterBillSettlement
  // and the PayMongo webhook/polling paths in paymentController.js) is the
  // correct, sole trigger — creating a draft Contract here as well would
  // generate a legal document before the tenant has actually paid what the
  // Contract will state they owe.
  //
  // Legacy (pre-structured-workflow) reservations have no second payment
  // step at all — no initial_payment Bill is ever created for them, so
  // there is no later event that could trigger generation. For those,
  // reservation-fee settlement remains the sole and immediate trigger,
  // preserving existing behavior rather than leaving legacy reservations
  // permanently unable to reach a Contract.
  if (result?.settled && !isStructuredWorkflow) {
    result.draftContract = await ensureDraftContractForSettledReservation({
      reservation: result.reservation,
      actorId: actor.id || result.reservation.userId,
    });
  }
  return result;
}

// Legacy-workflow path only (see the authoritative-rule comment above this
// function's call site) — the authoritative Contract must exist as soon as a
// legacy reservation's single payment is verified, since no later
// Advance+Deposit event will ever arrive for it. This runs on every
// settlement call (fresh settlement AND idempotent replay), so a prior crash
// between payment confirmation and Contract creation self-heals on the next
// retry/webhook redelivery instead of leaving the reservation "paid" with no
// Contract.
//
// Deliberately outside the settlement's own Mongo transaction (same pattern
// as createStructuredInitialPaymentBill above): createDraftContract's own
// unique-index-backed duplicate detection (see contractService.js) already
// makes this safe to call more than once, and payment confirmation must
// never be rolled back just because Contract drafting hit a transient error
// — see the moveIn-time repair pass in reservationLifecycleController.js,
// which follows the same "ensure, don't fail loudly" idiom for rent bills.
async function ensureDraftContractForSettledReservation({ reservation, actorId }) {
  try {
    const { createDraftContract } = await import("./contractService.js");
    return await createDraftContract({
      reservationId: reservation._id,
      stayId: reservation.currentStayId || null,
      actorId,
    });
  } catch (error) {
    if (error?.code === "DUPLICATE_CONTRACT") {
      // A second Contract would be a duplicate, but the existing canonical
      // draft may itself be the record that needs deterministic recovery.
      // Reuse it, repair only canonical missing derived dates, then let the
      // ordinary auto-generation workflow decide whether it can advance.
      const existingId = error.details?.existingContract?.id;
      const existing = existingId ? await Contract.findById(existingId) : null;
      if (!existing) return null;
      if (
        existing.status !== "draft" ||
        existing.leaseStartDate !== null ||
        existing.leaseEndDate !== null
      ) {
        return existing;
      }
      const { repairContractDraftDates } = await import(
        "./contractDraftRecoveryService.js"
      );
      const recovery = await repairContractDraftDates({
        contractId: existing._id,
        actorId,
      });
      if (recovery.repaired) {
        const { autoGenerateDepositSettledContract } = await import(
          "./autoContractOrchestratorService.js"
        );
        await autoGenerateDepositSettledContract({
          reservationId: reservation._id,
          actorId,
        });
        return Contract.findById(existing._id);
      }
      return existing;
    }
    const logger = (await import("../middleware/logger.js")).default;
    logger.error(
      { err: error, reservationId: String(reservation._id) },
      "Failed to auto-create draft Contract after reservation deposit settlement (non-fatal; " +
        "will retry on the next settlement replay or moveIn repair pass)",
    );
    return null;
  }
}

export default {
  settleReservationDeposit,
  amountsMatch,
  resolveReservationFee,
  toCentavos,
};
