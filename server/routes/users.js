/**
 * =============================================================================
 * USER MANAGEMENT ROUTES
 * =============================================================================
 *
 * Admin-only routes for managing users in the system.
 *
 * Available Endpoints:
 * - GET /api/users - Get all users
 * - GET /api/users/:userId - Get specific user by ID
 *
 * All routes require:
 * - Firebase authentication (verifyToken)
 * - Admin privileges (verifyAdmin)
 */

import express from "express";
import User from "../models/User.js";
import { verifyToken, verifyAdmin } from "../middleware/auth.js";

const router = express.Router();

/**
 * GET /api/users/email-by-username
 *
 * Get user email by username (for login with username).
 * This endpoint is public to allow username-based login.
 *
 * @query {string} username - Username to lookup
 * @returns {Object} { email: string }
 */
router.get("/email-by-username", async (req, res) => {
  try {
    const { username } = req.query;

    if (!username) {
      return res.status(400).json({
        error: "Username is required",
        code: "MISSING_USERNAME",
      });
    }

    // Trim and convert to lowercase for case-insensitive search
    const trimmedUsername = username.trim();

    console.log(`🔍 Looking up username: "${trimmedUsername}"`);

    // Find user by username (case-insensitive), only return email
    const user = await User.findOne({
      username: { $regex: new RegExp(`^${trimmedUsername}$`, "i") },
    }).select("email username");

    if (!user) {
      console.log(`❌ Username not found: "${trimmedUsername}"`);
      return res.status(404).json({
        error: "Username not found",
        code: "USERNAME_NOT_FOUND",
      });
    }

    console.log(
      `✅ Email lookup for username: ${trimmedUsername} -> ${user.email}`,
    );
    res.json({ email: user.email });
  } catch (error) {
    console.error("❌ Username lookup error:", error);
    res.status(500).json({
      error: "Failed to lookup username",
      details: error.message,
      code: "USERNAME_LOOKUP_ERROR",
    });
  }
});

/**
 * GET /api/users
 *
 * Retrieve all users from the database.
 *
 * Access: Admin only
 *
 * @returns {Array} List of all users (without __v field)
 */
router.get("/", verifyToken, verifyAdmin, async (req, res) => {
  try {
    // Fetch all users, excluding the version key (__v)
    const users = await User.find({}).select("-__v");

    console.log(`✅ Retrieved ${users.length} users`);
    res.json(users);
  } catch (error) {
    console.error("❌ Fetch users error:", error);

    // Return appropriate error message
    res.status(500).json({
      error: "Failed to fetch users",
      details: error.message,
      code: "FETCH_USERS_ERROR",
    });
  }
});

/**
 * GET /api/users/:userId
 *
 * Retrieve a specific user by their MongoDB ID.
 *
 * Access: Admin only
 *
 * @param {string} userId - MongoDB ObjectId of the user
 * @returns {Object} User data (without __v field)
 */
router.get("/:userId", verifyToken, verifyAdmin, async (req, res) => {
  try {
    const { userId } = req.params;

    // Validate userId format (MongoDB ObjectId)
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: "Invalid user ID format",
        code: "INVALID_USER_ID",
      });
    }

    // Find user by ID, excluding version key
    const user = await User.findById(userId).select("-__v");

    if (!user) {
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    console.log(`✅ Retrieved user: ${user.email}`);
    res.json(user);
  } catch (error) {
    console.error("❌ Fetch user error:", error);

    // Handle specific MongoDB errors
    if (error.name === "CastError") {
      return res.status(400).json({
        error: "Invalid user ID format",
        code: "INVALID_USER_ID",
      });
    }

    res.status(500).json({
      error: "Failed to fetch user",
      details: error.message,
      code: "FETCH_USER_ERROR",
    });
  }
});

export default router;
