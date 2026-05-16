import dotenv from "dotenv";
import mongoose from "mongoose";

import { Bill, Reservation, User, UtilityReading } from "../models/index.js";

dotenv.config();

const LOOKBACK_DAYS = Number(
  process.argv.find((arg) => arg.startsWith("--days="))?.split("=")[1] || 30,
);
const CANDIDATE_PATTERN = /seed|dummy|test|sample|demo|faker|analytics/i;
const PROTECTED_PATTERN = /pixdummy/i;

function getMongoConnectOptions() {
  return process.env.DB_NAME ? { dbName: process.env.DB_NAME } : {};
}

function userText(user) {
  return [
    user.email,
    user.username,
    user.firebaseUid,
    user.firstName,
    user.lastName,
  ]
    .filter(Boolean)
    .join(" ");
}

async function summarizeUser(user) {
  const [reservations, bills, utilityReadings] = await Promise.all([
    Reservation.countDocuments({ userId: user._id }),
    Bill.countDocuments({ userId: user._id }),
    UtilityReading.countDocuments({
      $or: [{ tenantId: user._id }, { activeTenantIds: user._id }],
    }),
  ]);

  return {
    email: user.email,
    username: user.username,
    name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
    role: user.role,
    tenantStatus: user.tenantStatus,
    branch: user.branch || "",
    isArchived: Boolean(user.isArchived),
    protected: PROTECTED_PATTERN.test(user.email || ""),
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    reservations,
    bills,
    utilityReadings,
  };
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured");
  }

  await mongoose.connect(process.env.MONGODB_URI, getMongoConnectOptions());

  const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000);
  const users = await User.find({
    $or: [
      { createdAt: { $gte: since } },
      { updatedAt: { $gte: since } },
      { email: CANDIDATE_PATTERN },
      { username: CANDIDATE_PATTERN },
      { firebaseUid: CANDIDATE_PATTERN },
      { firstName: CANDIDATE_PATTERN },
      { lastName: CANDIDATE_PATTERN },
    ],
  })
    .select(
      "_id email username firebaseUid firstName lastName role tenantStatus branch isArchived createdAt updatedAt",
    )
    .sort({ createdAt: -1 })
    .lean();

  const candidates = users.filter((user) => {
    const text = userText(user);
    return CANDIDATE_PATTERN.test(text) || user.createdAt >= since;
  });

  const summaries = await Promise.all(candidates.map(summarizeUser));

  console.log(
    JSON.stringify(
      {
        lookbackDays: LOOKBACK_DAYS,
        since,
        totalCandidates: summaries.length,
        protectedPixdummy: summaries.filter((entry) => entry.protected).length,
        candidates: summaries,
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(`[scan-seeded-account-candidates] ERROR: ${error.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
