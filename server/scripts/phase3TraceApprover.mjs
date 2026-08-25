import "dotenv/config";
import crypto from "crypto";
import mongoose from "mongoose";
import { User, AuditLog, Reservation } from "../models/index.js";

const fingerprintOf = (email) =>
  `sha256:${crypto.createHash("sha256").update(String(email).trim().toLowerCase()).digest("hex").slice(0, 12)}`;

const targets = [
  { name: "Marie Saoirse", reservationId: "6a7b7b6b1f06fd59305dccfc" },
  { name: "Remedios Mercolita", reservationId: "6a7b30cb1f06fd59305da357" },
];

await mongoose.connect(process.env.MONGODB_URI);

// Build a fingerprint index against EVERY user account regardless of role
// or archived status, not just current owner/branch_admin — to check for a
// former admin, a role change, or a deleted/archived account.
const allUsers = await User.find({}).select("_id email role branch isArchived firstName lastName").lean();
const byFingerprint = new Map();
for (const u of allUsers) {
  const fp = fingerprintOf(u.email);
  if (!byFingerprint.has(fp)) byFingerprint.set(fp, []);
  byFingerprint.get(fp).push(u);
}
console.log(`Total User accounts checked (any role, any archive state): ${allUsers.length}\n`);

for (const { name, reservationId } of targets) {
  console.log("================================================================");
  console.log(`${name} — reservation ...${reservationId.slice(-6)}`);

  const logs = await AuditLog.find({
    entityType: "reservation",
    entityId: reservationId,
  }).sort({ timestamp: 1 }).lean();

  console.log(`  Total AuditLog entries for this reservation: ${logs.length}`);
  for (const log of logs) {
    console.log(`  ---`);
    console.log(`  action: ${log.action}`);
    console.log(`  timestamp: ${log.timestamp?.toISOString?.() || log.timestamp}`);
    console.log(`  userId field (direct FK, if any): ${log.userId || "(empty)"}`);
    console.log(`  user field (fingerprint/role string): ${log.user || "(empty)"}`);
    console.log(`  userRole: ${log.userRole || "(empty)"}`);
    if (log.user && String(log.user).startsWith("sha256:")) {
      const matches = byFingerprint.get(log.user) || [];
      console.log(`  fingerprint match against ALL users (any role/archive state): ${matches.length} match(es)`);
      for (const m of matches) {
        console.log(`    -> ${m.firstName} ${m.lastName} | role: ${m.role} | branch: ${m.branch || "(n/a)"} | archived: ${Boolean(m.isArchived)}`);
      }
    }
  }
}

await mongoose.disconnect();
