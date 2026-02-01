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
    if (!username || !firstName || !lastName) {
      return res.status(400).json({
        error:
          "Missing required fields: username, firstName, and lastName are required",
        code: "MISSING_REQUIRED_FIELDS",
      });
    }

    // Validate branch value (only if provided)
    // Allow empty branch for Gmail users - they will select via modal after login
    if (branch && !VALID_BRANCHES.includes(branch)) {
      return res.status(400).json({
        error: `Invalid branch. Must be one of: ${VALID_BRANCHES.join(", ")}`,
        code: "INVALID_BRANCH",
      });
    }

    // Check if user already exists in MongoDB
    const existingUser = await User.findOne({ firebaseUid: req.user.uid });

    if (existingUser) {
      console.log(`⚠️ User already registered: ${existingUser.email}`);
      return res.status(400).json({
        error: "User already registered",
        code: "USER_ALREADY_EXISTS",
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
        code: "USERNAME_TAKEN",
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

    console.log(
      `✅ User registered successfully: ${user.email} (${user.branch})`,
    );
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
    console.error("❌ Registration error:", error);

    // Handle duplicate key errors (email or username already exists)
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern)[0];
      return res.status(400).json({
        error: `${field.charAt(0).toUpperCase() + field.slice(1)} already exists`,
        code: "DUPLICATE_FIELD",
      });
    }

    // Handle validation errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: "Validation failed",
        details: error.message,
        code: "VALIDATION_ERROR",
      });
    }

    res.status(500).json({
      error: "Registration failed. Please try again.",
      details: error.message,
      code: "REGISTRATION_ERROR",
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
      console.log(`❌ User not found in database: ${req.user.uid}`);
      return res.status(404).json({
        error: "User not found in database. Please register first.",
        code: "USER_NOT_FOUND",
      });
    }

    // Check if account is active
    if (!user.isActive) {
      console.log(`⚠️ Inactive account login attempt: ${user.email}`);
      return res.status(403).json({
        error: "Your account is inactive. Please contact support.",
        code: "ACCOUNT_INACTIVE",
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

    console.log(`✅ Login successful: ${user.email} (${user.role})`);
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
    console.error("❌ Login error:", error);
    res.status(500).json({
      error: "Login failed. Please try again.",
      details: error.message,
      code: "LOGIN_ERROR",
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
      console.log(`❌ Profile not found for Firebase UID: ${req.user.uid}`);
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    console.log(`✅ Profile fetched: ${user.email}`);
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
    console.error("❌ Profile fetch error:", error);
    res.status(500).json({
      error: "Failed to fetch profile",
      details: error.message,
      code: "PROFILE_FETCH_ERROR",
    });
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

    // Validate at least one field is provided
    if (!firstName && !lastName && !phone) {
      return res.status(400).json({
        error:
          "At least one field (firstName, lastName, or phone) must be provided",
        code: "NO_UPDATE_DATA",
      });
    }

    // Build update object with only provided fields
    const updateData = {};
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (phone !== undefined) updateData.phone = phone;

    const user = await User.findOneAndUpdate(
      { firebaseUid: req.user.uid },
      updateData,
      { new: true, runValidators: true },
    );

    if (!user) {
      console.log(`❌ User not found for update: ${req.user.uid}`);
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    console.log(`✅ Profile updated: ${user.email}`);
    res.json({
      message: "Profile updated successfully",
      user: {},
    });
  } catch (error) {
    console.error("❌ Profile update error:", error);

    // Handle validation errors
    if (error.name === "ValidationError") {
      return res.status(400).json({
        error: "Validation failed",
        details: error.message,
        code: "VALIDATION_ERROR",
      });
    }

    res.status(500).json({
      error: "Failed to update profile",
      details: error.message,
      code: "PROFILE_UPDATE_ERROR",
    });
  }
});

/**
 * PATCH /api/auth/update-branch
 *
 * Update user's branch (for Gmail login branch selection).
 * This endpoint allows users to select their branch after Gmail login.
 *
 * @requires Firebase token in Authorization header
 * @body { branch: 'gil-puyat' | 'guadalupe' }
 * @returns { updated user data }
 */
router.patch("/update-branch", verifyToken, async (req, res) => {
  try {
    const { branch } = req.body;

    // Validate branch value
    if (!branch) {
      return res.status(400).json({
        error: "Branch is required",
        code: "MISSING_BRANCH",
      });
    }

    if (!["gil-puyat", "guadalupe"].includes(branch)) {
      return res.status(400).json({
        error: "Invalid branch. Must be 'gil-puyat' or 'guadalupe'",
        code: "INVALID_BRANCH",
      });
    }

    // Update user's branch
    const user = await User.findOneAndUpdate(
      { firebaseUid: req.user.uid },
      { branch },
      { new: true, runValidators: true },
    );

    if (!user) {
      console.log(`❌ User not found for branch update: ${req.user.uid}`);
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    console.log(`✅ Branch updated for ${user.email}: ${branch}`);
    res.json({
      message: "Branch updated successfully",
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
    console.error("❌ Branch update error:", error);
    res.status(500).json({
      error: "Failed to update branch",
      details: error.message,
      code: "BRANCH_UPDATE_ERROR",
    });
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

    // Validate required fields
    if (!userId || !role) {
      return res.status(400).json({
        error: "Missing required fields: userId and role are required",
        code: "MISSING_REQUIRED_FIELDS",
      });
    }

    // Validate role
    if (!VALID_ROLES.includes(role)) {
      return res.status(400).json({
        error: `Invalid role. Must be one of: ${VALID_ROLES.join(", ")}`,
        code: "INVALID_ROLE",
      });
    }

    // Validate userId format
    if (!userId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        error: "Invalid user ID format",
        code: "INVALID_USER_ID",
      });
    }

    // Set Firebase custom claims based on role
    const claims = {};
    if (role === "admin") {
      claims.admin = true;
    } else if (role === "superAdmin") {
      claims.superAdmin = true;
      claims.admin = true; // SuperAdmins also have admin privileges
    }

    // Find user by MongoDB _id
    const user = await User.findById(userId);
    if (!user) {
      console.log(`❌ User not found for role update: ${userId}`);
      return res.status(404).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    // Set custom claims in Firebase Auth
    // This allows the user to have admin/superAdmin access on the frontend
    await auth.setCustomUserClaims(user.firebaseUid, claims);

    // Update role in MongoDB database
    user.role = role;
    await user.save();

    console.log(`✅ User role updated: ${user.email} → ${role}`);
    res.json({
      message: "User role updated successfully",
      user: {
        id: user._id,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("❌ Role update error:", error);

    // Handle Firebase errors
    if (error.code && error.code.startsWith("auth/")) {
      return res.status(400).json({
        error: "Firebase error: " + error.message,
        code: "FIREBASE_ERROR",
      });
    }

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
        error: "Invalid user ID format",
        code: "INVALID_USER_ID",
      });
    }

    res.status(500).json({
      error: "Failed to update user role",
      details: error.message,
      code: "ROLE_UPDATE_ERROR",
    });
  }
});

export default router;
