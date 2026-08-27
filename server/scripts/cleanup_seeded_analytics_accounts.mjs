/**
import { assertStagingWriteTarget } from "./stagingWriteGuard.js";
assertStagingWriteTarget(process.env, { toolName: "cleanup_seeded_analytics_accounts.mjs" });

 * Cleanup seeded analytics tenant accounts.
 *
 * Dry run:
 *   node scripts/cleanup_seeded_analytics_accounts.mjs
 *
 * Apply:
 *   node scripts/cleanup_seeded_analytics_accounts.mjs --write
 *
 * Important guardrail:
 * - pixdummy accounts and records are never selected as cleanup targets.
 */

import dotenv from "dotenv";
import mongoose from "mongoose";

import {
  AcknowledgmentAccount,
  BedHistory,
  Bill,
  BillingPeriod,
  BillingResult,
  ChatConversation,
  ChatMessage,
  MaintenanceRequest,
  MeterReading,
  Notification,
  Payment,
  Reservation,
  Room,
  Stay,
  User,
  UtilityPeriod,
  UtilityReading,
} from "../models/index.js";

dotenv.config();

const WRITE = process.argv.includes("--write");
const TARGET_EMAILS = [
  "seed.quad.baseline@example.com",
  "seed.quad.partial@example.com",
  "seed.quad.late@example.com",
  "seed.quad.endcycle@example.com",
];
const TARGET_EMAIL_PATTERN = /^seed\.analytics\.tenant\./i;
const PROTECTED_EMAIL_PATTERN = /pixdummy/i;
const ACTIVE_OCCUPANCY_STATUSES = ["reserved", "moveIn"];

const line = (char = "=") => char.repeat(72);
const mode = () => (WRITE ? "WRITE" : "DRY RUN");
const info = (message) => console.log(`  INFO ${message}`);
const ok = (message) => console.log(`  OK   ${message}`);
const skip = (message) => console.log(`  SKIP ${message}`);

function getMongoConnectOptions() {
  return process.env.DB_NAME ? { dbName: process.env.DB_NAME } : {};
}

function asIdStrings(values) {
  return [
    ...new Set(
      Array.from(values || [])
        .filter(Boolean)
        .map((value) => String(value)),
    ),
  ];
}

function asObjectIds(values) {
  return asIdStrings(values).map((value) => new mongoose.Types.ObjectId(value));
}

function objectIdSet(values) {
  return new Set(asIdStrings(values));
}

function assertPixdummyProtected(users) {
  const protectedMatches = users.filter((user) =>
    PROTECTED_EMAIL_PATTERN.test(user.email || ""),
  );

  if (protectedMatches.length > 0) {
    const emails = protectedMatches.map((user) => user.email).join(", ");
    throw new Error(`Refusing to target protected pixdummy account(s): ${emails}`);
  }
}

async function count(model, filter) {
  return model.countDocuments(filter);
}

async function deleteMany(label, model, filter) {
  const total = await count(model, filter);
  if (!WRITE) {
    console.log(`  PLAN delete ${String(total).padStart(4)} ${label}`);
    return total;
  }

  if (total === 0) {
    skip(`No ${label} to delete`);
    return 0;
  }

  const result = await model.deleteMany(filter);
  ok(`Deleted ${result.deletedCount} ${label}`);
  return result.deletedCount;
}

async function deleteBillingPeriodsIfOnlyTargetReadings(periodIds, targetReadingFilter) {
  let planned = 0;
  let deleted = 0;

  for (const periodId of periodIds) {
    const allReadings = await MeterReading.countDocuments({
      billingPeriodId: periodId,
    });
    const targetReadings = await MeterReading.countDocuments({
      ...targetReadingFilter,
      billingPeriodId: periodId,
    });

    if (allReadings > 0 && allReadings !== targetReadings) {
      skip(
        `Keeping billing period ${periodId}: it has ${allReadings - targetReadings} non-target reading(s)`,
      );
      continue;
    }

    planned += 1;
    if (WRITE) {
      const result = await BillingPeriod.deleteOne({ _id: periodId });
      deleted += result.deletedCount;
    }
  }

  if (!WRITE) {
    console.log(`  PLAN delete ${String(planned).padStart(4)} billing period(s)`);
  } else if (deleted > 0) {
    ok(`Deleted ${deleted} billing period(s)`);
  }

  return WRITE ? deleted : planned;
}

async function findUtilityPeriodsSafeToDelete({
  periodIds,
  targetReadingFilter,
  targetUserIds,
  protectedUserIds,
}) {
  const targetUserSet = objectIdSet(targetUserIds);
  const protectedUserSet = objectIdSet(protectedUserIds);
  const safePeriodIds = [];

  for (const periodId of periodIds) {
    const period = await UtilityPeriod.findById(periodId)
      .select("_id tenantSummaries.tenantId segments.activeTenantIds")
      .lean();
    if (!period) continue;

    const tenantSummaryIds = (period.tenantSummaries || []).map((summary) =>
      String(summary.tenantId || ""),
    );
    const segmentIds = (period.segments || []).flatMap((segment) =>
      (segment.activeTenantIds || []).map((id) => String(id)),
    );
    const embeddedTenantIds = [...tenantSummaryIds, ...segmentIds].filter(Boolean);

    if (embeddedTenantIds.some((id) => protectedUserSet.has(id))) {
      skip(`Keeping utility period ${periodId}: it includes protected pixdummy tenants`);
      continue;
    }

    if (embeddedTenantIds.some((id) => !targetUserSet.has(id))) {
      skip(`Keeping utility period ${periodId}: it includes non-target tenants`);
      continue;
    }

    const allReadings = await UtilityReading.countDocuments({
      utilityPeriodId: periodId,
    });
    const targetReadings = await UtilityReading.countDocuments({
      ...targetReadingFilter,
      utilityPeriodId: periodId,
    });

    if (allReadings > 0 && allReadings !== targetReadings) {
      skip(
        `Keeping utility period ${periodId}: it has ${allReadings - targetReadings} non-target reading(s)`,
      );
      continue;
    }

    safePeriodIds.push(periodId);
  }

  return safePeriodIds;
}

async function repairTouchedRooms(roomIds, deletedReservationIds) {
  if (roomIds.length === 0) return;

  const deletedReservationSet = new Set(asIdStrings(deletedReservationIds));

  for (const roomId of roomIds) {
    const room = await Room.findById(roomId);
    if (!room) continue;

    for (const bed of room.beds || []) {
      const reservationId = bed.occupiedBy?.reservationId
        ? String(bed.occupiedBy.reservationId)
        : "";
      if (reservationId && deletedReservationSet.has(reservationId)) {
        room.vacateBed(bed.id);
      }
    }

    const activeCount = await Reservation.countDocuments({
      roomId: room._id,
      _id: { $nin: asObjectIds(deletedReservationIds) },
      isArchived: { $ne: true },
      status: { $in: ACTIVE_OCCUPANCY_STATUSES },
    });

    room.currentOccupancy = activeCount;
    room.updateAvailability();

    if (WRITE) {
      await room.save();
      ok(`Repaired occupancy for ${room.name}: ${room.currentOccupancy}/${room.capacity}`);
    } else {
      console.log(
        `  PLAN repair room ${room.name}: occupancy -> ${activeCount}/${room.capacity}`,
      );
    }
  }
}

async function main() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured");
  }

  await mongoose.connect(process.env.MONGODB_URI, getMongoConnectOptions());

  console.log(`\n${line()}`);
  console.log(`  Cleanup Seeded Analytics Accounts (${mode()})`);
  console.log(line());

  const users = await User.find({
    $or: [{ email: { $in: TARGET_EMAILS } }, { email: TARGET_EMAIL_PATTERN }],
  })
    .select("_id user_id email username firebaseUid role tenantStatus branch isArchived createdAt updatedAt")
    .sort({ createdAt: 1 })
    .lean();

  assertPixdummyProtected(users);

  if (users.length === 0) {
    skip("No target seeded analytics tenant accounts were found");
    await mongoose.disconnect();
    return;
  }

  info(`Matched ${users.length} seeded tenant account(s):`);
  for (const user of users) {
    console.log(
      `    - ${user.email} | ${user.role}/${user.tenantStatus} | ${user.branch || "no-branch"} | created ${user.createdAt?.toISOString?.() || user.createdAt}`,
    );
  }

  const userIds = asObjectIds(users.map((user) => user._id));
  const userIdStrings = objectIdSet(userIds);

  const reservations = await Reservation.find({
    $or: [
      { userId: { $in: userIds } },
      { billingEmail: { $in: TARGET_EMAILS } },
      { billingEmail: TARGET_EMAIL_PATTERN },
    ],
  })
    .select("_id userId roomId selectedBed status isArchived checkInDate billingEmail")
    .lean();
  const reservationIds = asObjectIds(reservations.map((reservation) => reservation._id));
  const touchedRoomIds = asObjectIds(reservations.map((reservation) => reservation.roomId));
  const reservationUserIds = asObjectIds(
    reservations.map((reservation) => reservation.userId),
  );
  const nonTargetReservationUserIds = asIdStrings(reservationUserIds).filter(
    (id) => !userIdStrings.has(id),
  );

  if (nonTargetReservationUserIds.length > 0) {
    const existingNonTargetUsers = await User.find({
      _id: { $in: asObjectIds(nonTargetReservationUserIds) },
    })
      .select("_id email username")
      .lean();
    const unsafeUsers = existingNonTargetUsers.filter(
      (user) =>
        !TARGET_EMAIL_PATTERN.test(user.email || "") &&
        !TARGET_EMAILS.includes(user.email || ""),
    );

    if (unsafeUsers.length > 0) {
      console.log(
        JSON.stringify(
          {
            unsafeReservationUsers: unsafeUsers.map((user) => ({
              id: String(user._id),
              email: user.email,
              username: user.username,
            })),
          },
          null,
          2,
        ),
      );
      throw new Error("Refusing cleanup: reservation query matched existing non-target users");
    }

    const missingCount =
      nonTargetReservationUserIds.length - existingNonTargetUsers.length;
    if (missingCount > 0) {
      info(
        `Including ${missingCount} orphaned seed reservation user id(s) for related cleanup`,
      );
    }
  }

  const cleanupUserIds = asObjectIds([...userIds, ...reservationUserIds]);

  const bills = await Bill.find({
    $or: [
      { userId: { $in: cleanupUserIds } },
      { reservationId: { $in: reservationIds } },
    ],
  })
    .select("_id")
    .lean();
  const billIds = asObjectIds(bills.map((bill) => bill._id));

  const stays = await Stay.find({
    $or: [
      { tenantId: { $in: cleanupUserIds } },
      { reservationId: { $in: reservationIds } },
    ],
  })
    .select("_id")
    .lean();
  const stayIds = asObjectIds(stays.map((stay) => stay._id));

  const chatConversations = await ChatConversation.find({
    tenantId: { $in: cleanupUserIds },
  })
    .select("_id")
    .lean();
  const chatConversationIds = asObjectIds(
    chatConversations.map((conversation) => conversation._id),
  );

  const meterReadingFilter = {
    $or: [
      { tenantId: { $in: cleanupUserIds } },
      { activeTenantIds: { $in: cleanupUserIds } },
    ],
  };
  const meterReadings = await MeterReading.find(meterReadingFilter)
    .select("_id billingPeriodId")
    .lean();
  const billingPeriodIds = asObjectIds(
    meterReadings.map((reading) => reading.billingPeriodId),
  );

  const utilityReadingFilter = {
    $or: [
      { tenantId: { $in: cleanupUserIds } },
      { activeTenantIds: { $in: cleanupUserIds } },
    ],
  };
  const utilityReadings = await UtilityReading.find(utilityReadingFilter)
    .select("_id utilityPeriodId")
    .lean();
  const utilityPeriodIds = asObjectIds(
    utilityReadings.map((reading) => reading.utilityPeriodId),
  );

  const protectedPixdummyUsers = await User.find({
    email: PROTECTED_EMAIL_PATTERN,
  })
    .select("_id email")
    .lean();
  const protectedPixdummyIds = objectIdSet(
    protectedPixdummyUsers.map((user) => user._id),
  );

  const safeUtilityPeriodIds = await findUtilityPeriodsSafeToDelete({
    periodIds: utilityPeriodIds,
    targetReadingFilter: utilityReadingFilter,
    targetUserIds: cleanupUserIds,
    protectedUserIds: protectedPixdummyIds,
  });

  console.log(`\n${line("-")}`);
  await deleteMany("payment(s)", Payment, {
    $or: [{ tenantId: { $in: cleanupUserIds } }, { billId: { $in: billIds } }],
  });
  await deleteMany("bill(s)", Bill, {
    $or: [
      { userId: { $in: cleanupUserIds } },
      { reservationId: { $in: reservationIds } },
    ],
  });
  await deleteMany("notification(s)", Notification, {
    userId: { $in: cleanupUserIds },
  });
  await deleteMany("acknowledgment(s)", AcknowledgmentAccount, {
    userId: { $in: cleanupUserIds },
  });
  await deleteMany("maintenance request(s)", MaintenanceRequest, {
    $or: [
      { userId: { $in: cleanupUserIds } },
      { reservationId: { $in: reservationIds } },
      { user_id: { $in: users.map((user) => user.user_id).filter(Boolean) } },
    ],
  });
  await deleteMany("chat message(s)", ChatMessage, {
    $or: [
      { senderId: { $in: cleanupUserIds } },
      { conversationId: { $in: chatConversationIds } },
    ],
  });
  await deleteMany("chat conversation(s)", ChatConversation, {
    _id: { $in: chatConversationIds },
  });
  await deleteMany("bed history record(s)", BedHistory, {
    $or: [
      { tenantId: { $in: cleanupUserIds } },
      { reservationId: { $in: reservationIds } },
      { stayId: { $in: stayIds } },
    ],
  });
  await deleteMany("stay(s)", Stay, {
    $or: [
      { tenantId: { $in: cleanupUserIds } },
      { reservationId: { $in: reservationIds } },
    ],
  });
  await deleteMany("utility reading(s)", UtilityReading, utilityReadingFilter);
  await deleteMany("meter reading(s)", MeterReading, meterReadingFilter);
  await deleteMany("billing result(s)", BillingResult, {
    $or: [
      { billingPeriodId: { $in: billingPeriodIds } },
      { "tenantSummaries.tenantId": { $in: cleanupUserIds } },
      { "segments.activeTenantIds": { $in: cleanupUserIds } },
    ],
  });
  await deleteMany("utility period(s)", UtilityPeriod, {
    _id: { $in: safeUtilityPeriodIds },
  });
  await deleteBillingPeriodsIfOnlyTargetReadings(
    billingPeriodIds,
    meterReadingFilter,
  );
  await deleteMany("reservation(s)", Reservation, {
    _id: { $in: reservationIds },
  });
  await deleteMany("user account(s)", User, {
    _id: { $in: userIds },
    email: { $nin: protectedPixdummyUsers.map((user) => user.email) },
  });

  await repairTouchedRooms(touchedRoomIds, reservationIds);

  console.log(line());
  if (!WRITE) {
    info("Dry run only. Re-run with --write to apply these deletions.");
  } else {
    ok("Cleanup applied");
  }

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(`[cleanup-seeded-analytics-accounts] ERROR: ${error.message}`);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
