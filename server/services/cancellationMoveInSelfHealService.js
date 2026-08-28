import logger from "../middleware/logger.js";
import { Reservation } from "../models/index.js";
import { autoGenerateMoveInContract } from "./autoContractOrchestratorService.js";

/**
 * Scans for reservations that reached 'moveIn' status while still having
 * a pending cancellation request flag, and heals them safely.
 */
export async function healDanglingMovedInCancellations() {
  try {
    const dangling = await Reservation.find({
      status: "moveIn",
      cancellationRequested: true,
      cancellationStatus: "pending",
    });

    if (!dangling || dangling.length === 0) {
      return { healedCount: 0 };
    }

    logger.info(
      { count: dangling.length },
      "[SelfHeal] Found moved-in reservations with open cancellation flags. Healing...",
    );

    let healedCount = 0;
    for (const res of dangling) {
      res.cancellationRequested = false;
      res.cancellationStatus = "dismissed_on_movein";
      res.cancellationAdminNote = "Auto-dismissed: Tenant successfully moved in.";
      res.cancellationReviewedAt = new Date();
      await res.save();
      healedCount++;

      // Trigger contract auto-generation in background
      try {
        await autoGenerateMoveInContract({
          reservationId: res._id,
          actualMoveInDate: res.confirmedMoveInDate || res.moveInDate,
          actorId: res.userId,
        });
      } catch (contractErr) {
        logger.warn(
          { err: contractErr, reservationId: res._id },
          "[SelfHeal] Move-in contract generation retry had warning (non-fatal)",
        );
      }
    }

    return { healedCount };
  } catch (error) {
    logger.error({ err: error }, "[SelfHeal] Error healing dangling cancellation requests");
    return { healedCount: 0, error: error.message };
  }
}
