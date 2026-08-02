import crypto from "crypto";
import { getAuth } from "../config/firebase.js";
import { sendEmailVerificationLinkEmail } from "../config/email.js";
import User from "../models/User.js";
import EmailVerificationExchange from "../models/EmailVerificationExchange.js";
import logger from "../middleware/logger.js";
import {
  EMAIL_VERIFICATION_COOLDOWN_SECONDS,
  EMAIL_VERIFICATION_STATES,
  buildCustomEmailVerificationLink,
  createOpaqueExchangeToken,
  emailFingerprint,
  getExchangeExpiry,
  getExchangeTtlSeconds,
  getSessionExpiry,
  getSessionTtlSeconds,
  hashExchangeToken,
  maskEmail,
  normalizeVerificationContinuation,
} from "../services/emailVerificationService.js";
import { getPublicUrlConfig } from "../config/publicUrls.js";
import {
  getEmailVerificationToken,
  setEmailVerificationCookie,
} from "../utils/emailVerificationCookie.js";

const invalidExchangeResponse = (res) => res.status(400).json({
  state: EMAIL_VERIFICATION_STATES.INVALID_OR_TAMPERED_LINK,
  message: "This verification link is invalid, expired, or has already been used.",
});

const firebaseUnavailable = (res) => res.status(503).json({
  state: EMAIL_VERIFICATION_STATES.VERIFICATION_EMAIL_SEND_FAILED,
  message: "Email verification is temporarily unavailable.",
});

const identityFailureResponse = (res, failure) => {
  if (failure === "mismatch") {
    return res.status(409).json({
      state: EMAIL_VERIFICATION_STATES.ACCOUNT_MISMATCH,
      message: "This verification link belongs to a different account.",
    });
  }
  return res.status(404).json({
    state: EMAIL_VERIFICATION_STATES.USER_NOT_FOUND,
    message: "We could not safely resolve the account for this verification link.",
  });
};

const createExchange = async ({ kind, firebaseUid, email, continuePath }) => {
  const token = createOpaqueExchangeToken();
  const expiresAt = kind === "action" ? getExchangeExpiry() : getSessionExpiry();
  await EmailVerificationExchange.create({
    tokenHash: hashExchangeToken(token),
    kind,
    firebaseUid,
    emailHash: emailFingerprint(email),
    continuePath: normalizeVerificationContinuation(continuePath),
    expiresAt,
  });
  return { token, tokenHash: hashExchangeToken(token), expiresAt };
};

const establishBrowserSession = async (res, identity) => {
  const exchange = await createExchange({ kind: "session", ...identity });
  setEmailVerificationCookie(res, exchange.token, getSessionTtlSeconds() * 1000);
};

const findApplicationIdentity = async (firebaseUser) => {
  const byUid = await User.findOne({ firebaseUid: firebaseUser.uid });
  if (byUid) {
    if (emailFingerprint(byUid.email) !== emailFingerprint(firebaseUser.email)) {
      return { failure: "mismatch" };
    }
    return { applicationUser: byUid };
  }

  const byEmail = await User.findOne({ email: String(firebaseUser.email || "").trim().toLowerCase() });
  if (byEmail?.firebaseUid && byEmail.firebaseUid !== firebaseUser.uid) {
    return { failure: "mismatch" };
  }
  return { failure: "notFound" };
};

const reconcileVerifiedIdentity = async (firebaseUser) => {
  if (!firebaseUser?.emailVerified) return { failure: "unverified" };
  const resolved = await findApplicationIdentity(firebaseUser);
  if (!resolved.applicationUser) return resolved;
  const user = resolved.applicationUser;
  if (!user.isEmailVerified || user.onboardingStatus === "verification_pending") {
    user.isEmailVerified = true;
    if (user.onboardingStatus === "verification_pending") user.onboardingStatus = "profile_complete";
    user.emailVerificationLastSentAt = null;
    user.emailVerificationDeliveredAt = null;
    user.emailVerificationSendReservedAt = null;
    user.emailVerificationReservationId = null;
    await user.save();
  }
  return { applicationUser: user };
};

const resolveExchangeIdentity = async (record) => {
  const firebaseAuth = getAuth();
  if (!firebaseAuth) return { unavailable: true };
  let firebaseUser;
  try {
    firebaseUser = await firebaseAuth.getUser(record.firebaseUid);
  } catch (error) {
    if (error?.code === "auth/user-not-found") return { failure: "notFound" };
    throw error;
  }
  if (emailFingerprint(firebaseUser.email) !== record.emailHash) return { failure: "mismatch" };
  const application = await findApplicationIdentity(firebaseUser);
  return { ...application, firebaseAuth, firebaseUser, record };
};

const resolveBrowserIdentity = async (req) => {
  const rawToken = getEmailVerificationToken(req);
  let tokenHash;
  try {
    tokenHash = hashExchangeToken(rawToken);
  } catch {
    return { invalid: true };
  }
  const record = await EmailVerificationExchange.findOne({
    tokenHash,
    kind: "session",
    consumedAt: null,
    expiresAt: { $gt: new Date() },
  }).select("+tokenHash");
  if (!record) return { invalid: true };
  return resolveExchangeIdentity(record);
};

const currentIdentityMatch = async (req, firebaseAuth, targetUid) => {
  const authorization = String(req.headers?.authorization || "");
  if (!authorization.startsWith("Bearer ")) return "none";
  try {
    const decoded = await firebaseAuth.verifyIdToken(authorization.slice(7), true);
    return decoded.uid === targetUid ? "match" : "mismatch";
  } catch {
    return "none";
  }
};

const cooldownFor = (user, now = Date.now()) => {
  const times = [
    user?.emailVerificationLastSentAt,
    user?.emailVerificationDeliveredAt,
    user?.emailVerificationSendReservedAt,
  ].map((value) => value?.getTime?.() || 0);
  return Math.max(0, Math.ceil((Math.max(...times) + EMAIL_VERIFICATION_COOLDOWN_SECONDS * 1000 - now) / 1000));
};

const sentResponse = ({ firebaseUser, continuePath }) => ({
  status: 200,
  body: {
    state: EMAIL_VERIFICATION_STATES.VERIFICATION_EMAIL_RESENT,
    message: "A new verification link has been sent. Please check your inbox and spam folder.",
    maskedEmail: maskEmail(firebaseUser.email),
    retryAfterSeconds: EMAIL_VERIFICATION_COOLDOWN_SECONDS,
    continuePath,
  },
});

const releaseFailedReservation = async (applicationUser, reservationId) => {
  try {
    await User.updateOne(
      { _id: applicationUser._id, emailVerificationReservationId: reservationId },
      { $unset: { emailVerificationSendReservedAt: 1, emailVerificationReservationId: 1 } },
    );
  } catch (error) {
    logger.error({ err: error }, "Email verification send reservation release failed");
  }
};

const sendForIdentity = async ({ firebaseAuth, firebaseUser, applicationUser, continuePath }) => {
  const safeContinuePath = normalizeVerificationContinuation(continuePath);
  if (firebaseUser.emailVerified) {
    const reconciliation = await reconcileVerifiedIdentity(firebaseUser);
    if (reconciliation.failure) return { status: 409, body: {
      state: EMAIL_VERIFICATION_STATES.RECONCILIATION_REQUIRED,
      message: "Your email is verified, but we could not finish updating your account.",
      continuePath: safeContinuePath,
    } };
    return { status: 200, body: {
      state: EMAIL_VERIFICATION_STATES.ALREADY_VERIFIED_ACCOUNT,
      message: "This email address is already verified.",
      maskedEmail: maskEmail(firebaseUser.email),
      continuePath: safeContinuePath,
    } };
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
        { $or: [{ emailVerificationDeliveredAt: null }, { emailVerificationDeliveredAt: { $lte: cutoff } }] },
        { $or: [{ emailVerificationSendReservedAt: null }, { emailVerificationSendReservedAt: { $lte: cutoff } }] },
      ],
    },
    { $set: { emailVerificationSendReservedAt: now, emailVerificationReservationId: reservationId } },
    { new: true },
  );

  if (!reserved) {
    const current = await User.findById(applicationUser._id).select(
      "+emailVerificationLastSentAt +emailVerificationDeliveredAt +emailVerificationSendReservedAt",
    );
    return { status: 429, body: {
      state: EMAIL_VERIFICATION_STATES.RATE_LIMITED_OR_COOLDOWN_ACTIVE,
      message: "Too many requests were made. Please wait before trying again.",
      retryAfterSeconds: Math.max(cooldownFor(current), 1),
      maskedEmail: maskEmail(firebaseUser.email),
      continuePath: safeContinuePath,
    } };
  }

  let actionExchange;
  try {
    actionExchange = await createExchange({
      kind: "action",
      firebaseUid: firebaseUser.uid,
      email: firebaseUser.email,
      continuePath: safeContinuePath,
    });
    const firebaseLink = await firebaseAuth.generateEmailVerificationLink(firebaseUser.email, {
      url: getPublicUrlConfig().emailActionUrl,
      handleCodeInApp: false,
    });
    const verificationLink = buildCustomEmailVerificationLink({
      firebaseLink,
      exchangeToken: actionExchange.token,
    });
    const delivery = await sendEmailVerificationLinkEmail({
      to: firebaseUser.email,
      name: applicationUser.firstName,
      verificationLink,
    });
    if (!delivery?.success) throw new Error("VERIFICATION_DELIVERY_REJECTED");
  } catch (error) {
    if (actionExchange?.tokenHash) {
      await EmailVerificationExchange.updateOne(
        { tokenHash: actionExchange.tokenHash, consumedAt: null },
        { $set: { consumedAt: new Date() } },
      ).catch(() => undefined);
    }
    await releaseFailedReservation(applicationUser, reservationId);
    return { status: 503, body: {
      state: EMAIL_VERIFICATION_STATES.VERIFICATION_EMAIL_SEND_FAILED,
      message: "We could not send a new verification link right now. Please try again.",
      maskedEmail: maskEmail(firebaseUser.email),
      retryAfterSeconds: EMAIL_VERIFICATION_COOLDOWN_SECONDS,
      continuePath: safeContinuePath,
    } };
  }

  try {
    const finalized = await User.updateOne(
      { _id: applicationUser._id, emailVerificationReservationId: reservationId },
      {
        $set: { emailVerificationLastSentAt: now, emailVerificationDeliveredAt: now },
        $unset: { emailVerificationSendReservedAt: 1, emailVerificationReservationId: 1 },
      },
    );
    if (finalized.modifiedCount !== 1) {
      await User.updateOne(
        { _id: applicationUser._id },
        { $set: { emailVerificationDeliveredAt: now } },
      );
      logger.error("Email verification cooldown finalization did not match its reservation");
    }
  } catch (error) {
    logger.error({ err: error }, "Email verification delivered; cooldown finalization failed closed");
  }
  return sentResponse({ firebaseUser, continuePath: safeContinuePath });
};

export const exchangeEmailVerificationToken = async (req, res, next) => {
  try {
    let tokenHash;
    try {
      tokenHash = hashExchangeToken(req.body?.exchangeToken);
    } catch {
      return invalidExchangeResponse(res);
    }
    const record = await EmailVerificationExchange.findOneAndUpdate(
      { tokenHash, kind: "action", consumedAt: null, expiresAt: { $gt: new Date() } },
      { $set: { consumedAt: new Date() } },
      { new: true },
    ).select("+tokenHash");
    if (!record) return invalidExchangeResponse(res);
    const resolved = await resolveExchangeIdentity(record);
    if (resolved.unavailable) return firebaseUnavailable(res);
    if (resolved.failure) return identityFailureResponse(res, resolved.failure);
    await establishBrowserSession(res, {
      firebaseUid: resolved.firebaseUser.uid,
      email: resolved.firebaseUser.email,
      continuePath: record.continuePath,
    });
    return res.json({
      state: resolved.firebaseUser.emailVerified
        ? EMAIL_VERIFICATION_STATES.ALREADY_VERIFIED_ACCOUNT
        : EMAIL_VERIFICATION_STATES.VALID_UNUSED_LINK,
      maskedEmail: maskEmail(resolved.firebaseUser.email),
      continuePath: record.continuePath,
      identityMatch: await currentIdentityMatch(req, resolved.firebaseAuth, resolved.firebaseUser.uid),
    });
  } catch (error) {
    return next(error);
  }
};

export const getEmailVerificationStatus = async (req, res, next) => {
  try {
    const resolved = await resolveBrowserIdentity(req);
    if (resolved.invalid) return invalidExchangeResponse(res);
    if (resolved.unavailable) return firebaseUnavailable(res);
    if (resolved.failure) return identityFailureResponse(res, resolved.failure);
    const identityMatch = await currentIdentityMatch(req, resolved.firebaseAuth, resolved.firebaseUser.uid);
    if (resolved.firebaseUser.emailVerified) {
      const reconciliation = await reconcileVerifiedIdentity(resolved.firebaseUser);
      if (reconciliation.failure) return identityFailureResponse(res, reconciliation.failure);
      return res.json({
        state: EMAIL_VERIFICATION_STATES.ALREADY_VERIFIED_ACCOUNT,
        verified: true,
        message: "This email address is already verified.",
        maskedEmail: maskEmail(resolved.firebaseUser.email),
        continuePath: resolved.record.continuePath,
        retryAfterSeconds: 0,
        identityMatch,
      });
    }
    return res.json({
      state: EMAIL_VERIFICATION_STATES.VALID_UNUSED_LINK,
      message: "This account is awaiting email verification.",
      maskedEmail: maskEmail(resolved.firebaseUser.email),
      continuePath: resolved.record.continuePath,
      retryAfterSeconds: cooldownFor(resolved.applicationUser),
      identityMatch,
    });
  } catch (error) {
    return next(error);
  }
};

export const finalizeEmailVerification = async (req, res, next) => {
  try {
    const resolved = await resolveBrowserIdentity(req);
    if (resolved.invalid) return invalidExchangeResponse(res);
    if (resolved.unavailable) return firebaseUnavailable(res);
    if (resolved.failure) return identityFailureResponse(res, resolved.failure);
    const reconciliation = await reconcileVerifiedIdentity(resolved.firebaseUser);
    if (reconciliation.failure === "unverified") return res.status(409).json({
      state: EMAIL_VERIFICATION_STATES.RECONCILIATION_REQUIRED,
      message: "Your email has not yet been confirmed by Firebase.",
    });
    if (reconciliation.failure) return identityFailureResponse(res, reconciliation.failure);
    return res.json({
      state: EMAIL_VERIFICATION_STATES.VALID_UNUSED_LINK,
      verified: true,
      reconciled: true,
      message: "Your email has been verified successfully.",
      maskedEmail: maskEmail(resolved.firebaseUser.email),
      continuePath: resolved.record.continuePath,
      identityMatch: await currentIdentityMatch(req, resolved.firebaseAuth, resolved.firebaseUser.uid),
    });
  } catch (error) {
    return next(error);
  }
};

export const reconcileAuthenticatedEmailVerification = async (req, res, next) => {
  try {
    const firebaseAuth = getAuth();
    if (!firebaseAuth) return firebaseUnavailable(res);
    const firebaseUser = await firebaseAuth.getUser(req.user.uid);
    const reconciliation = await reconcileVerifiedIdentity(firebaseUser);
    if (reconciliation.failure === "unverified") return res.status(409).json({
      state: EMAIL_VERIFICATION_STATES.RECONCILIATION_REQUIRED,
      message: "Your email has not yet been confirmed by Firebase.",
    });
    if (reconciliation.failure) return identityFailureResponse(res, reconciliation.failure);
    return res.json({
      state: EMAIL_VERIFICATION_STATES.VALID_UNUSED_LINK,
      verified: true,
      reconciled: true,
      message: "Your email has been verified successfully.",
      maskedEmail: maskEmail(firebaseUser.email),
    });
  } catch (error) {
    return next(error);
  }
};

export const resendEmailVerification = async (req, res, next) => {
  try {
    const resolved = await resolveBrowserIdentity(req);
    if (resolved.invalid) return invalidExchangeResponse(res);
    if (resolved.unavailable) return firebaseUnavailable(res);
    if (resolved.failure) return identityFailureResponse(res, resolved.failure);
    const result = await sendForIdentity({ ...resolved, continuePath: resolved.record.continuePath });
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
    const resolved = await findApplicationIdentity(firebaseUser);
    if (resolved.failure) return identityFailureResponse(res, resolved.failure);
    const continuePath = normalizeVerificationContinuation(req.body?.continuePath);
    await establishBrowserSession(res, {
      firebaseUid: firebaseUser.uid,
      email: firebaseUser.email,
      continuePath,
    });
    const result = await sendForIdentity({
      firebaseAuth,
      firebaseUser,
      applicationUser: resolved.applicationUser,
      continuePath,
    });
    return res.status(result.status).json(result.body);
  } catch (error) {
    return next(error);
  }
};
