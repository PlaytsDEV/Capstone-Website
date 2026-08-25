import dotenv from "dotenv";
import mongoose from "mongoose";

dotenv.config();

const { Contract, Reservation } = await import("../models/index.js");
const { resolveReservationContractEligibility } = await import(
  "../services/reservationContractEligibilityService.js"
);

await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
console.log("Connected:", mongoose.connection.name);

const contract = await Contract.findOne({ contractNumber: /00027/ }).lean();
console.log("\n=== CONTRACT 00027 (current) ===");
console.log(JSON.stringify({
  status: contract.status,
  bedId: contract.bedId,
  bedLabel: contract.bedLabel,
  preparedDocument: contract.preparedDocument ? "present" : "absent",
  updatedAt: contract.updatedAt,
}, null, 2));

const reservation = await Reservation.findById(contract.reservationId).lean();
console.log("\n=== RESERVATION (current) ===");
console.log(JSON.stringify({
  status: reservation.status,
  applicationReviewedAt: reservation.applicationReviewedAt,
  applicationReviewedBy: reservation.applicationReviewedBy,
}, null, 2));

const eligibility = resolveReservationContractEligibility(reservation, {
  bedExists: Boolean(contract.bedId || contract.bedLabel),
});
console.log("\n=== ELIGIBILITY (current) ===");
console.log(JSON.stringify(eligibility, null, 2));

console.log("\n=== ALL STUCK CONTRACTS NOW ===");
const stuck = await Contract.find({
  isCurrent: true,
  status: { $in: ["draft", "incomplete", "ready_for_generation"] },
}).select("contractNumber status bedId bedLabel reservationId").lean();
console.log(`Total stuck: ${stuck.length}`);
for (const c of stuck) {
  const res = await Reservation.findById(c.reservationId).lean();
  const elig = res ? resolveReservationContractEligibility(res, { bedExists: Boolean(c.bedId || c.bedLabel) }) : null;
  console.log(`  ${c.contractNumber} status=${c.status} eligible=${elig?.eligible} blocker=${elig?.blockers[0]?.code || (res ? "none" : "NO_RESERVATION")}`);
}

await mongoose.disconnect();
