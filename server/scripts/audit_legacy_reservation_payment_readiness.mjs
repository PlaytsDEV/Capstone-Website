import dotenv from "dotenv";
import mongoose from "mongoose";
import { Reservation } from "../models/index.js";
import {
  evaluateReservationPaymentReadiness,
} from "../services/reservationPaymentReadinessService.js";
import {
  evaluateReservationMoveInReadiness,
} from "../services/reservationMoveInReadinessService.js";

dotenv.config();
if (process.argv.some((value) => ["--write", "--apply", "--repair"].includes(value))) {
  throw new Error("This audit is dry-run only and never changes Reservation records.");
}
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");

await mongoose.connect(process.env.MONGODB_URI);
try {
  const reservations = await Reservation.find({
    status: {
      $in: [
        "pending_application_review",
        "approved_for_payment",
        "payment_pending",
        "reserved",
        "moveIn",
      ],
    },
    isArchived: { $ne: true },
  }).sort({ createdAt: 1 });

  const report = [];
  for (const reservation of reservations) {
    const [payment, moveIn] = await Promise.all([
      evaluateReservationPaymentReadiness(reservation),
      evaluateReservationMoveInReadiness(reservation),
    ]);
    if (payment.ready && moveIn.ready) continue;
    report.push({
      reservationId: String(reservation._id),
      applicant: {
        firstName: reservation.firstName || "",
        lastName: reservation.lastName || "",
      },
      branch: payment.resolved.branch || null,
      status: reservation.status,
      missingPricingFields: payment.missingFields.filter((field) =>
        /rent|deposit|fee|amount|pricing|currency/i.test(field)),
      missingAssignmentFields: payment.missingFields.filter((field) =>
        /branch|room|bed|moveIn|lease/i.test(field)),
      missingApprovalFields: payment.missingFields.filter((field) =>
        /approval|application|document|deadline|paymentMethod/i.test(field)),
      paymentReadiness: {
        ready: payment.ready,
        legacy: payment.legacy,
        missingFields: payment.missingFields,
      },
      moveInReadiness: {
        ready: moveIn.ready,
        blockers: moveIn.blockers,
      },
    });
  }
  process.stdout.write(`${JSON.stringify({
    dryRun: true,
    scanned: reservations.length,
    repairNeeded: report.length,
    reservations: report,
  }, null, 2)}\n`);
} finally {
  await mongoose.disconnect();
}
