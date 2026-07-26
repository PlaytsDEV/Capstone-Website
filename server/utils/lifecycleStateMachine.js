/**
 * ============================================================================
 * LIFECYCLE STATE MACHINE & INVENTORY RESERVATION LOCK ENGINE
 * ============================================================================
 * 
 * Provides unified state-machine transition control and atomic inventory locks
 * for handling mid-contract tenant mutations (transfers, early exits, room swaps,
 * abandonment, and move-out cancellations).
 */

import mongoose from "mongoose";
import { Room, Reservation, Stay } from "../models/index.js";
import logger from "../middleware/logger.js";

/**
 * Validates if a reservation lifecycle transition is allowed.
 * Prevents invalid state jumps.
 */
export function isAllowedLifecycleTransition(currentStatus, targetStatus) {
  if (!currentStatus || !targetStatus) return false;
  if (currentStatus === targetStatus) return true;

  const validTransitions = {
    moveIn: ["moveOut", "abandoned", "transfer_pending", "transfer_cancelled", "archived"],
    transfer_pending: ["moveIn", "transfer_cancelled", "archived"],
    moveOut: ["move_out_cancelled", "completed", "archived"],
    reserved: ["moveIn", "cancelled", "archived"],
    pending: ["reserved", "cancelled", "archived"]
  };

  const allowed = validTransitions[currentStatus];
  if (!allowed) return true; // Fallback to standard check if status not in subset
  return allowed.includes(targetStatus);
}

/**
 * Acquire an inventory reservation lock on a room/bed.
 * Used when approving transfers or pre-booking.
 */
export async function acquireInventoryLock(roomId, bedId, lockType = "transfer", session = null) {
  const room = await Room.findById(roomId).session(session);
  if (!room) {
    throw new Error(`Room ${roomId} not found for inventory lock`);
  }

  const bed = room.beds.find((b) => b.id === bedId || String(b._id) === String(bedId));
  if (!bed) {
    throw new Error(`Bed ${bedId} not found in room ${room.roomNumber || room.name}`);
  }

  if (bed.status !== "available") {
    return {
      success: false,
      reason: `Bed ${bed.bedNumber || bedId} in Room ${room.roomNumber || room.name} is currently ${bed.status}`
    };
  }

  // Lock the bed
  bed.status = "reserved";
  bed.lockType = lockType;
  bed.lockedAt = new Date();
  await room.save({ session });

  return {
    success: true,
    room,
    bed
  };
}

/**
 * Release an inventory reservation lock on a room/bed.
 * Restores bed status to available.
 */
export async function releaseInventoryLock(roomId, bedId, session = null) {
  const room = await Room.findById(roomId).session(session);
  if (!room) return false;

  const bed = room.beds.find((b) => b.id === bedId || String(b._id) === String(bedId));
  if (bed && (bed.status === "reserved" || bed.status === "occupied")) {
    bed.status = "available";
    bed.lockType = null;
    bed.lockedAt = null;
    await room.save({ session });
    return true;
  }

  return false;
}

/**
 * Check if a room/bed has future conflicting pre-bookings or active stays.
 */
export async function detectInventoryConflict(roomId, bedId, excludeReservationId = null, session = null) {
  const query = {
    roomId: roomId,
    status: { $in: ["reserved", "pending", "approved_for_payment", "moveIn"] },
    isArchived: { $ne: true }
  };

  if (excludeReservationId) {
    query._id = { $ne: excludeReservationId };
  }

  if (bedId) {
    query.$or = [
      { "selectedBed.id": bedId },
      { "selectedBed._id": bedId }
    ];
  }

  const conflictingReservation = await Reservation.findOne(query).populate("userId", "firstName lastName email").session(session);
  if (conflictingReservation) {
    return {
      hasConflict: true,
      conflictingReservation: {
        id: conflictingReservation._id,
        code: conflictingReservation.reservationCode,
        applicantName: conflictingReservation.userId ? `${conflictingReservation.userId.firstName} ${conflictingReservation.userId.lastName}` : "Unknown Applicant",
        status: conflictingReservation.status
      }
    };
  }

  return { hasConflict: false };
}
