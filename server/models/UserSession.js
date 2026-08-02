/**
 * ============================================================================
 * USER SESSION MODEL
 * ============================================================================
 *
 * Tracks user login sessions for security monitoring.
 *
 * FEATURES:
 * - Track device, IP, and login times
 * - Detect suspicious activity (multiple concurrent sessions)
 * - Allow admin to force-logout sessions
 *
 * AUTO-CLEANUP:
 * - Inactive sessions are auto-deleted after 30 days via TTL index
 *
 * ============================================================================
 */

import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";
import { SESSION_ASSURANCE_VALUES } from "../config/sessionAssurance.js";

// ============================================================================
// SCHEMA DEFINITION
// ============================================================================

const userSessionSchema = new mongoose.Schema(
  {
    // --- Session Identity ---
    sessionId: {
      type: String,
      required: true,
      unique: true,
      default: () => `SES-${uuidv4()}`,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    deviceId: {
      type: String,
      default: null,
      index: true,
    },

    // --- Device & Network ---
    device: {
      type: String,
      default: "Unknown",
    },
    ipAddress: {
      type: String,
      default: null,
    },
    userAgent: {
      type: String,
      default: null,
    },

    // --- Timestamps ---
    loginTime: {
      type: Date,
      default: Date.now,
    },
    logoutTime: {
      type: Date,
      default: null,
    },
    lastActivityAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      default: null,
      index: true,
    },
    otpVerifiedAt: {
      type: Date,
      default: null,
    },
    otpHash: {
      type: String,
      default: null,
      select: false,
    },
    otpExpiresAt: {
      type: Date,
      default: null,
    },
    otpLastSentAt: {
      type: Date,
      default: null,
    },
    otpAttempts: {
      type: Number,
      default: 0,
    },
    otpPurpose: {
      type: String,
      enum: ["login"],
      default: null,
    },
    challengeKey: {
      type: String,
      default: null,
      select: false,
    },
    securityVersion: { type: Number, default: 0 },
    assuranceMethod: {
      type: String,
      enum: SESSION_ASSURANCE_VALUES,
      default: null,
      index: true,
    },

    // --- Status ---
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  },
);

// ============================================================================
// INDEXES
// ============================================================================

userSessionSchema.index({ userId: 1, isActive: 1 });
userSessionSchema.index({ userId: 1, loginTime: -1 });
userSessionSchema.index({ userId: 1, deviceId: 1, isActive: 1 });
// New challenges receive a deterministic, hashed scope key. The sparse unique
// index is migration-safe for legacy rows where challengeKey is absent/null.
userSessionSchema.index(
  { challengeKey: 1 },
  {
    unique: true,
    partialFilterExpression: { challengeKey: { $type: "string" } },
    name: "unique_pending_otp_challenge_scope",
  },
);

// TTL: auto-delete inactive sessions after 30 days
userSessionSchema.index(
  { logoutTime: 1 },
  { expireAfterSeconds: 30 * 24 * 60 * 60, partialFilterExpression: { isActive: false } },
);

// ============================================================================
// METHODS
// ============================================================================

/**
 * End this session
 */
userSessionSchema.methods.endSession = async function () {
  this.isActive = false;
  this.logoutTime = new Date();
  return this.save();
};

// ============================================================================
// STATICS
// ============================================================================

/**
 * Create a new session
 */
userSessionSchema.statics.createSession = async function (userId, req, options = {}) {
  const now = new Date();
  const durationMs = options.durationMs || 24 * 60 * 60 * 1000;
  const session = new this({
    userId,
    deviceId: options.deviceId || req.headers["x-device-id"] || null,
    device: req.headers["x-device-name"] || parseDevice(req.headers["user-agent"]),
    ipAddress: req.ip || req.headers["x-forwarded-for"] || req.connection?.remoteAddress,
    userAgent: req.headers["user-agent"],
    expiresAt: new Date(now.getTime() + durationMs),
    otpVerifiedAt: options.otpVerified ? now : null,
    assuranceMethod: options.assuranceMethod || null,
    securityVersion: Number(options.securityVersion || 0),
  });
  return session.save(options.mongoSession ? { session: options.mongoSession } : undefined);
};

/**
 * Find an active, non-expired OTP-verified session.
 */
userSessionSchema.statics.findValidOtpSession = function (userId, deviceId, sessionId) {
  if (!deviceId || !sessionId) return null;
  return this.findOne({
    userId,
    deviceId,
    sessionId,
    isActive: true,
    otpVerifiedAt: { $ne: null },
    expiresAt: { $gt: new Date() },
  });
};

userSessionSchema.statics.findValidSession = function (userId, deviceId, sessionId) {
  if (!deviceId || !sessionId) return null;
  return this.findOne({
    userId,
    deviceId,
    sessionId,
    isActive: true,
    expiresAt: { $gt: new Date() },
  });
};

/**
 * Find the newest pending OTP challenge for this user/device.
 */
userSessionSchema.statics.findPendingOtp = function (userId, deviceId, purpose = "login") {
  if (!deviceId) return null;
  return this.findOne({
    userId,
    deviceId,
    isActive: false,
    otpHash: { $ne: null },
    otpExpiresAt: { $gt: new Date() },
    otpPurpose: { $in: [purpose, null] },
  })
    .select("+otpHash")
    .sort({ otpLastSentAt: -1 });
};

/**
 * Get active sessions for a user
 */
userSessionSchema.statics.getActiveSessions = function (userId) {
  return this.find({ userId, isActive: true }).sort({ loginTime: -1 });
};

/**
 * Force-logout all sessions for a user
 */
userSessionSchema.statics.forceLogoutAll = async function (userId) {
  return this.updateMany(
    { userId, isActive: true },
    { $set: { isActive: false, logoutTime: new Date() } },
  );
};

// ============================================================================
// HELPERS
// ============================================================================

function parseDevice(userAgent) {
  if (!userAgent) return "Unknown";
  if (userAgent.includes("Mobile")) return "Mobile";
  if (userAgent.includes("Tablet")) return "Tablet";
  return "Desktop";
}

// ============================================================================
// EXPORT
// ============================================================================

const UserSession = mongoose.model("UserSession", userSessionSchema);

export default UserSession;
