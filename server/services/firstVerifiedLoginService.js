import mongoose from "mongoose";
import { SESSION_ASSURANCE_METHODS } from "../config/sessionAssurance.js";
import { User, UserSession } from "../models/index.js";

const activeApplicantClaim = ({
  userId,
  firebaseUid,
  email,
  expectedSecurityVersion,
}) => ({
  _id: userId,
  firebaseUid,
  email,
  securityVersion: expectedSecurityVersion,
  role: "applicant",
  isEmailVerified: true,
  isActive: { $ne: false },
  isArchived: { $ne: true },
  accountStatus: "active",
  initialEmailVerifiedLoginEligibleAt: { $type: "date" },
  initialEmailVerifiedLoginCompletedAt: null,
});

export const claimFirstVerifiedLoginSession = async ({
  userId,
  firebaseUid,
  email,
  expectedSecurityVersion,
  req,
  deviceId,
  durationMs,
}) => {
  if (
    !userId ||
    !firebaseUid ||
    !email ||
    !deviceId ||
    !Number.isSafeInteger(expectedSecurityVersion) ||
    expectedSecurityVersion < 0
  ) {
    return { claimed: false, user: null, session: null, completedAt: null };
  }

  const mongoSession = await mongoose.startSession();
  const completedAt = new Date();
  let claimedUser = null;
  let applicationSession = null;

  try {
    await mongoSession.withTransaction(async () => {
      // withTransaction may retry this callback after a write conflict.
      // Never retain documents created by an aborted attempt.
      claimedUser = null;
      applicationSession = null;
      claimedUser = await User.findOneAndUpdate(
        activeApplicantClaim({
          userId,
          firebaseUid,
          email,
          expectedSecurityVersion,
        }),
        {
          $set: {
            initialEmailVerifiedLoginCompletedAt: completedAt,
            onboardingStatus: "profile_complete",
          },
        },
        { new: true, session: mongoSession },
      );

      if (!claimedUser) return;

      // A challenge issued before email verification must never outlive the
      // one-time exempt session and later create a conflicting login session.
      await UserSession.updateMany(
        {
          userId: claimedUser._id,
          isActive: false,
          otpHash: { $ne: null },
          otpPurpose: { $in: ["login", null] },
        },
        {
          $set: {
            otpHash: null,
            otpExpiresAt: null,
            otpAttempts: 0,
          },
        },
        { session: mongoSession },
      );

      applicationSession = await UserSession.createSession(claimedUser._id, req, {
        deviceId,
        durationMs,
        otpVerified: false,
        assuranceMethod: SESSION_ASSURANCE_METHODS.FIRST_VERIFIED_LOGIN,
        securityVersion: claimedUser.securityVersion,
        loginTime: completedAt,
        mongoSession,
      });
    });

    return {
      claimed: Boolean(claimedUser && applicationSession),
      user: claimedUser,
      session: applicationSession,
      completedAt: claimedUser && applicationSession ? completedAt : null,
    };
  } finally {
    await mongoSession.endSession();
  }
};

export const cleanupFailedFirstVerifiedLoginSession = async ({
  userId,
  sessionId,
  deviceId,
  loginTime,
}) => {
  if (!userId || !sessionId || !deviceId || !loginTime) {
    return { cleaned: false };
  }

  // Consumption is permanent once the claim transaction commits. If cookie
  // serialization fails, remove only the exact active session created by that
  // request. A missing/already-cleaned session is an intentional safe no-op.
  const removed = await UserSession.deleteOne({
    userId,
    sessionId,
    deviceId,
    assuranceMethod: SESSION_ASSURANCE_METHODS.FIRST_VERIFIED_LOGIN,
    loginTime,
    isActive: true,
    logoutTime: null,
  });

  return { cleaned: removed.deletedCount === 1 };
};
