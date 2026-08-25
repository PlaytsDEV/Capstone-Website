import "dotenv/config";
import crypto from "crypto";
import mongoose from "mongoose";
import { User, AuditLog, Reservation } from "../models/index.js";

const fingerprintOf = (email) =>
  `sha256:${crypto.createHash("sha256").update(String(email).trim().toLowerCase()).digest("hex").slice(0, 12)}`;

await mongoose.connect(process.env.MONGODB_URI);

const admins = await User.find({ role: { $in: ["owner", "branch_admin"] } })
  .select("_id email role branch firstName lastName").lean();

console.log(`Admin/owner accounts found: ${admins.length}\n`);

for (const admin of admins) {
  const fp = fingerprintOf(admin.email);
  console.log("================================================================");
  console.log(`${admin.firstName} ${admin.lastName} | role: ${admin.role} | branch: ${admin.branch || "(all/owner)"} | id: ...${String(admin._id).slice(-6)}`);

  const approvalLogs = await AuditLog.find({
    entityType: "reservation",
    action: { $regex: /approved_for_payment/i },
    user: fp,
  }).select("entityId timestamp action").sort({ timestamp: 1 }).lean();

  console.log(`  Approval events attributable to this admin (via fingerprint match): ${approvalLogs.length}`);
  for (const log of approvalLogs) {
    const reservation = await Reservation.findById(log.entityId).select("reservationCode status").lean();
    console.log(`    ${log.timestamp.toISOString()} | reservation ...${String(log.entityId).slice(-6)}${reservation ? ` (${reservation.reservationCode || "no code"}, status: ${reservation.status})` : " (reservation not found)"}`);
  }
}

await mongoose.disconnect();
