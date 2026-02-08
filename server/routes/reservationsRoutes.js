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
  deleteReservation,
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
router.put("/:reservationId", verifyToken, verifyAdmin, filterByBranch, updateReservation);

/**
 * DELETE /api/reservations/:reservationId
 *
 * Delete an existing reservation.
 *
 * Access: Admin (must be from room's branch) | Super Admin (any reservation)
 *
 * @param {string} reservationId - MongoDB ObjectId of the reservation
 * @returns {Object} Success message with deleted reservation ID
 */
router.delete("/:reservationId", verifyToken, verifyAdmin, filterByBranch, deleteReservation);

export default router;
