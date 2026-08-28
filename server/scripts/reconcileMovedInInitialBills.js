import mongoose from "mongoose";
import dotenv from "dotenv";
import { Bill, Reservation } from "../models/index.js";
import { settleInitialMoveInOnCheckIn } from "../services/billing/billSettlement.js";
import connectDB from "../config/database.js";
import logger from "../middleware/logger.js";

dotenv.config();

export async function reconcileAllMovedInInitialBills({ dryRun = false } = {}) {
  const movedInReservations = await Reservation.find({
    status: { $in: ["moveIn", "checked-in"] },
    isArchived: { $ne: true },
  });

  let reconciledCount = 0;
  const errors = [];

  for (const res of (movedInReservations || [])) {
    try {
      let bill = null;
      if (res.initialPaymentBillId) {
        bill = await Bill.findById(res.initialPaymentBillId);
      }
      if (!bill) {
        bill = await Bill.findOne({
          reservationId: res._id,
          billType: "initial_payment",
          isArchived: { $ne: true },
        });
      }

      if (bill && (bill.status !== "paid" || Number(bill.remainingAmount || 0) > 0)) {
        if (!dryRun) {
          await settleInitialMoveInOnCheckIn({
            reservation: res,
            actorId: "system-reconciliation",
            paymentMethod: "offline_cash",
          });
        }
        reconciledCount++;
      }
    } catch (err) {
      errors.push({ reservationId: res._id, error: err.message });
    }
  }

  return {
    scannedCount: (movedInReservations || []).length,
    reconciledCount,
    errors,
  };
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/reconcileMovedInInitialBills.js")) {
  connectDB().then(async (connected) => {
    if (!connected) {
      console.error("Could not connect to MongoDB. Ensure MONGODB_URI is set.");
      process.exit(1);
    }
    console.log("Starting reconciliation of moved-in initial bills...");
    const result = await reconcileAllMovedInInitialBills();
    console.log("Reconciliation finished:", result);
    process.exit(0);
  }).catch((err) => {
    console.error("Reconciliation error:", err);
    process.exit(1);
  });
}
