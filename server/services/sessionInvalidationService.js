import mongoose from "mongoose";
import { getAuth } from "../config/firebase.js";
import auditLogger from "../utils/auditLogger.js";
import coreModule from "../security/sessionInvalidationCore.cjs";

export async function invalidateUserSessions({ user, userId, mongoId, firebaseUid, reason, req, failClosed = true }) {
  const resolvedUserId = userId || user?.user_id;
  const resolvedMongoId = mongoId || user?._id;
  const resolvedFirebaseUid = firebaseUid || user?.firebaseUid || user?.firebase_uid;
  return coreModule.invalidateUserSessionsCore({
    db: mongoose.connection.db,
    adminAuth: getAuth(), userId: resolvedUserId, mongoId: resolvedMongoId,
    firebaseUid: resolvedFirebaseUid, reason, failClosed,
    audit: async ({ failures }) => auditLogger.log({
      req, type: "security", action: "Sessions invalidated", severity: failures.length ? "warning" : "info",
      details: reason, metadata: { userId: String(resolvedMongoId || resolvedUserId || ""), failedStores: failures },
    }),
  });
}
