/**
 * purge_orphan_6a66dd21.mjs
 * ============================================================================
 * One-shot: deletes every record linked to the orphaned userId
 * 6a66dd212a933df0bb463fc5 (User document already missing) and releases
 * any beds it still occupies in rooms GP-304 and GP-306.
 * ============================================================================
 */

import dotenv from "dotenv";
import mongoose from "mongoose";
import {
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
  Room,
} from "../models/index.js";

dotenv.config();

const ORPHAN_USER_ID  = new mongoose.Types.ObjectId("6a66dd212a933df0bb463fc5");
const RESERVATION_IDS = [
  new mongoose.Types.ObjectId("6a66df372a933df0bb46429e"),
  new mongoose.Types.ObjectId("6a66f53b57eb68bd2ea38739"),
  new mongoose.Types.ObjectId("6a66f71ec8755e4da6c13ad5"),
];

const ok   = (msg) => console.log(`  ✔  ${msg}`);
const info = (msg) => console.log(`  ℹ  ${msg}`);

async function sweep(Model, filter, label) {
  const n = await Model.countDocuments(filter);
  if (n > 0) {
    await Model.deleteMany(filter);
    ok(`Deleted ${n} ${label}`);
  } else {
    console.log(`  —  No ${label} found`);
  }
}

async function main() {
  console.log("=".repeat(68));
  console.log("  PURGE ORPHAN 6a66dd212a933df0bb463fc5");
  console.log("=".repeat(68));

  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  info("Connected to MongoDB");

  // ── Billing & payments ────────────────────────────────────────────────────
  await sweep(Bill, {
    $or: [
      { reservationId: { $in: RESERVATION_IDS } },
      { userId: ORPHAN_USER_ID },
    ],
  }, "Bill records");

  await sweep(Payment, {
    $or: [
      { reservationId: { $in: RESERVATION_IDS } },
      { userId: ORPHAN_USER_ID },
    ],
  }, "Payment records");

  await sweep(AcknowledgmentAccount, { userId: ORPHAN_USER_ID }, "AcknowledgmentAccount records");

  // ── Stay & bed history ────────────────────────────────────────────────────
  await sweep(Stay, {
    $or: [
      { reservationId: { $in: RESERVATION_IDS } },
      { tenantId: ORPHAN_USER_ID },
    ],
  }, "Stay records");

  await sweep(BedHistory, {
    $or: [
      { reservationId: { $in: RESERVATION_IDS } },
      { tenantId: ORPHAN_USER_ID },
    ],
  }, "BedHistory records");

  // ── Contracts ─────────────────────────────────────────────────────────────
  await sweep(Contract, {
    $or: [
      { reservationId: { $in: RESERVATION_IDS } },
      { tenantId: ORPHAN_USER_ID },
      { userId: ORPHAN_USER_ID },
    ],
  }, "Contract records");

  // ── Maintenance, notifications, chat ─────────────────────────────────────
  await sweep(MaintenanceRequest, {
    $or: [
      { userId: ORPHAN_USER_ID },
      { reservationId: { $in: RESERVATION_IDS } },
    ],
  }, "MaintenanceRequest records");

  await sweep(Notification, { userId: ORPHAN_USER_ID }, "Notification records");

  const convs = await ChatConversation.find({
    $or: [{ tenantId: ORPHAN_USER_ID }, { participants: ORPHAN_USER_ID }],
  }).select("_id").lean();
  if (convs.length > 0) {
    const convIds = convs.map((c) => c._id);
    await sweep(ChatMessage, { conversationId: { $in: convIds } }, "ChatMessage records");
    await sweep(ChatConversation, { _id: { $in: convIds } }, "ChatConversation records");
  } else {
    console.log("  —  No ChatConversation records found");
  }

  await sweep(AuditLog,    { performedBy: ORPHAN_USER_ID }, "AuditLog records");
  await sweep(UserSession, { userId: ORPHAN_USER_ID },      "UserSession records");
  await sweep(LoginLog,    { userId: ORPHAN_USER_ID },      "LoginLog records");

  // ── Delete the 3 reservations ─────────────────────────────────────────────
  await sweep(Reservation, { _id: { $in: RESERVATION_IDS } }, "Reservation records");

  // ── Release beds in GP-304 and GP-306 ────────────────────────────────────
  info("Scanning rooms for orphaned bed occupancy...");

  const rooms = await Room.find({
    "beds.occupiedBy.userId": ORPHAN_USER_ID,
  }).lean();

  if (rooms.length === 0) {
    console.log("  —  No rooms have beds occupied by this orphan userId");
  }

  for (const room of rooms) {
    const affected = room.beds.filter(
      (b) => b.occupiedBy && String(b.occupiedBy.userId) === String(ORPHAN_USER_ID),
    );
    info(`Room ${room.name || room._id}: releasing ${affected.length} bed(s)`);

    const setFields = {};
    for (const b of affected) {
      const idx = room.beds.findIndex((rb) => String(rb._id) === String(b._id));
      if (idx === -1) continue;
      setFields[`beds.${idx}.status`]     = "available";
      setFields[`beds.${idx}.occupiedBy`] = null;
    }
    await Room.updateOne({ _id: room._id }, { $set: setFields });

    // Recompute occupancy from live reservations only
    const live = await Reservation.countDocuments({
      roomId: room._id,
      isArchived: { $ne: true },
      status: { $in: ["reserved", "moveIn", "checked-in", "checked_in", "approved_for_payment"] },
    });
    await Room.updateOne({ _id: room._id }, { $set: { currentOccupancy: live } });
    ok(`Room ${room.name || room._id}: occupancy set to ${live}`);
  }

  console.log("=".repeat(68));
  console.log("  ✅  Purge complete.");
  console.log("=".repeat(68));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("❌  Script failed:", err);
  mongoose.disconnect();
  process.exit(1);
});
