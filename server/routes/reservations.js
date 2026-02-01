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
import Reservation from "../models/Reservation.js";
import User from "../models/User.js";
import Room from "../models/Room.js";
import { verifyToken, verifyAdmin } from "../middleware/auth.js";

const router = express.Router();

/**
 * GET /api/reservations
 *
 * Retrieve reservations based on user role:
 * - Admin: Get all reservations
 * - Tenant: Get only their own reservations
 *
 * Access: Authenticated users only
 *
 * @returns {Array} List of reservations with populated user and room data
 */
router.get("/", verifyToken, async (req, res) => {
  try {
    const user = req.user;
    let filter = {};

    // If user is not an admin, only show their own reservations
    if (!user.admin) {
      // Find user in database to get MongoDB _id
      const dbUser = await User.findOne({ firebaseUid: user.uid });

      if (!dbUser) {
        return res.status(404).json({
          error: "User not found in database",
          code: "USER_NOT_FOUND",
        });
      }

      // Filter reservations by user ID
      filter.userId = dbUser._id;
    }

    // Fetch reservations with populated user and room details
    const reservations = await Reservation.find(filter)
      .populate("userId", "firstName lastName email") // Include user info
      .populate("roomId", "name branch type price") // Include room info
      .select("-__v") // Exclude version key
      .sort({ createdAt: -1 }); // Newest first

    console.log(
      `✅ Retrieved ${reservations.length} reservations for user: ${user.email || user.uid}`,
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
router.post("/", verifyToken, async (req, res) => {
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
    const { roomId, checkInDate, totalPrice } = req.body;

    if (!roomId || !checkInDate || !totalPrice) {
      return res.status(400).json({
        error:
          "Missing required fields: roomId, checkInDate, and totalPrice are required",
        code: "MISSING_REQUIRED_FIELDS",
      });
    }

    // Verify room exists
    const room = await Room.findById(roomId);
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

    // Create new reservation
    const reservation = new Reservation({
      ...req.body,
      userId: dbUser._id,
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
 * Access: Admin only
 *
 * @param {string} reservationId - MongoDB ObjectId of the reservation
 * @body {Object} Updated reservation data
 * @returns {Object} Updated reservation with success message
 */
router.put("/:reservationId", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { reservationId } = req.params;

    // Validate reservationId format
    if (!reservationId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: "Invalid reservation ID format",
        code: "INVALID_RESERVATION_ID",
      });
    }

    // Update reservation and return the updated document
    const reservation = await Reservation.findByIdAndUpdate(
      reservationId,
      req.body,
      {
        new: true, // Return updated document
        runValidators: true, // Validate against schema
      },
    )
      .populate("userId", "firstName lastName email")
      .populate("roomId", "name branch type price");

    if (!reservation) {
      return res.status(404).json({
        error: "Reservation not found",
        code: "RESERVATION_NOT_FOUND",
      });
    }

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
});

export default router;
