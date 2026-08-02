import crypto from "crypto";
import { getAuth } from "../config/firebase.js";
import { sendEmailVerificationLinkEmail } from "../config/email.js";
import { User } from "../models/index.js";
import {
  EMAIL_VERIFICATION_COOLDOWN_SECONDS,
  EMAIL_VERIFICATION_STATES,
  buildCustomEmailVerificationLink,
  createVerificationContext,
  emailFingerprint,
  maskEmail,
  normalizeVerificationContinuation,
  verifyVerificationContext,
} from "../services/emailVerificationService.js";
import { getPublicUrlConfig } from "../config/publicUrls.js";

const invalidContextResponse = (res) => res.status(400).json({
  state: EMAIL_VERIFICATION_STATES.INVALID_OR_TAMPERED_LINK,
  message: "This verification link is invalid or incomplete.",
});

const firebaseUnavailable = (res) => res.status(503).json({
  state: EMAIL_VERIFICATION_STATES.VERIFICATION_EMAIL_SEND_FAILED,
  message: "Email verification is temporarily unavailable.",
});

const syncVerifiedApplicationUser = async (firebaseUser) => {
  const user = await User.findOne({ firebaseUid: firebaseUser.uid });
  if (!user) return null;
  if (emailFingerprint(user.email) !== emailFingerprint(firebaseUser.email)) return null;
  if (!user.isEmailVerified || user.onboardingStatus === "verification_pending") {
    user.isEmailVerified = true;
    if (user.onboardingStatus === "verification_pending") user.onboardingStatus = "profile_complete";
    user.emailVerificationLastSentAt = null;
    user.emailVerificationSendReservedAt = null;
    user.emailVerificationReservationId = null;
    await user.save();
  }
  return user;
};

const resolveContextIdentity = async (verificationContext) => {
  const context = verifyVerificationContext(verificationContext);
  const firebaseAuth = getAuth();
  if (!firebaseAuth) return { unavailable: true };
  let firebaseUser;
  try {
    firebaseUser = await firebaseAuth.getUser(context.uid);
  } catch (error) {
    if (error?.code === "auth/user-not-found") return { notFound: true };
    throw error;
  }
  if (emailFingerprint(firebaseUser.email) !== context.emailHash) return { invalid: true };
  const applicationUser = await User.findOne({ firebaseUid: context.uid });
  if (!applicationUser || emailFingerprint(applicationUser.email) !== context.emailHash) {
    return { notFound: true };
  }
  return { context, firebaseAuth, firebaseUser, applicationUser };
};

const cooldownFor = (user, now = Date.now()) => {
  const lastSentAt = user?.emailVerificationLastSentAt?.getTime?.() || 0;
  return Math.max(0, Math.ceil((lastSentAt + EMAIL_VERIFICATION_COOLDOWN_SECONDS * 1000 - now) / 1000));
};

const sendForIdentity = async ({ firebaseAuth, firebaseUser, applicationUser, continuePath }) => {
  const safeContinuePath = normalizeVerificationContinuation(continuePath);
  if (firebaseUser.emailVerified) {
    await syncVerifiedApplicationUser(firebaseUser);
    return {
      status: 200,
      body: {
        state: EMAIL_VERIFICATION_STATES.ALREADY_VERIFIED_ACCOUNT,
        message: "This email address is already verified.",
        maskedEmail: maskEmail(firebaseUser.email),
        continuePath: safeContinuePath,
      },
    };
  }

  const now = new Date();
  const cutoff = new Date(now.getTime() - EMAIL_VERIFICATION_COOLDOWN_SECONDS * 1000);
  const reservationId = crypto.randomUUID();
  const reserved = await User.findOneAndUpdate(
    {
      _id: applicationUser._id,
      isEmailVerified: { $ne: true },
      $and: [
        { $or: [{ emailVerificationLastSentAt: null }, { emailVerificationLastSentAt: { $lte: cutoff } }] },
        { $or: [{ emailVerificationSendReservedAt: null }, { emailVerificationSendReservedAt: { $lte: cutoff } }] },
      ],
    },
    {
      $set: {
        emailVerificationSendReservedAt: now,
        emailVerificationReservationId: reservationId,
      },
    },
    { new: true },
  );

  if (!reserved) {
    const current = await User.findById(applicationUser._id);
    return {
      status: 429,
      body: {
        state: EMAIL_VERIFICATION_STATES.RATE_LIMITED_OR_COOLDOWN_ACTIVE,
        message: "Please wait before requesting another verification email.",
        retryAfterSeconds: Math.max(cooldownFor(current), EMAIL_VERIFICATION_COOLDOWN_SECONDS),
        maskedEmail: maskEmail(firebaseUser.email),
        continuePath: safeContinuePath,
      },
    };
  }

  const verificationContext = createVerificationContext({
    uid: firebaseUser.uid,
    email: firebaseUser.email,
    continuePath: safeContinuePath,
  });

  try {
    const actionSettingsUrl = new URL(getPublicUrlConfig().emailActionUrl);
    actionSettingsUrl.searchParams.set("context", verificationContext);
    const firebaseLink = await firebaseAuth.generateEmailVerificationLink(firebaseUser.email, {
      url: actionSettingsUrl.toString(),
      handleCodeInApp: false,
    });
    const verificationLink = buildCustomEmailVerificationLink({ firebaseLink, verificationContext });
    const delivery = await sendEmailVerificationLinkEmail({
      to: firebaseUser.email,
      name: applicationUser.firstName,
      verificationLink,
    });
    if (!delivery?.success) throw new Error("VERIFICATION_DELIVERY_REJECTED");

    await User.updateOne(
      { _id: applicationUser._id, emailVerificationReservationId: reservationId },
      {
        $set: { emailVerificationLastSentAt: now },
        $unset: { emailVerificationSendReservedAt: 1, emailVerificationReservationId: 1 },
      },
    );
    return {
      status: 200,
      body: {
        state: EMAIL_VERIFICATION_STATES.VERIFICATION_EMAIL_RESENT,
        message: "A new verification link has been sent. Please check your inbox and spam folder.",
        maskedEmail: maskEmail(firebaseUser.email),
        retryAfterSeconds: EMAIL_VERIFICATION_COOLDOWN_SECONDS,
        verificationContext,
        continuePath: safeContinuePath,
      },
    };
  } catch {
    await User.updateOne(
      { _id: applicationUser._id, emailVerificationReservationId: reservationId },
      { $unset: { emailVerificationSendReservedAt: 1, emailVerificationReservationId: 1 } },
    );
    return {
      status: 503,
      body: {
        state: EMAIL_VERIFICATION_STATES.VERIFICATION_EMAIL_SEND_FAILED,
        message: "We could not send a new verification link right now. Please try again.",
        maskedEmail: maskEmail(firebaseUser.email),
        retryAfterSeconds: EMAIL_VERIFICATION_COOLDOWN_SECONDS,
        verificationContext,
        continuePath: safeContinuePath,
      },
    };
  }
};

export const getEmailVerificationStatus = async (req, res, next) => {
  try {
    let resolved;
    try {
      resolved = await resolveContextIdentity(req.body?.verificationContext);
    } catch (error) {
      if (error.message === "INVALID_CONTEXT") return invalidContextResponse(res);
      throw error;
    }
    if (resolved.unavailable) return firebaseUnavailable(res);
    if (resolved.invalid) return invalidContextResponse(res);
    if (resolved.notFound) return res.status(404).json({
      state: EMAIL_VERIFICATION_STATES.USER_NOT_FOUND,
      message: "We could not safely resolve the account for this verification link.",
    });

    if (resolved.firebaseUser.emailVerified) {
      await syncVerifiedApplicationUser(resolved.firebaseUser);
      return res.json({
        state: EMAIL_VERIFICATION_STATES.ALREADY_VERIFIED_ACCOUNT,
        message: "This email address is already verified.",
        maskedEmail: maskEmail(resolved.firebaseUser.email),
        continuePath: resolved.context.continuePath,
        retryAfterSeconds: 0,
      });
    }
    return res.json({
      state: EMAIL_VERIFICATION_STATES.VALID_UNUSED_LINK,
      message: "This account is awaiting email verification.",
      maskedEmail: maskEmail(resolved.firebaseUser.email),
      continuePath: resolved.context.continuePath,
      retryAfterSeconds: cooldownFor(resolved.applicationUser),
    });
  } catch (error) {
    return next(error);
  }
};

export const finalizeEmailVerification = async (req, res, next) => {
  try {
    let resolved;
    try {
      resolved = await resolveContextIdentity(req.body?.verificationContext);
    } catch (error) {
      if (error.message === "INVALID_CONTEXT") return invalidContextResponse(res);
      throw error;
    }
    if (resolved.unavailable) return firebaseUnavailable(res);
    if (resolved.invalid) return invalidContextResponse(res);
    if (resolved.notFound) return res.status(404).json({
      state: EMAIL_VERIFICATION_STATES.USER_NOT_FOUND,
      message: "We could not safely resolve the account for this verification link.",
    });
    if (!resolved.firebaseUser.emailVerified) return res.status(409).json({
      state: EMAIL_VERIFICATION_STATES.INVALID_OR_TAMPERED_LINK,
      message: "The email address has not been verified.",
    });
    const applicationUser = await syncVerifiedApplicationUser(resolved.firebaseUser);
    if (!applicationUser) return res.status(404).json({
      state: EMAIL_VERIFICATION_STATES.USER_NOT_FOUND,
      message: "We could not safely resolve the account for this verification link.",
    });
    return res.json({
      state: EMAIL_VERIFICATION_STATES.VALID_UNUSED_LINK,
      verified: true,
      message: "Your email has been verified successfully.",
      maskedEmail: maskEmail(resolved.firebaseUser.email),
      continuePath: resolved.context.continuePath,
    });
  } catch (error) {
    return next(error);
  }
};

export const resendEmailVerification = async (req, res, next) => {
  try {
    let resolved;
    try {
      resolved = await resolveContextIdentity(req.body?.verificationContext);
    } catch (error) {
      if (error.message === "INVALID_CONTEXT") return invalidContextResponse(res);
      throw error;
    }
    if (resolved.unavailable) return firebaseUnavailable(res);
    if (resolved.invalid) return invalidContextResponse(res);
    if (resolved.notFound) return res.status(404).json({
      state: EMAIL_VERIFICATION_STATES.USER_NOT_FOUND,
      message: "We could not safely resolve the account for this verification link.",
    });
    const result = await sendForIdentity({
      ...resolved,
      continuePath: resolved.context.continuePath,
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
};

export const sendAuthenticatedEmailVerification = async (req, res, next) => {
  try {
    const firebaseAuth = getAuth();
    if (!firebaseAuth) return firebaseUnavailable(res);
    const firebaseUser = await firebaseAuth.getUser(req.user.uid);
    const applicationUser = await User.findOne({ firebaseUid: req.user.uid });
    if (!applicationUser || emailFingerprint(applicationUser.email) !== emailFingerprint(firebaseUser.email)) {
      return res.status(404).json({
        state: EMAIL_VERIFICATION_STATES.USER_NOT_FOUND,
        message: "We could not safely resolve the account for this verification request.",
      });
    }
    const continuePath = req.body?.continuePath;
    const result = await sendForIdentity({ firebaseAuth, firebaseUser, applicationUser, continuePath });
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
};
