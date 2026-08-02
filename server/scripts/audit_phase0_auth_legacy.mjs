import "dotenv/config";
import mongoose from "mongoose";
import { connectDB } from "../config/database.js";

const maskEmail = (value = "") => {
  const [local, domain] = String(value).split("@");
  return local && domain ? `${local.slice(0, 2)}***@${domain}` : "(missing)";
};

await connectDB();
const db = mongoose.connection.db;
if (!db) throw new Error("MongoDB is unavailable");

const users = db.collection("users");
const sessions = db.collection("user_sessions");
const otp = db.collection("otp_store");
const checks = {
  residentRole: { role: "resident" },
  dualUidFields: { firebaseUid: { $exists: true }, firebase_uid: { $exists: true } },
  conflictingActiveFields: { $expr: { $ne: ["$isActive", "$is_active"] }, isActive: { $exists: true }, is_active: { $exists: true } },
  missingFirebaseUid: { firebaseUid: { $exists: false }, firebase_uid: { $exists: false } },
};

const counts = {};
for (const [name, query] of Object.entries(checks)) counts[name] = await users.countDocuments(query);
counts.plaintextOtpRecords = await otp.countDocuments({ otp_code: { $exists: true } });

const duplicateUids = await users.aggregate([
  { $project: { user_id: 1, uid: { $ifNull: ["$firebaseUid", "$firebase_uid"] } } },
  { $match: { uid: { $nin: [null, ""] } } },
  { $group: { _id: "$uid", count: { $sum: 1 }, userIds: { $push: "$user_id" } } },
  { $match: { count: { $gt: 1 } } },
  { $project: { _id: 0, count: 1, userIds: 1 } },
]).toArray();
counts.duplicateUidGroups = duplicateUids.length;

const inactiveIds = await users.find({
  $or: [{ isActive: false }, { is_active: false }, { accountStatus: { $in: ["suspended", "banned", "pending_verification"] } }, { isArchived: true }, { is_archived: true }],
}, { projection: { user_id: 1 } }).toArray();
counts.activeSessionsForRestrictedAccounts = await sessions.countDocuments({ user_id: { $in: inactiveIds.map((u) => u.user_id).filter(Boolean) } });

const samples = await users.find({ role: "resident" }, { projection: { user_id: 1, email: 1 } }).limit(20).toArray();
console.log(JSON.stringify({ readOnly: true, counts, duplicateUidGroups: duplicateUids, residentSamples: samples.map((u) => ({ userId: u.user_id, email: maskEmail(u.email) })) }, null, 2));
await mongoose.disconnect();
