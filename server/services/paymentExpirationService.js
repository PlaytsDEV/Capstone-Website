import { Reservation, Room } from "../models/index.js";
import logger from "../middleware/logger.js";
import { notify } from "../utils/notificationService.js";

/**
 * Sweeps all reservations where the 24-hour deposit payment window has expired.
 * Releases held beds back to available and cancels stagnant reservations.
 *
 * @returns {Promise<{ expiredCount: number }>}
 */
export async function checkAndReleaseExpiredPaymentHolds() {
  try {
    const now = new Date();
    const expiredReservations = await Reservation.find({
      paymentExpiresAt: { $lte: now },
      paymentStatus: "pending",
      status: { $in: ["approved_for_payment", "approved", "pending", "pending_application_review"] },
      isArchived: { $ne: true },
    }).populate("roomId");

    let expiredCount = 0;

    for (const reservation of expiredReservations) {
      reservation.status = "cancelled";
      reservation.cancelledAt = now;
      reservation.cancellationSource = "system";
      reservation.cancellationReason = "Reservation Fee payment window expired (24 hours)";
      await reservation.save();

      // Release bed lock if held
      if (reservation.roomId && reservation.selectedBed?.id) {
        try {
          const room = await Room.findById(reservation.roomId._id || reservation.roomId);
          if (room) {
            const bed = room.beds.find((b) => b.id === reservation.selectedBed.id);
            if (
              bed &&
              (bed.status === "locked" || bed.status === "reserved") &&
              (String(bed.lockedBy) === String(reservation.userId) ||
                String(bed.occupiedBy?.reservationId) === String(reservation._id) ||
                String(bed.occupiedBy?.userId) === String(reservation.userId))
            ) {
              bed.status = "available";
              bed.lockedBy = null;
              bed.lockExpiresAt = null;
              bed.occupiedBy = null;
              await room.save();
            }
          }
        } catch (roomErr) {
          logger.warn({ err: roomErr }, "Error releasing bed lock for expired payment hold");
        }
      }

      // Send tenant notification
      if (reservation.userId) {
        try {
          await notify.general(
            reservation.userId._id || reservation.userId,
            "Reservation Hold Expired",
            "Your 24-hour Reservation Fee payment window has expired and your temporary room hold has been released.",
            { entityType: "reservation", entityId: String(reservation._id) }
          );
        } catch (notifyErr) {
          logger.warn({ err: notifyErr }, "Error notifying tenant of expired payment hold");
        }
      }

      expiredCount++;
    }

    if (expiredCount > 0) {
      logger.info({ expiredCount }, "Processed expired deposit payment holds");
    }

    return { expiredCount };
  } catch (error) {
    logger.error({ err: error }, "Failed to sweep expired payment holds");
    return { expiredCount: 0, error: error.message };
  }
}
