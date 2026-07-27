import { Reservation } from "../models/index.js";
import { updateOccupancyOnReservationChange } from "./occupancy/occupancyManager.js";

const PROCESSING_LEASE_MS = 60_000;

export async function reconcileReservationPayment(
  reservationOrId,
  { occupancyUpdater = updateOccupancyOnReservationChange, now = new Date() } = {},
) {
  const reservationId = reservationOrId?._id || reservationOrId;
  const leaseExpiry = new Date(now.getTime() - PROCESSING_LEASE_MS);
  const reservation = await Reservation.findOneAndUpdate(
    {
      _id: reservationId,
      paymentStatus: "paid",
      paymentVerificationSource: { $in: ["paymongo_webhook", "offline_exception"] },
      $or: [
        { occupancySyncStatus: { $in: ["pending", "failed"] } },
        {
          occupancySyncStatus: "processing",
          reconciliationStartedAt: { $lte: leaseExpiry },
        },
      ],
    },
    {
      $set: {
        paymentReconciliationStatus: "processing",
        occupancySyncStatus: "processing",
        reconciliationStartedAt: now,
        reconciliationError: "",
      },
      $inc: { reconciliationAttempts: 1 },
    },
    { new: true },
  ).populate("roomId", "name branch beds");

  if (!reservation) {
    const existing = await Reservation.findById(reservationId);
    if (!existing) {
      return { status: "not_found", reservation: null };
    }
    return {
      status: existing.occupancySyncStatus === "completed"
        ? "completed"
        : "in_progress",
      reservation: existing,
    };
  }

  try {
    await occupancyUpdater(reservation, { status: "payment_pending" });
    reservation.paymentReconciliationStatus = "completed";
    reservation.occupancySyncStatus = "completed";
    reservation.reconciliationCompletedAt = new Date();
    reservation.reconciliationError = "";
    await reservation.save();
    return { status: "completed", reservation };
  } catch (error) {
    reservation.paymentReconciliationStatus = "failed";
    reservation.occupancySyncStatus = "failed";
    reservation.reconciliationError = String(error.code || error.message || "OCCUPANCY_SYNC_FAILED")
      .slice(0, 500);
    await reservation.save().catch(() => {});
    return { status: "failed", reservation, error };
  }
}
