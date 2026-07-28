/**
 * force_delete_tenant.mjs
 * ============================================================================
 * Hard-purge a specific tenant and EVERY record tied to them across all
 * collections. Releases any beds they occupy and recomputes room occupancy.
 *
 * Usage:
 *   node scripts/force_delete_tenant.mjs --name "Vince Palipci"
 *   node scripts/force_delete_tenant.mjs --email "someone@email.com"
 *   node scripts/force_delete_tenant.mjs --userId "64abc..."
 *   node scripts/force_delete_tenant.mjs --name "Vince Palipci" --dry-run
 *
 * What is deleted:
 *   User, UserSession, LoginLog
 *   Reservation(s) linked to that user
 *   Bill, Payment, AcknowledgmentAccount (by reservationId or userId)
 *   BedHistory, Stay (by reservationId or tenantId)
 *   Contract (by tenantId or reservationId)
 *   MaintenanceRequest, Notification, ChatConversation, ChatMessage
 *   AuditLog entries authored by this user
 *   Beds in any Room with occupiedBy.userId matching this user → released
 *   Room currentOccupancy recomputed after release
 * ============================================================================
 */

import dotenv from "dotenv";
import mongoose from "mongoose";

import {
  User,
  Room,
  Reservation,
  Bill,
  Payment,
  AcknowledgmentAccount,
  BedHistory,
  Stay,
  Contract,
  MaintenanceRequest,
  Notification,
  ChatConversation,
  ChatMessage,
  AuditLog,
  UserSession,
  LoginLog,
} from "../models/index.js";

dotenv.config();

// ── CLI flags ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (key) => {
  const idx = args.indexOf(key);
  return idx !== -1 ? args[idx + 1] : null;
};

const TARGET_NAME   = flag("--name");
const TARGET_EMAIL  = flag("--email");
const TARGET_ID     = flag("--userId");
const DRY_RUN       = args.includes("--dry-run");

if (!TARGET_NAME && !TARGET_EMAIL && !TARGET_ID) {
  console.error("❌  Provide at least one of: --name, --email, --userId");
  process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const line  = (c = "=") => c.repeat(70);
const ok    = (msg) => console.log(`  ✔  ${msg}`);
const info  = (msg) => console.log(`  ℹ  ${msg}`);
const warn  = (msg) => console.log(`  ⚠  ${msg}`);
const skip  = (msg) => console.log(`  —  ${msg}`);
const del   = (model, n) => {
  if (DRY_RUN) {
    skip(`[DRY-RUN] Would delete ${n} ${model} record(s)`);
  } else {
    ok(`Deleted ${n} ${model} record(s)`);
  }
};

async function deleteMany(Model, filter, label) {
  const count = await Model.countDocuments(filter);
  if (count === 0) { skip(`No ${label} records found`); return 0; }
  if (!DRY_RUN) await Model.deleteMany(filter);
  del(label, count);
  return count;
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log(line());
  console.log(`  FORCE-DELETE TENANT SCRIPT${DRY_RUN ? " [DRY-RUN]" : ""}`);
  console.log(line());

  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  info("Connected to MongoDB");

  // 1. Resolve the target User document
  let userQuery = {};
  if (TARGET_ID)    userQuery = { _id: TARGET_ID };
  else if (TARGET_EMAIL) userQuery = { email: TARGET_EMAIL };
  else {
    const [firstName, ...rest] = TARGET_NAME.trim().split(/\s+/);
    userQuery = {
      $or: [
        { firstName: new RegExp(`^${firstName}$`, "i"), lastName: new RegExp(`^${rest.join(" ")}$`, "i") },
        { username: new RegExp(TARGET_NAME.replace(/\s+/g, ""), "i") },
      ],
    };
  }

  const user = await User.findOne(userQuery).lean();
  if (!user) {
    warn("No matching user found. Exiting.");
    await mongoose.disconnect();
    process.exit(0);
  }

  const userId = String(user._id);
  info(`Found user: ${user.firstName} ${user.lastName} | ${user.email || "no-email"} | _id: ${userId}`);
  console.log(line("-"));

  // 2. Find all reservations for this user
  const reservations = await Reservation.find({ userId: user._id }).select("_id").lean();
  const reservationIds = reservations.map((r) => r._id);
  info(`Found ${reservationIds.length} reservation(s)`);

  // 3. Delete billing & payments
  await deleteMany(Bill,    { $or: [{ reservationId: { $in: reservationIds } }, { userId: user._id }] }, "Bill");
  await deleteMany(Payment, { $or: [{ reservationId: { $in: reservationIds } }, { userId: user._id }] }, "Payment");
  await deleteMany(AcknowledgmentAccount, { userId: user._id }, "AcknowledgmentAccount");

  // 4. Delete stay history & bed history
  await deleteMany(Stay,       { $or: [{ reservationId: { $in: reservationIds } }, { tenantId: user._id }] }, "Stay");
  await deleteMany(BedHistory, { $or: [{ reservationId: { $in: reservationIds } }, { tenantId: user._id }] }, "BedHistory");

  // 5. Delete contracts
  await deleteMany(Contract, {
    $or: [
      { reservationId: { $in: reservationIds } },
      { tenantId: user._id },
      { userId: user._id },
    ],
  }, "Contract");

  // 6. Delete maintenance requests
  await deleteMany(MaintenanceRequest, {
    $or: [{ userId: user._id }, { tenantId: user._id }, { reservationId: { $in: reservationIds } }],
  }, "MaintenanceRequest");

  // 7. Delete notifications
  await deleteMany(Notification, { userId: user._id }, "Notification");

  // 8. Delete chat conversations & messages
  const chatConvs = await ChatConversation.find({
    $or: [{ tenantId: user._id }, { participants: user._id }],
  }).select("_id").lean();
  const chatConvIds = chatConvs.map((c) => c._id);
  await deleteMany(ChatMessage, { conversationId: { $in: chatConvIds } }, "ChatMessage");
  await deleteMany(ChatConversation, { _id: { $in: chatConvIds } }, "ChatConversation");

  // 9. Delete audit logs authored by this user
  await deleteMany(AuditLog, { performedBy: user._id }, "AuditLog");

  // 10. Delete sessions & login logs
  await deleteMany(UserSession, { userId: user._id }, "UserSession");
  await deleteMany(LoginLog,    { userId: user._id }, "LoginLog");

  // 11. Delete reservations
  await deleteMany(Reservation, { userId: user._id }, "Reservation");

  // 12. Release beds in all rooms occupied by this user
  info("Scanning rooms for occupied beds...");
  const rooms = await Room.find({ "beds.occupiedBy.userId": user._id }).lean();
  info(`Found ${rooms.length} room(s) with beds occupied by this user`);

  for (const room of rooms) {
    const affectedBeds = room.beds.filter(
      (b) => b.occupiedBy && String(b.occupiedBy.userId) === userId,
    );
    info(`  Room ${room.name || room._id}: releasing ${affectedBeds.length} bed(s)`);

    if (!DRY_RUN) {
      // Build $set for each affected bed by positional index
      const setFields = {};
      for (const b of affectedBeds) {
        const idx = room.beds.findIndex((rb) => String(rb._id) === String(b._id));
        if (idx === -1) continue;
        setFields[`beds.${idx}.status`]     = "available";
        setFields[`beds.${idx}.occupiedBy`] = null;
      }
      await Room.updateOne({ _id: room._id }, { $set: setFields });

      // Recompute currentOccupancy from live active reservations
      const liveOccupancy = await Reservation.countDocuments({
        roomId: room._id,
        isArchived: { $ne: true },
        status: { $in: ["reserved", "moveIn", "checked-in", "checked_in"] },
      });
      await Room.updateOne({ _id: room._id }, { $set: { currentOccupancy: liveOccupancy } });
      ok(`  Room ${room.name || room._id}: occupancy reset to ${liveOccupancy}`);
    } else {
      skip(`[DRY-RUN] Would release ${affectedBeds.length} bed(s) in room ${room.name || room._id}`);
    }
  }

  // 13. Delete the User record itself
  if (!DRY_RUN) {
    await User.deleteOne({ _id: user._id });
    ok(`User document deleted: ${user.firstName} ${user.lastName} (${userId})`);
  } else {
    skip(`[DRY-RUN] Would delete User: ${user.firstName} ${user.lastName} (${userId})`);
  }

  console.log(line());
  console.log(DRY_RUN
    ? "  ✅  DRY-RUN complete. No data was modified."
    : "  ✅  Tenant fully purged from all collections.");
  console.log(line());

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("❌  Script failed:", err);
  mongoose.disconnect();
  process.exit(1);
});
