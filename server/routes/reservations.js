/**
 * =============================================================================
 * RESERVATION MANAGEMENT ROUTES
 * =============================================================================
 *
 * Routes for managing room reservations and bookings.
 *
 * Available Endpoints:
 * - GET /api/reservations - Get reservations (all for admin, own for tenants)
 * - POST /api/reservations - Create new reservation (authenticated users)
 * - PUT /api/reservations/:reservationId - Update reservation status (admin only)
 *
 * Business Rules:
 * - Tenants can only view their own reservations
 * - Admins can view and manage all reservations
 * - Only admins can update reservation status
 */

import express from "express";
import { verifyToken, verifyAdmin, verifyUser } from "../middleware/auth.js";
import { filterByBranch } from "../middleware/branchAccess.js";
import {
  getReservations,
  createReservation,
  updateReservation,
} from "../controllers/reservationsController.js";

const router = express.Router();

/**
 * GET /api/reservations
 *
 * Retrieve reservations based on user role:
 * - Admin: Get all reservations for their branch
 * - Super Admin: Get all reservations
 * - Tenant: Get only their own reservations
 *
 * Access: Authenticated users only
 *
 * @returns {Array} List of reservations with populated user and room data
 */
router.get("/", verifyToken, getReservations);

/**
 * POST /api/reservations
 *
 * Create a new reservation for the authenticated user.
 *
 * Access: Authenticated users (tenants and admins)
 *
 * @body {Object} Reservation data (roomId, checkInDate, checkOutDate, etc.)
 * @returns {Object} Created reservation with success message
 */
router.post("/", verifyToken, verifyUser, createReservation);

/**
 * PUT /api/reservations/:reservationId
 *
 * Update an existing reservation (status, payment, notes, etc.).
 *
 * Access: Admin (must be from room's branch) | Super Admin (any reservation)
 *
 * @param {string} reservationId - MongoDB ObjectId of the reservation
 * @body {Object} Updated reservation data
 * @returns {Object} Updated reservation with success message
 */
router.put(
  "/:reservationId",
  verifyToken,
  verifyAdmin,
  filterByBranch,
  updateReservation,
);

/**
 * DELETE /api/reservations/:reservationId
 *
 * Delete a reservation (admin only)
 *
 * Access: Admin only
 *
 * @param {string} reservationId - Reservation ID to delete
 * @returns {Object} Success message
 */
router.delete("/:reservationId", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { reservationId } = req.params;
    const user = req.user;

    // Get user from database to check branch
    const dbUser = await User.findOne({ firebaseUid: user.uid });

    if (!dbUser) {
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    // Find reservation
    const reservation = await Reservation.findById(reservationId);

    if (!reservation) {
      return res.status(404).json({
        error: "Reservation not found",
        code: "RESERVATION_NOT_FOUND",
      });
    }

    // Check branch access (non-super-admin can only manage their branch)
    if (dbUser.role !== "super-admin" && dbUser.role !== "superAdmin") {
      const room = await Room.findById(reservation.roomId);

      if (!room || room.branch !== dbUser.branch) {
        return res.status(403).json({
          error: "Unauthorized to delete this reservation",
          code: "UNAUTHORIZED_BRANCH",
        });
      }
    }

    // Delete the reservation
    await Reservation.findByIdAndDelete(reservationId);

    res.json({
      message: "Reservation deleted successfully",
      reservationId: reservationId,
    });
  } catch (error) {
    console.error("❌ Error deleting reservation:", error);

    // Handle cast errors (invalid ID)
    if (error.name === "CastError") {
      return res.status(400).json({
        error: "Invalid reservation ID format",
        code: "INVALID_RESERVATION_ID",
      });
    }

    res.status(500).json({
      error: "Failed to delete reservation",
      details: error.message,
      code: "DELETE_RESERVATION_ERROR",
    });
  }
});

export default router;
