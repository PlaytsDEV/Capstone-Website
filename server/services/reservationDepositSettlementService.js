import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
import { AuditLog, Payment, Reservation, Room, Stay } from "../models/index.js";
import { hasReservationStatus } from "../utils/lifecycleNaming.js";

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

const normalizePaymentMethod = (source, evidence = {}) => {
  if (source === "paymongo") return "paymongo";
  const method = String(evidence.paymentMethod || "bank").toLowerCase();
  return method === "bank_transfer" ? "bank" : method;
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
    purpose: "reservation_deposit",
    status: { $in: ["confirmed", "paid"] },
    $or: alternatives,
  }).session(session);
  if (exact) return exact;

  return Payment.findOne({
    reservationId,
    purpose: "reservation_deposit",
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
    status: { $in: ["reserved", "moveIn"] },
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
      const basePayment = {
        tenantId: reservation.userId,
        reservationId: reservation._id,
        billId: null,
        branch: room.branch,
        purpose: "reservation_deposit",
        amount: Number(paidAmount),
        expectedAmount,
        paidAmount: Number(paidAmount),
        currency: String(evidence.currency || "PHP").toUpperCase(),
        method: normalizePaymentMethod(source, evidence),
        source: buildPaymentSource(source),
        externalPaymentId,
        externalSessionId,
        paymentReference,
        referenceNumber: paymentReference,
        idempotencyKey: String(idempotencyKey),
        proofUrl: evidence.proofUrl || existingPayment?.proofUrl || null,
        proofImageUrl: evidence.proofUrl || existingPayment?.proofImageUrl || null,
        submittedAt: existingPayment?.submittedAt || evidence.submittedAt || paidAt,
        metadata: {
          ...(existingPayment?.metadata || {}),
          actorRole: actor.role || null,
          settlementSource: source,
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
      reservation.paymentDate = new Date(paidAt);
      reservation.paymentMethod = normalizePaymentMethod(source, evidence);
      reservation.paymongoPaymentId =
        source === "paymongo"
          ? externalPaymentId || reservation.paymongoPaymentId
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
  return result;
}

export default {
  settleReservationDeposit,
  amountsMatch,
  resolveReservationFee,
  toCentavos,
};
