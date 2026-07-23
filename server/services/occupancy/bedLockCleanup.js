/**
 * ============================================================================
 * BED LOCK CLEANUP SERVICE
 * ============================================================================
 *
 * Background job that periodically releases expired bed locks.
 */

import { Room } from "../../models/index.js";
import logger from "../../middleware/logger.js";

async function cleanupExpiredBedLocks() {
  try {
    const rooms = await Room.find({
      "beds.status": "locked",
      isArchived: false,
    });

    let totalUnlocked = 0;

    for (const room of rooms) {
      const unlocked = room.unlockExpiredBeds();
      if (unlocked > 0) {
        await room.save();
        totalUnlocked += unlocked;
      }
    }
  } catch (error) {
    console.error("❌ Bed lock cleanup error:", error);
  }
}

export function startBedLockCleanupJob() {
  logger.warn(
    "startBedLockCleanupJob is deprecated. The canonical scheduler owns bed lock cleanup.",
  );

  if (process.env.NODE_ENV === "production") {
    return () => {};
  }

  cleanupExpiredBedLocks();
  return () => {};
}

export default startBedLockCleanupJob;
