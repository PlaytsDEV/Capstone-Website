// System Assist: Move-in reminders and at-risk flag
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Reservation } from "../models/index.js";
import { sendMoveInReminder } from "../utils/email.js";

dotenv.config();

async function runMoveInAssist() {
  await mongoose.connect(process.env.MONGODB_URI);
  const now = new Date();

  // 1. Send reminder on Day 1 after move-in date if not checked-in
  const toRemind = await Reservation.find({
    status: { $in: ["pending", "confirmed"] },
    moveInReminderSent: false,
    moveInReminderDate: { $lte: now },
  });
  for (const res of toRemind) {
    await sendMoveInReminder(res);
    res.moveInReminderSent = true;
    await res.save();
    console.log(`Reminder sent for reservation ${res._id}`);
  }

  // 2. Flag as at-risk on Day 2 after move-in date if not checked-in
  const toFlag = await Reservation.find({
    status: { $in: ["pending", "confirmed"] },
    atRisk: false,
    moveInRiskDate: { $lte: now },
  });
  for (const res of toFlag) {
    res.atRisk = true;
    res.status = "at-risk";
    await res.save();
    console.log(`Flagged as at-risk: ${res._id}`);
  }

  await mongoose.disconnect();
}

runMoveInAssist().catch((err) => {
  console.error("Move-in assist error:", err);
  process.exit(1);
});
