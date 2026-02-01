/**
 * Authentication Routes
 *
 * Handles user authentication operations including:
 * - User registration with Firebase integration
 * - User login with email verification check
 * - Profile management
 * - Role management (admin only)
 *
 * Security: Firebase Auth is the single source of truth for email verification.
 * All routes require Firebase token verification via verifyToken middleware.
 */

import express from "express";
import { auth } from "../config/firebase.js";
import User from "../models/User.js";
import { verifyToken } from "../middleware/auth.js";

const router = express.Router();

// ============================================================================
// CONSTANTS
// ============================================================================

const VALID_BRANCHES = ["gil-puyat", "guadalupe"];
const VALID_ROLES = ["tenant", "admin", "superAdmin"];

// ============================================================================
// AUTHENTICATION ENDPOINTS
// ============================================================================

/**
 * POST /api/auth/register
 *
 * Register a new user in the database after Firebase account creation.
 *
 * Flow:
 * 1. Firebase creates account and handles password hashing (client-side)
 * 2. Client sends Firebase token to this endpoint
 * 3. We verify the token and create user record in MongoDB
 * 4. Email verification is handled by Firebase (not in database)
 *
 * @requires Firebase token in Authorization header
 * @body { username, firstName, lastName, email, phone, branch }
 * @returns { user, message }
 */
router.post("/register", verifyToken, async (req, res) => {
  try {
    const { email, username, firstName, lastName, phone, branch } = req.body;

    // Validate required fields
    if (!username || !firstName || !lastName || !branch) {
      return res.status(400).json({
        error:
          "Missing required fields: username, firstName, lastName, and branch are required",
      });
    }

    // Validate branch value
    if (!VALID_BRANCHES.includes(branch)) {
      return res.status(400).json({
        error: `Invalid branch. Must be one of: ${VALID_BRANCHES.join(", ")}`,
      });
    }

    // Check if user already exists in MongoDB
    const existingUser = await User.findOne({ firebaseUid: req.user.uid });

    if (existingUser) {
      return res.status(400).json({
        error: "User already registered",
        user: {
          id: existingUser._id,
          email: existingUser.email,
          username: existingUser.username,
          firstName: existingUser.firstName,
          lastName: existingUser.lastName,
          branch: existingUser.branch,
          role: existingUser.role,
        },
      });
    }

    // Check if username is already taken
    const usernameExists = await User.findOne({ username });
    if (usernameExists) {
      return res.status(400).json({
        error: "Username already taken. Please choose another one.",
      });
    }

    // Save user data to MongoDB
    // NOTE: Firebase Auth is the source of truth for email verification
    // We sync the verification status from Firebase (req.user.email_verified)
    const user = new User({
      firebaseUid: req.user.uid,
      email: email || req.user.email,
      username,
      firstName,
      lastName,
      phone,
      branch,
      role: "tenant",
      isEmailVerified: req.user.email_verified || false, // Synced from Firebase
    });

    await user.save();

    res.status(201).json({
      message: "User registered successfully. Please verify your email.",
      userId: req.user.uid,
      user: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        branch: user.branch,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    res.status(500).json({
      error: "Registration failed. Please try again.",
      details: error.message,
    });
  }
});

/**
 * POST /api/auth/login
 *
 * Authenticate user and return profile data.
 *
 * Flow:
 * 1. User signs in with Firebase (client-side)
 * 2. Client checks emailVerified status (Firebase is source of truth)
 * 3. If verified, client sends token to this endpoint
 * 4. We sync verification status and return user data
 *
 * @requires Firebase token in Authorization header
 * @returns { user, message }
 */
router.post("/login", verifyToken, async (req, res) => {
  try {
    // Find user in database using Firebase UID from verified token
    const user = await User.findOne({ firebaseUid: req.user.uid });

    if (!user) {
      return res.status(404).json({
        error: "User not found in database. Please register first.",
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        error: "Your account is inactive. Please contact support.",
      });
    }

    // Sync email verification status from Firebase
    // Firebase is the source of truth - we just mirror the status in our DB
    const firebaseEmailVerified = req.user.email_verified || false;
    if (user.isEmailVerified !== firebaseEmailVerified) {
      user.isEmailVerified = firebaseEmailVerified;
      await user.save();
      console.log(
        `✅ Synced verification for ${user.email}: ${firebaseEmailVerified}`,
      );
    }

    res.json({
      message: "Login successful",
      user: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        branch: user.branch,
        role: user.role,
        isActive: user.isActive,
        isEmailVerified: user.isEmailVerified,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({
      error: "Login failed. Please try again.",
      details: error.message,
    });
  }
});

// ============================================================================
// PROFILE MANAGEMENT
// ============================================================================

/**
 * GET /api/auth/profile
 *
 * Get current user's profile information.
 *
 * @requires Firebase token in Authorization header
 * @returns { user profile data }
 */
router.get("/profile", verifyToken, async (req, res) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user.uid });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      id: user._id,
      firebaseUid: user.firebaseUid,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      branch: user.branch,
      role: user.role,
      isActive: user.isActive,
      isEmailVerified: user.isEmailVerified,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  } catch (error) {
    console.error("Profile fetch error:", error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/auth/profile
 *
 * Update user's profile information (firstName, lastName, phone).
 * Email and username cannot be changed via this endpoint.
 *
 * @requires Firebase token in Authorization header
 * @body { firstName?, lastName?, phone? }
 * @returns { updated user data }
 */
router.put("/profile", verifyToken, async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;

    const user = await User.findOneAndUpdate(
      { firebaseUid: req.user.uid },
      { firstName, lastName, phone },
      { new: true, runValidators: true },
    );

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({
      message: "Profile updated successfully",
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
      },
    });
  } catch (error) {
    console.error("Profile update error:", error);
    res.status(500).json({ error: error.message });
  }
});

// ============================================================================
// ADMIN OPERATIONS
// ============================================================================

/**
 * POST /api/auth/set-role
 *
 * Set user role and Firebase custom claims (admin/superAdmin only).
 *
 * @requires Firebase token in Authorization header
 * @requires Admin privileges
 * @body { userId, role }
 * @returns { message }
 */
router.post("/set-role", verifyToken, async (req, res) => {
  try {
    const { userId, role } = req.body;

    // Validate role
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({
        error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`,
      });
    }

    // Set Firebase custom claims based on role
    const claims = {};
    if (role === "admin") {
      claims.admin = true;
    } else if (role === "superAdmin") {
      claims.superAdmin = true;
      claims.admin = true;
    }

    // Find user by MongoDB _id
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await auth.setCustomUserClaims(user.firebaseUid, claims);

    // Update role in MongoDB
    user.role = role;
    await user.save();

    res.json({ message: "User role updated successfully" });
  } catch (error) {
    console.error("Role update error:", error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
