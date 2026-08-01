/**
 * =============================================================================
 * AUTHENTICATION & AUTHORIZATION MIDDLEWARE
 * =============================================================================
 *
 * Middleware functions for protecting routes and verifying user permissions.
 *
 * Middleware Functions:
 * 1. verifyToken: Validates Firebase ID token (required for all protected routes)
 * 2. verifyAdmin: Checks if user has admin privileges (branch_admin or owner)
 * 3. verifyOwner: Checks if user has owner privileges
 * 4. verifyApplicant: Ensures user is NOT an admin (for applicant/tenant-only endpoints)
 *
 * Usage:
 * - Apply verifyToken to all routes that require authentication
 * - Chain verifyAdmin after verifyToken for admin-only routes
 * - Chain verifyOwner after verifyToken for owner-only routes
 * - Chain verifyApplicant after verifyToken for applicant/tenant-only routes
 *
 * Example:
 *   router.get('/protected', verifyToken, handler)
 *   router.post('/admin-only', verifyToken, verifyAdmin, handler)
 *   router.delete('/owner-only', verifyToken, verifyOwner, handler)
 *   router.post('/user-only', verifyToken, verifyApplicant, handler)
 */

import { getAuth } from "../config/firebase.js";
import crypto from "crypto";
import { User, UserSession } from "../models/index.js";

import { CACHE } from "../config/constants.js";
import { isAdminRole, isOwnerRole } from "../config/roles.js";
import {
  getCachedAccountStatus as _getCachedAccountStatus,
  setCachedAccountStatus as _setCachedAccountStatus,
  invalidateAccountStatusCache,
} from "../utils/accountStatusCache.js";
import { sendError } from "./errorHandler.js";

export { invalidateAccountStatusCache };

/* ─── In-memory token verification cache (avoids hitting Firebase each request) ── */
const tokenCache = new Map();
const TOKEN_CACHE_TTL = CACHE.TOKEN_TTL_MS;

function getCachedToken(token) {
  const key = crypto.createHash("sha256").update(token).digest("hex");
  const entry = tokenCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.ts > TOKEN_CACHE_TTL) {
    tokenCache.delete(key);
    return null;
  }
  entry.lastAccess = Date.now(); // Update on every read — enables LRU eviction
  return entry.decoded;
}

function setCachedToken(token, decoded) {
  const key = crypto.createHash("sha256").update(token).digest("hex");
  // Evict least-recently-accessed entry when cache is full
  // (LRU is better than FIFO — keeps active users' tokens cached)
  if (tokenCache.size >= CACHE.MAX_TOKEN_ENTRIES) {
    let lruKey = null;
    let lruTime = Infinity;
    for (const [k, v] of tokenCache) {
      const lastUsed = v.lastAccess || v.ts;
      if (lastUsed < lruTime) {
        lruTime = lastUsed;
        lruKey = k;
      }
    }
    if (lruKey) tokenCache.delete(lruKey);
  }
  tokenCache.set(key, { decoded, ts: Date.now(), lastAccess: Date.now() });
}

/* ─── Account status cache — backed by shared module so User post-save hooks
       can invalidate it without creating a circular import. ─────────────────── */
const getCachedAccountStatus = _getCachedAccountStatus;
const setCachedAccountStatus = _setCachedAccountStatus;

const OTP_SESSION_EXEMPT_PATHS = [
  "/api/auth/login",
  "/api/auth/verify-otp",
  "/api/auth/resend-otp",
  "/api/auth/logout",
  "/api/auth/register",
  "/api/auth/log-password-reset",
  "/api/auth/finalize-password-reset",
];

const isOtpSessionExempt = (req) =>
  OTP_SESSION_EXEMPT_PATHS.some((path) => req.originalUrl?.startsWith(path));

// isAdminRole and isOwnerRole imported from config/roles.js

/**
 * Verify Firebase ID Token
 *
 * Middleware to authenticate requests using Firebase ID tokens.
 * The token should be sent in the Authorization header as "Bearer <token>".
 *
 * Uses an in-memory cache to avoid hitting Firebase on every request.
 */
export const verifyToken = async (req, res, next) => {
  try {
    const auth = getAuth();

    if (!auth) {
      return sendError(
        res,
        "Authentication is temporarily unavailable. Firebase Admin is not initialized.",
        503,
        "FIREBASE_ADMIN_NOT_INITIALIZED",
      );
    }

    // Extract the Authorization header
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return sendError(
        res,
        "No authorization header provided",
        401,
        "AUTH_HEADER_MISSING",
      );
    }

    // Extract the token from "Bearer <token>" format
    const token = authHeader.split("Bearer ")[1];

    if (!token) {
      return sendError(res, "No token provided", 401, "TOKEN_MISSING");
    }

    // Revocation-sensitive verification is intentionally not cached. Cached
    // acceptance could outlive password resets or logout-all operations.
    const decodedToken = await auth.verifyIdToken(token, true);

    // --- Account status check (cached — saves ~5-50ms per request) ---
    // Block suspended/banned users from accessing any protected endpoint
    let dbUser = await User.findOne({ firebaseUid: decodedToken.uid })
      .select("_id firebaseUid accountStatus role permissions branch isActive is_active isArchived is_archived securityVersion authInvalidatedAt")
      .lean();
    if (!dbUser) {
      return sendError(res, "Authentication failed.", 401, "AUTHENTICATION_FAILED");
    }

    req.user = decodedToken;
    req.authUser = dbUser;
    let accountStatus = getCachedAccountStatus(decodedToken.uid);
    if (accountStatus === undefined) {
      accountStatus = dbUser?.accountStatus || null;
      setCachedAccountStatus(decodedToken.uid, accountStatus);
    }

    if (dbUser && (dbUser.isActive === false || dbUser.is_active === false || dbUser.isArchived === true || dbUser.is_archived === true)) {
      return sendError(res, "Account access is restricted.", 403, "ACCOUNT_ACCESS_RESTRICTED");
    }
    if (accountStatus && accountStatus !== "active") {
      const statusMap = {
        suspended: { message: "Your account has been suspended. Contact support.", code: "ACCOUNT_SUSPENDED" },
        banned: { message: "Your account has been banned.", code: "ACCOUNT_BANNED" },
        pending_verification: { message: "Your account is pending verification.", code: "ACCOUNT_PENDING_VERIFICATION" },
      };
      const info = statusMap[accountStatus];
      if (info) return sendError(res, info.message, 403, info.code);
    }
    if (dbUser?.authInvalidatedAt && Number(decodedToken.auth_time || 0) * 1000 <= dbUser.authInvalidatedAt.getTime()) {
      return sendError(res, "Your session was revoked. Please sign in again.", 401, "SESSION_REVOKED");
    }

    if (
      dbUser &&
      !isAdminRole(dbUser.role) &&
      !isOtpSessionExempt(req)
    ) {
      const deviceId =
        typeof req.headers["x-device-id"] === "string"
          ? req.headers["x-device-id"].trim()
          : "";
      const sessionId =
        typeof req.headers["x-session-id"] === "string"
          ? req.headers["x-session-id"].trim()
          : "";

      if (!deviceId || !sessionId) {
        return sendError(
          res,
          "Session verification required. Please sign in again.",
          401,
          "OTP_SESSION_REQUIRED",
        );
      }

      const session = await UserSession.findValidOtpSession(
        dbUser._id,
        deviceId,
        sessionId,
      );

      if (!session) {
        return sendError(
          res,
          "Your session expired. Please verify again.",
          401,
          "OTP_SESSION_INVALID",
        );
      }
      if (Number(session.securityVersion || 0) !== Number(dbUser.securityVersion || 0)) {
        return sendError(res, "Your session was revoked. Please sign in again.", 401, "SESSION_REVOKED");
      }

      session.lastActivityAt = new Date();
      await session.save();
      req.session = session;
    }

    // Token is valid, proceed to next middleware/route
    next();
  } catch (error) {
    console.error("❌ Token verification error:", error.message);

    // Provide specific error messages based on error type
    let errorMessage = "Invalid or expired token";
    let errorCode = "TOKEN_INVALID";

    if (error.code === "auth/id-token-expired") {
      errorMessage = "Token has expired. Please login again.";
      errorCode = "TOKEN_EXPIRED";
    } else if (error.code === "auth/argument-error") {
      errorMessage = "Malformed token provided.";
      errorCode = "TOKEN_MALFORMED";
    }

    sendError(res, errorMessage, 401, errorCode);
  }
};

/** Firebase-only boundary for creating the initial MongoDB profile. */
export const verifyOnboardingToken = async (req, res, next) => {
  try {
    const auth = getAuth();
    if (!auth) {
      return sendError(res, "Authentication is temporarily unavailable.", 503, "FIREBASE_ADMIN_NOT_INITIALIZED");
    }
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
    if (!token) return sendError(res, "Authentication failed.", 401, "AUTHENTICATION_FAILED");
    req.user = await auth.verifyIdToken(token, true);
    req.onboardingIdentity = true;
    next();
  } catch (_error) {
    sendError(res, "Authentication failed.", 401, "AUTHENTICATION_FAILED");
  }
};

/**
 * Verify Admin Role
 *
 * Middleware to check if the authenticated user has admin privileges.
 * Must be used AFTER verifyToken middleware.
 *
 * Uses the authoritative MongoDB role attached by verifyToken.
 *
 * @middleware
 * @param {Object} req - Express request object (must have req.user from verifyToken)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 *
 * @returns {void} Calls next() if admin, sends 403 error otherwise
 */
export const verifyAdmin = async (req, res, next) => {
  try {
    // Ensure verifyToken was called first
    if (!req.user?.uid || !req.authUser) {
      return sendError(
        res,
        "User not authenticated. Apply verifyToken middleware first.",
        401,
        "USER_NOT_AUTHENTICATED",
      );
    }

    const dbUser = req.authUser;
    if (isAdminRole(dbUser.role)) {
      // Attach role info to req.user for downstream middleware
      req.user.branch_admin = true;
      req.user.owner = isOwnerRole(dbUser.role);
      req.user.dbRole = dbUser.role;
      return next();
    }

    return sendError(
      res,
      "Access denied. Admin privileges required.",
      403,
      "ADMIN_ACCESS_DENIED",
    );
  } catch (error) {
    console.error("❌ Admin verification error:", error.message);

    sendError(res, "Access denied", 403, "ACCESS_DENIED");
  }
};

/**
 * Verify Owner Role
 *
 * Middleware to check if the authenticated user has owner privileges.
 * Must be used AFTER verifyToken middleware.
 *
 * Checks the authoritative MongoDB role attached by verifyToken.
 *
 * SECURITY: This prevents unauthorized access to owner-only endpoints.
 *
 * @middleware
 * @param {Object} req - Express request object (must have req.user from verifyToken)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 *
 * @returns {void} Calls next() if owner, sends 403 error otherwise
 */
export const verifyOwner = async (req, res, next) => {
  try {
    // Ensure verifyToken was called first
    if (!req.user?.uid || !req.authUser) {
      return sendError(
        res,
        "User not authenticated. Apply verifyToken middleware first.",
        401,
        "USER_NOT_AUTHENTICATED",
      );
    }

    const dbUser = req.authUser;
    if (isOwnerRole(dbUser.role)) {
      req.user.owner = true;
      req.user.branch_admin = true;
      req.user.dbRole = dbUser.role;
      req.isOwner = true;
      return next();
    }

    return sendError(
      res,
      "Access denied. Owner privileges required.",
      403,
      "OWNER_ACCESS_DENIED",
    );
  } catch (error) {
    console.error("❌ Owner verification error:", error.message);

    sendError(res, "Access denied", 403, "ACCESS_DENIED");
  }
};

/**
 * Verify Applicant/Tenant Role
 *
 * Middleware to check if the authenticated user has applicant/tenant privileges.
 * Must be used AFTER verifyToken middleware.
 *
 * Ensures that admin users cannot access applicant-only endpoints.
 * Users with "applicant", "tenant" roles will pass this check.
 * branch_admin and owner users will be denied access.
 *
 * SECURITY: This prevents privilege escalation where admins
 * could access applicant endpoints with their elevated permissions.
 *
 * @middleware
 * @param {Object} req - Express request object (must have req.user from verifyToken)
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 *
 * @returns {void} Calls next() if applicant/tenant, sends 403 error otherwise
 */
export const verifyApplicant = async (req, res, next) => {
  try {
    // Ensure verifyToken was called first
    if (!req.user?.uid || !req.authUser) {
      return sendError(
        res,
        "User not authenticated. Apply verifyToken middleware first.",
        401,
        "USER_NOT_AUTHENTICATED",
      );
    }

    if (isAdminRole(req.authUser.role)) {
      return sendError(
        res,
        "Access denied. Applicant endpoint - admin access not allowed.",
        403,
        "APPLICANT_ENDPOINT_ADMIN_DENIED",
      );
    }

    // User is not an admin (applicant/tenant), proceed to route handler
    next();
  } catch (error) {
    console.error("❌ Applicant verification error:", error.message);

    sendError(res, "Access denied", 403, "ACCESS_DENIED");
  }
};

/**
 * Verify Resource Ownership (IDOR Protection)
 * Prevents tenants from inspecting or mutating resources of other tenants via URL parameter tampering.
 */
export const verifyResourceOwnership = (paramName = "tenantId") => {
  return (req, res, next) => {
    if (isAdminRole(req.authUser?.role)) {
      return next();
    }
    const requestedId = req.params[paramName] || req.query[paramName] || req.body[paramName];
    const authenticatedId = req.authUser?._id?.toString() || req.authUser?.firebaseUid || req.user?.uid;
    if (requestedId && authenticatedId && requestedId.toString() !== authenticatedId.toString()) {
      return sendError(
        res,
        "Access denied. You can only access your own resources.",
        403,
        "IDOR_ACCESS_DENIED"
      );
    }
    next();
  };
};
