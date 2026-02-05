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
import { Reservation, User, Room } from "../models/index.js";
import { verifyToken, verifyAdmin, verifyUser } from "../middleware/auth.js";
import { filterByBranch } from "../middleware/branchAccess.js";

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
router.get("/", verifyToken, async (req, res) => {
  try {
    const user = req.user;

    // Find user in database to get role and branch
    const dbUser = await User.findOne({ firebaseUid: user.uid });

    if (!dbUser) {
      return res.status(404).json({
        error: "User not found in database",
        code: "USER_NOT_FOUND",
      });
    }

    let reservations;

    // Super admin sees all reservations
    if (dbUser.role === "superAdmin") {
      reservations = await Reservation.find()
        .populate("userId", "firstName lastName email")
        .populate("roomId", "name branch type price")
        .select("-__v")
        .sort({ createdAt: -1 });
    }
    // Admin sees reservations for rooms in their branch
    else if (dbUser.role === "admin") {
      // First get all rooms for the admin's branch
      const branchRooms = await Room.find({ branch: dbUser.branch }).select(
        "_id",
      );
      const roomIds = branchRooms.map((room) => room._id);

      reservations = await Reservation.find({ roomId: { $in: roomIds } })
        .populate("userId", "firstName lastName email")
        .populate("roomId", "name branch type price")
        .select("-__v")
        .sort({ createdAt: -1 });
    }
    // Regular users/tenants see only their own reservations
    else {
      reservations = await Reservation.find({ userId: dbUser._id })
        .populate("userId", "firstName lastName email")
        .populate("roomId", "name branch type price")
        .select("-__v")
        .sort({ createdAt: -1 });
    }

    console.log(
      `✅ Retrieved ${reservations.length} reservations for ${dbUser.email} (${dbUser.role})`,
    );
    res.json(reservations);
  } catch (error) {
    console.error("❌ Fetch reservations error:", error);
    res.status(500).json({
      error: "Failed to fetch reservations",
      details: error.message,
      code: "FETCH_RESERVATIONS_ERROR",
    });
  }
});

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
router.post("/", verifyToken, verifyUser, async (req, res) => {
  try {
    // Find user in database
    const dbUser = await User.findOne({ firebaseUid: req.user.uid });

    if (!dbUser) {
      return res.status(404).json({
        error:
          "User not found in database. Please complete registration first.",
        code: "USER_NOT_FOUND",
      });
    }

    // Validate required fields
    const { roomId, roomName, checkInDate, totalPrice } = req.body;

    if ((!roomId && !roomName) || !checkInDate || !totalPrice) {
      return res.status(400).json({
        error:
          "Missing required fields: roomId or roomName, checkInDate, and totalPrice are required",
        code: "MISSING_REQUIRED_FIELDS",
      });
    }

    // Verify room exists - look up by ID or name
    let room;
    if (roomId) {
      room = await Room.findById(roomId);
    } else if (roomName) {
      room = await Room.findOne({ name: roomName });
    }

    if (!room) {
      return res.status(404).json({
        error: "Room not found",
        code: "ROOM_NOT_FOUND",
      });
    }

    // Check if room is available
    if (!room.available) {
      return res.status(400).json({
        error: "Room is not available for reservation",
        code: "ROOM_NOT_AVAILABLE",
      });
    }

    // Create new reservation with room's ObjectId
    const reservation = new Reservation({
      userId: dbUser._id,
      roomId: room._id, // Use the actual room ObjectId
      checkInDate: req.body.checkInDate,
      checkOutDate: req.body.checkOutDate || null,
      totalPrice: req.body.totalPrice,
      notes: req.body.notes || "",
      status: "pending",
    });

    // Save reservation to database
    await reservation.save();

    // Populate user and room details for response
    await reservation.populate("userId", "firstName lastName email");
    await reservation.populate("roomId", "name branch type price");

    console.log(
      `✅ Reservation created: ${reservation._id} for ${dbUser.email}`,
    );
    res.status(201).json({
      message: "Reservation created successfully",
      reservationId: reservation._id,
      reservation,
    });
  } catch (error) {
    console.error("❌ Create reservation error:", error);

    // Handle validation errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: "Validation failed",
        details: error.message,
        code: "VALIDATION_ERROR",
      });
    }

    // Handle cast errors (invalid IDs)
    if (error.name === "CastError") {
      return res.status(400).json({
        error: "Invalid ID format",
        details: error.message,
        code: "INVALID_ID_FORMAT",
      });
    }

    res.status(500).json({
      error: "Failed to create reservation",
      details: error.message,
      code: "CREATE_RESERVATION_ERROR",
    });
  }
});

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
  async (req, res) => {
    try {
      const { reservationId } = req.params;

      // Validate reservationId format
      if (!reservationId.match(/^[0-9a-fA-F]{24}$/)) {
        return res.status(400).json({
          error: "Invalid reservation ID format",
          code: "INVALID_RESERVATION_ID",
        });
      }

      // Find reservation first to check branch access
      const existingReservation = await Reservation.findById(
        reservationId,
      ).populate("roomId", "branch");

      if (!existingReservation) {
        return res.status(404).json({
          error: "Reservation not found",
          code: "RESERVATION_NOT_FOUND",
        });
      }

      // Check branch access (admin can only update reservations for rooms in their branch)
      if (
        req.branchFilter &&
        existingReservation.roomId?.branch !== req.branchFilter
      ) {
        return res.status(403).json({
          error: `Access denied. You can only manage reservations for ${req.branchFilter} branch.`,
          code: "BRANCH_ACCESS_DENIED",
        });
      }

      // Update reservation and return the updated document
      const reservation = await Reservation.findByIdAndUpdate(
        reservationId,
        req.body,
        {
          new: true,
          runValidators: true,
        },
      )
        .populate("userId", "firstName lastName email")
        .populate("roomId", "name branch type price");

      console.log(
        `✅ Reservation updated: ${reservation._id} - Status: ${reservation.status}`,
      );
      res.json({
        message: "Reservation updated successfully",
        reservation,
      });
    } catch (error) {
      console.error("❌ Update reservation error:", error);

      // Handle validation errors
      if (error.name === "ValidationError") {
        return res.status(400).json({
          error: "Validation failed",
          details: error.message,
          code: "VALIDATION_ERROR",
        });
      }

      // Handle cast errors (invalid ID)
      if (error.name === "CastError") {
        return res.status(400).json({
          error: "Invalid reservation ID format",
          code: "INVALID_RESERVATION_ID",
        });
      }

      res.status(500).json({
        error: "Failed to update reservation",
        details: error.message,
        code: "UPDATE_RESERVATION_ERROR",
      });
    }
  },
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
