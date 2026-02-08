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
import { verifyToken, verifyAdmin } from "../middleware/auth.js";
import {
  register,
  login,
  getProfile,
  updateProfile,
  updateBranch,
  setRole,
} from "../controllers/authController.js";

const router = express.Router();

// ============================================================================
// CONSTANTS
// ============================================================================

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
router.post("/register", verifyToken, register);

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
router.post("/login", verifyToken, login);

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
router.get("/profile", verifyToken, getProfile);

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
router.put("/profile", verifyToken, updateProfile);

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
router.patch("/update-branch", verifyToken, updateBranch);

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
router.post("/set-role", verifyToken, verifyAdmin, setRole);

export default router;
