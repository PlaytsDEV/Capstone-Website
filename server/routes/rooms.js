/**
 * =============================================================================
 * ROOM MANAGEMENT ROUTES
 * =============================================================================
 *
 * Routes for managing dormitory rooms across both branches.
 *
 * Available Endpoints:
 * - GET /api/rooms - Get all rooms (with optional filters) - Public
 * - POST /api/rooms - Create new room - Admin only
 * - PUT /api/rooms/:roomId - Update room - Admin only
 * - DELETE /api/rooms/:roomId - Delete room - Admin only
 *
 * Public routes: GET (anyone can view available rooms)
 * Protected routes: POST, PUT, DELETE (require admin authentication)
 */

import express from "express";
import Room from "../models/Room.js";
import { verifyToken, verifyAdmin } from "../middleware/auth.js";

const router = express.Router();

/**
 * GET /api/rooms
 *
 * Retrieve all rooms with optional filtering.
 *
 * Access: Public (no authentication required)
 *
 * Query Parameters:
 * @param {string} branch - Filter by branch ("gil-puyat" or "guadalupe")
 * @param {string} type - Filter by room type ("private", "double-sharing", "quadruple-sharing")
 * @param {string} available - Filter by availability ("true" or "false")
 *
 * @returns {Array} List of rooms matching the filters
 */
router.get("/", async (req, res) => {
  try {
    // Extract query parameters for filtering
    const { branch, type, available } = req.query;
    const filter = {};

    // Build filter object based on provided query parameters
    if (branch) {
      filter.branch = branch;
    }
    if (type) {
      filter.type = type;
    }
    if (available !== undefined) {
      filter.available = available === "true";
    }

    // Fetch rooms matching the filter, excluding version key
    const rooms = await Room.find(filter).select("-__v");

    console.log(`✅ Retrieved ${rooms.length} rooms with filter:`, filter);
    res.json(rooms);
  } catch (error) {
    console.error("❌ Fetch rooms error:", error);
    res.status(500).json({
      error: "Failed to fetch rooms",
      details: error.message,
      code: "FETCH_ROOMS_ERROR",
    });
  }
});

/**
 * POST /api/rooms
 *
 * Create a new room in the system.
 *
 * Access: Admin only
 *
 * @body {Object} Room data (name, branch, type, capacity, price, etc.)
 * @returns {Object} Created room with success message
 */
router.post("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    // Validate required fields
    const { name, branch, type, capacity, price } = req.body;

    if (!name || !branch || !type || !capacity || !price) {
      return res.status(400).json({
        error:
          "Missing required fields: name, branch, type, capacity, and price are required",
        code: "MISSING_REQUIRED_FIELDS",
      });
    }

    // Create new room instance
    const room = new Room(req.body);

    // Save to database
    await room.save();

    console.log(`✅ Room created: ${room.name} (${room._id})`);
    res.status(201).json({
      message: "Room created successfully",
      roomId: room._id,
      room,
    });
  } catch (error) {
    console.error("❌ Create room error:", error);

    // Handle validation errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: "Validation failed",
        details: error.message,
        code: "VALIDATION_ERROR",
      });
    }

    res.status(500).json({
      error: "Failed to create room",
      details: error.message,
      code: "CREATE_ROOM_ERROR",
    });
  }
});

/**
 * PUT /api/rooms/:roomId
 *
 * Update an existing room's information.
 *
 * Access: Admin only
 *
 * @param {string} roomId - MongoDB ObjectId of the room
 * @body {Object} Updated room data
 * @returns {Object} Updated room with success message
 */
router.put("/:roomId", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { roomId } = req.params;

    // Validate roomId format
    if (!roomId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: "Invalid room ID format",
        code: "INVALID_ROOM_ID",
      });
    }

    // Update room and return the updated document
    // runValidators: true ensures schema validation on update
    const room = await Room.findByIdAndUpdate(roomId, req.body, {
      new: true, // Return updated document
      runValidators: true, // Validate against schema
    });

    if (!room) {
      return res.status(404).json({
        error: "Room not found",
        code: "ROOM_NOT_FOUND",
      });
    }

    console.log(`✅ Room updated: ${room.name} (${room._id})`);
    res.json({
      message: "Room updated successfully",
      room,
    });
  } catch (error) {
    console.error("❌ Update room error:", error);

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
        error: "Invalid room ID format",
        code: "INVALID_ROOM_ID",
      });
    }

    res.status(500).json({
      error: "Failed to update room",
      details: error.message,
      code: "UPDATE_ROOM_ERROR",
    });
  }
});

/**
 * DELETE /api/rooms/:roomId
 *
 * Delete a room from the system.
 *
 * Access: Admin only
 *
 * IMPORTANT: This permanently deletes the room.
 * Consider implementing soft delete (isActive flag) instead.
 *
 * @param {string} roomId - MongoDB ObjectId of the room
 * @returns {Object} Success message
 */
router.delete("/:roomId", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { roomId } = req.params;

    // Validate roomId format
    if (!roomId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: "Invalid room ID format",
        code: "INVALID_ROOM_ID",
      });
    }

    // Delete the room
    const room = await Room.findByIdAndDelete(roomId);

    if (!room) {
      return res.status(404).json({
        error: "Room not found",
        code: "ROOM_NOT_FOUND",
      });
    }

    console.log(`✅ Room deleted: ${room.name} (${room._id})`);
    res.json({
      message: "Room deleted successfully",
      deletedRoom: {
        id: room._id,
        name: room.name,
      },
    });
  } catch (error) {
    console.error("❌ Delete room error:", error);

    // Handle cast errors (invalid ID)
    if (error.name === "CastError") {
      return res.status(400).json({
        error: "Invalid room ID format",
        code: "INVALID_ROOM_ID",
      });
    }

    res.status(500).json({
      error: "Failed to delete room",
      details: error.message,
      code: "DELETE_ROOM_ERROR",
    });
  }
});

export default router;
