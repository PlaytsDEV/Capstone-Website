/**
 * Backend-generated, Lilycrest-branded password reset email.
 *
 * Mirrors emailVerificationController.js's sendForIdentity architecture
 * (Firebase Admin link generation -> branded template -> SMTP/Resend
 * delivery -> atomic per-account cooldown reservation) but is deliberately
 * simpler: Forgot Password is a public, unauthenticated endpoint keyed only
 * by an email address a visitor typed in, so — unlike the authenticated
 * email-verification resend flow — the response can NEVER differ based on
 * whether the account exists, is on cooldown, or delivery failed. Every
 * outcome except malformed input returns the exact same 200 body.
 */
import crypto from "crypto";
import { getAuth } from "../config/firebase.js";
import { sendPasswordResetLinkEmail } from "../config/email.js";
import { getPublicUrlConfig } from "../config/publicUrls.js";
import User from "../models/User.js";
import logger from "../middleware/logger.js";
import auditLogger from "../utils/auditLogger.js";
import { sanitizeEmail } from "../middleware/validation.js";
import { emailFingerprint, maskEmail } from "../services/emailVerificationService.js";
import { PASSWORD_RESET_COOLDOWN_SECONDS } from "../services/passwordResetService.js";

const GENERIC_RESPONSE = {
  message: "If an account exists for this email, a password reset link has been sent.",
};

const displayNameFor = (applicationUser) =>
  applicationUser?.firstName || applicationUser?.displayName || undefined;

/**
 * POST /api/auth/request-password-reset
 *
 * Public endpoint — no auth required, the caller is by definition signed
 * out. Body: { email }.
 */
export const requestPasswordReset = async (req, res) => {
  try {
    const email = sanitizeEmail(req.body?.email);
    if (!email) {
      return res.status(400).json({ error: "A valid email address is required", code: "VALIDATION_ERROR" });
    }

    const firebaseAuth = getAuth();
    if (!firebaseAuth) {
      logger.error("Password reset requested while Firebase Admin is unavailable");
      return res.status(200).json(GENERIC_RESPONSE);
    }

    let firebaseUser;
    try {
      firebaseUser = await firebaseAuth.getUserByEmail(email);
    } catch (error) {
      if (error?.code === "auth/user-not-found") {
        logger.info({ emailFingerprint: emailFingerprint(email) }, "Password reset requested for unknown email");
      } else {
        logger.error(
          { err: error, emailFingerprint: emailFingerprint(email) },
          "Password reset Firebase lookup failed",
        );
      }
      return res.status(200).json(GENERIC_RESPONSE);
    }

    // A backend User profile is optional here on purpose: a Firebase
    // identity created mid-registration (tab closed before the backend
    // profile was created) must still be able to reset its password. Only
    // the per-account cooldown reservation and audit trail need a User
    // document to attach to — global per-IP rate limiting (authLimiter on
    // this route) is the only throttle for that edge case.
    const applicationUser = await User.findOne({ firebaseUid: firebaseUser.uid });

    let reservationId = null;
    if (applicationUser) {
      const now = new Date();
      const cutoff = new Date(now.getTime() - PASSWORD_RESET_COOLDOWN_SECONDS * 1000);
      reservationId = crypto.randomUUID();
      const reserved = await User.findOneAndUpdate(
        {
          _id: applicationUser._id,
          $and: [
            { $or: [{ passwordResetLastSentAt: null }, { passwordResetLastSentAt: { $lte: cutoff } }] },
            { $or: [{ passwordResetDeliveredAt: null }, { passwordResetDeliveredAt: { $lte: cutoff } }] },
            { $or: [{ passwordResetSendReservedAt: null }, { passwordResetSendReservedAt: { $lte: cutoff } }] },
          ],
        },
        { $set: { passwordResetSendReservedAt: now, passwordResetReservationId: reservationId } },
        { new: true },
      );
      if (!reserved) {
        // Cooldown active for a real account. Stay enumeration-safe: return
        // the identical generic response instead of a 429 that would only
        // ever fire for an account that actually exists.
        logger.info({ emailFingerprint: emailFingerprint(email) }, "Password reset cooldown active, request suppressed");
        return res.status(200).json(GENERIC_RESPONSE);
      }
    }

    let resetLink;
    let delivery;
    try {
      resetLink = await firebaseAuth.generatePasswordResetLink(email, {
        url: getPublicUrlConfig().emailActionUrl,
        handleCodeInApp: false,
      });
      delivery = await sendPasswordResetLinkEmail({
        to: email,
        name: displayNameFor(applicationUser),
        resetLink,
      });
      if (!delivery?.success) {
        throw Object.assign(new Error("PASSWORD_RESET_DELIVERY_FAILED"), {
          classification: { category: delivery?.category || "unknown", code: delivery?.code || "EMAIL_DELIVERY_FAILED" },
        });
      }
    } catch (error) {
      const classification = error?.classification || { category: "link_generation_failed", code: "EMAIL_LINK_GENERATION_FAILED" };
      logger.error(
        { emailFingerprint: emailFingerprint(email), category: classification.category, code: classification.code },
        "Password reset link generation or delivery failed",
      );
      if (applicationUser && reservationId) {
        await User.updateOne(
          { _id: applicationUser._id, passwordResetReservationId: reservationId },
          { $unset: { passwordResetSendReservedAt: 1, passwordResetReservationId: 1 } },
        ).catch((releaseError) => {
          logger.error({ err: releaseError }, "Password reset reservation release failed");
        });
        await auditLogger.log({
          type: "login",
          action: "Password reset email delivery failed",
          severity: "warning",
          userId: applicationUser._id,
          userName: `${applicationUser.firstName || ""} ${applicationUser.lastName || ""}`.trim() || maskEmail(email),
          userRole: applicationUser.role || "unknown",
          userEmail: maskEmail(email),
          ipAddress: req.headers["x-forwarded-for"] || req.connection?.remoteAddress,
          userAgent: req.headers["user-agent"],
          metadata: { event: "password_reset_delivery_failed", code: classification.code },
        }).catch(() => undefined);
      }
      return res.status(200).json(GENERIC_RESPONSE);
    }

    // Delivered successfully. Finalizing the cooldown and writing the audit
    // log are best-effort bookkeeping from here — neither may downgrade an
    // already-successful send back into a failure response.
    if (applicationUser && reservationId) {
      const now = new Date();
      await User.updateOne(
        { _id: applicationUser._id, passwordResetReservationId: reservationId },
        {
          $set: { passwordResetLastSentAt: now, passwordResetDeliveredAt: now },
          $unset: { passwordResetSendReservedAt: 1, passwordResetReservationId: 1 },
        },
      ).catch((error) => {
        logger.error({ err: error }, "Password reset delivered; cooldown finalization failed closed");
      });
      await auditLogger.log({
        type: "login",
        action: "Password reset email sent",
        severity: "info",
        userId: applicationUser._id,
        userName: `${applicationUser.firstName || ""} ${applicationUser.lastName || ""}`.trim() || maskEmail(email),
        userRole: applicationUser.role || "unknown",
        userEmail: maskEmail(email),
        ipAddress: req.headers["x-forwarded-for"] || req.connection?.remoteAddress,
        userAgent: req.headers["user-agent"],
        metadata: { event: "password_reset_requested", provider: delivery.provider },
      }).catch(() => undefined);
    }

    return res.status(200).json(GENERIC_RESPONSE);
  } catch (error) {
    // Any unexpected failure still stays enumeration-safe for the caller —
    // internal error handling/logging happens via `next`, but the response
    // shape contract (never leak whether the account exists) must hold even
    // on an unhandled exception, so log-then-generic-response instead of
    // letting a raw 500 through.
    logger.error({ err: error }, "Password reset request handler failed unexpectedly");
    return res.status(200).json(GENERIC_RESPONSE);
  }
};
