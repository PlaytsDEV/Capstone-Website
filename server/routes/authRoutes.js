/**
 * Authentication Routes
 *
 * Handles user authentication operations including:
 * - User registration with Firebase integration
 * - User login with email verification check
 * - Profile management
 * - Role management (owner only)
 *
 * Security: Firebase Auth is the single source of truth for email verification.
 * All routes require Firebase token verification via verifyToken middleware.
 * Input validation and sanitization applied to all user inputs.
 */

import express from "express";
import { getAuth } from "../config/firebase.js";
import { verifyToken, verifyOnboardingToken, verifyOwner } from "../middleware/auth.js";
import { publicLimiter, authLimiter } from "../middleware/rateLimiter.js";
import auditLogger from "../utils/auditLogger.js";
import { User, UserSession } from "../models/index.js";
import { invalidateUserSessions } from "../services/sessionInvalidationService.js";
import {
  validateRegisterInput,
  validateProfileUpdateInput,
  createValidationMiddleware,
} from "../middleware/validation.js";
import { validate } from "../validation/validate.js";
import { setRoleSchema, updateBranchSchema } from "../validation/schemas.js";
import {
  register,
  login,
  verifyLoginOtp,
  resendLoginOtp,
  logout,
  getProfile,
  updateProfile,
  updateBranch,
  setRole,
  logPasswordReset,
  notifyPasswordChanged,
} from "../controllers/authController.js";
import {
  clearEmailVerificationCapability,
  exchangeEmailVerificationToken,
  finalizeEmailVerification,
  getEmailVerificationStatus,
  reconcileAuthenticatedEmailVerification,
  resendEmailVerification,
  sendAuthenticatedEmailVerification,
} from "../controllers/emailVerificationController.js";
import { requireEmailVerificationCsrf } from "../utils/emailVerificationCookie.js";
import { requestPasswordReset } from "../controllers/passwordResetController.js";

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
router.post(
  "/register",
  authLimiter,
  verifyOnboardingToken,
  createValidationMiddleware(validateRegisterInput),
  register,
);

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
router.post("/login", authLimiter, verifyToken, login);

router.post("/verify-otp", authLimiter, verifyToken, verifyLoginOtp);

router.post("/resend-otp", authLimiter, verifyToken, resendLoginOtp);

// Email verification is intentionally isolated from password-reset and login
// OTP routes. Public operations require a short-lived HttpOnly browser
// capability; reconciliation derives identity from a validated Firebase token.
router.post(
  "/email-verification/send",
  authLimiter,
  verifyOnboardingToken,
  sendAuthenticatedEmailVerification,
);
router.post("/email-verification/exchange", publicLimiter, exchangeEmailVerificationToken);
router.post("/email-verification/status", publicLimiter, requireEmailVerificationCsrf, getEmailVerificationStatus);
router.post("/email-verification/finalize", publicLimiter, requireEmailVerificationCsrf, finalizeEmailVerification);
router.post("/email-verification/resend", authLimiter, requireEmailVerificationCsrf, resendEmailVerification);
router.post("/email-verification/clear", publicLimiter, requireEmailVerificationCsrf, clearEmailVerificationCapability);
router.post(
  "/email-verification/reconcile",
  authLimiter,
  verifyOnboardingToken,
  reconcileAuthenticatedEmailVerification,
);

/**
 * POST /api/auth/logout
 *
 * Log user logout event for audit trail.
 *
 * @requires Firebase token in Authorization header
 * @returns { message }
 */
router.post("/logout", verifyToken, logout);

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
router.put(
  "/profile",
  verifyToken,
  express.json({ limit: "8mb" }),
  createValidationMiddleware(validateProfileUpdateInput),
  updateProfile,
);

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
router.patch("/update-branch", verifyToken, validate(updateBranchSchema), updateBranch);

// ============================================================================
// ADMIN OPERATIONS
// ============================================================================

/**
 * POST /api/auth/set-role
 *
 * Set user role and Firebase custom claims (branch_admin/owner only).
 *
 * @requires Firebase token in Authorization header
 * @requires Admin privileges
 * @body { userId, role }
 * @returns { message }
 */
router.post("/set-role", verifyToken, verifyOwner, validate(setRoleSchema), setRole);

/**
 * POST /api/auth/log-password-reset
 *
 * Log password reset attempts for security auditing.
 * Public endpoint — no auth required.
 *
 * @body { email, success }
 * @returns { message }
 */
router.post("/log-password-reset", publicLimiter, logPasswordReset);

/**
 * POST /api/auth/request-password-reset
 *
 * Generates a Firebase Admin password-reset link and sends it through the
 * same Lilycrest-branded Resend Template delivery pipeline as email
 * verification, instead of Firebase's client SDK sending its own
 * generic-branded email directly.
 *
 * Public endpoint — no auth required (the caller is signed out by
 * definition). Always responds with the same generic, enumeration-safe
 * message regardless of whether the email is registered, on cooldown, or
 * delivery failed — see passwordResetController.js for why a distinguishing
 * status/response here would leak account existence.
 *
 * @body { email }
 * @returns { message }
 */
router.post("/request-password-reset", authLimiter, requestPasswordReset);

// Called only with a freshly authenticated Firebase token after the action-code
// reset succeeds. The UID comes from the verified token, never from the body.
router.post("/finalize-password-reset", authLimiter, verifyToken, async (req, res, next) => {
  try {
    const user = await User.findOne({ firebaseUid: req.user.uid });
    const invalidation = user ? await invalidateUserSessions({ user, reason: "web_password_reset", req }) : null;
    return res.json({ message: "Password reset finalized", sessionCleanupComplete: !invalidation?.failures?.length });
  } catch (error) { return next(error); }
});

/**
 * POST /api/auth/notify-password-changed
 *
 * Dispatches a security notification email, optionally invalidates other active sessions,
 * and logs a security audit trail entry when the user updates their password in settings.
 *
 * @requires Firebase token in Authorization header
 * @body { revokeOtherSessions?: boolean }
 * @returns { success: true, message: string, sessionCleanupComplete: boolean }
 */
router.post("/notify-password-changed", authLimiter, verifyToken, notifyPasswordChanged);

/**
 * POST /api/auth/revoke-sessions
 *
 * Revoke all refresh tokens for the authenticated user.
 * This effectively signs out the user from all devices.
 *
 * @requires Firebase token in Authorization header
 * @returns { message }
 */
router.post("/revoke-sessions", verifyToken, async (req, res) => {
  try {
    const auth = getAuth();
    if (!auth) {
      return res.status(503).json({ error: "Firebase Admin not available" });
    }
    const dbUser = await User.findOne({ firebaseUid: req.user.uid }).select("_id user_id").lean();
    if (dbUser) await invalidateUserSessions({ user: { ...dbUser, firebaseUid: req.user.uid }, reason: "logout_all_devices", req });
    await auditLogger.log({
      req,
      type: "security",
      action: "All sessions revoked",
      severity: "warning",
      details: "All refresh tokens revoked for authenticated user",
      metadata: {
        firebaseUid: req.user.uid,
      },
    });
    res.json({ message: "All sessions revoked successfully" });
  } catch (error) {
    console.error("❌ Session revocation error:", error);
    res.status(500).json({ error: "Failed to revoke sessions" });
  }
});

export default router;
