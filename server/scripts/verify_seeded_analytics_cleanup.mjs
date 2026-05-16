import dotenv from "dotenv";
import mongoose from "mongoose";

import { Reservation, User } from "../models/index.js";

dotenv.config();

const SEED_ANALYTICS_PATTERN = /^seed\.analytics\.tenant\./i;
const PIXDUMMY_PATTERN = /^pixdummy\./i;

function getMongoConnectOptions() {
  return process.env.DB_NAME ? { dbName: process.env.DB_NAME } : {};
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured");
  }

  await mongoose.connect(process.env.MONGODB_URI, getMongoConnectOptions());

  const [
    seedAnalyticsUsers,
    seedAnalyticsReservations,
    pixdummyUsers,
    pixdummyReservations,
  ] = await Promise.all([
    User.countDocuments({ email: SEED_ANALYTICS_PATTERN }),
    Reservation.countDocuments({ billingEmail: SEED_ANALYTICS_PATTERN }),
    User.countDocuments({ email: PIXDUMMY_PATTERN }),
    Reservation.countDocuments({ billingEmail: PIXDUMMY_PATTERN }),
  ]);

  console.log(
    JSON.stringify(
      {
        seedAnalyticsUsers,
        seedAnalyticsReservations,
        pixdummyUsers,
        pixdummyReservations,
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(`[verify-seeded-analytics-cleanup] ERROR: ${error.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
