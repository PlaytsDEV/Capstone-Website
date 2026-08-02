import mongoose from "mongoose";
import { SESSION_ASSURANCE_METHODS } from "../config/sessionAssurance.js";
import { User, UserSession } from "../models/index.js";

const activeApplicantClaim = ({ userId, firebaseUid, email }) => ({
  _id: userId,
  firebaseUid,
  email,
  role: "applicant",
  isEmailVerified: true,
  isActive: { $ne: false },
  isArchived: { $ne: true },
  accountStatus: "active",
  initialEmailVerifiedLoginEligibleAt: { $type: "date" },
  initialEmailVerifiedLoginCompletedAt: null,
});

export const claimFirstVerifiedLoginSession = async ({
  user,
  firebaseUid,
  email,
  req,
  deviceId,
  durationMs,
}) => {
  if (!user?._id || !firebaseUid || !email || !deviceId) {
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
        activeApplicantClaim({ userId: user._id, firebaseUid, email }),
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
          userId: user._id,
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

      applicationSession = await UserSession.createSession(user._id, req, {
        deviceId,
        durationMs,
        otpVerified: false,
        assuranceMethod: SESSION_ASSURANCE_METHODS.FIRST_VERIFIED_LOGIN,
        securityVersion: user.securityVersion,
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

export const rollbackFirstVerifiedLoginSession = async ({
  userId,
  firebaseUid,
  completedAt,
  sessionId,
}) => {
  if (!userId || !firebaseUid || !completedAt || !sessionId) return;

  const mongoSession = await mongoose.startSession();
  try {
    await mongoSession.withTransaction(async () => {
      const removed = await UserSession.deleteOne(
        {
          userId,
          sessionId,
          assuranceMethod: SESSION_ASSURANCE_METHODS.FIRST_VERIFIED_LOGIN,
        },
        { session: mongoSession },
      );

      if (removed.deletedCount !== 1) {
        throw new Error("First verified login session rollback could not remove the session");
      }

      const restored = await User.updateOne(
        {
          _id: userId,
          firebaseUid,
          initialEmailVerifiedLoginCompletedAt: completedAt,
        },
        {
          $set: { initialEmailVerifiedLoginCompletedAt: null },
        },
        { session: mongoSession },
      );

      if (restored.modifiedCount !== 1) {
        throw new Error("First verified login eligibility rollback failed");
      }
    });
  } finally {
    await mongoSession.endSession();
  }
};
