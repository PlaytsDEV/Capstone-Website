import {
  BillingPeriod,
  MeterReading,
  Reservation,
  Room,
  WaterBillingRecord,
} from "../models/index.js";
import { getUtilityTargetCloseDate } from "./billingPolicy.js";
import { getRoomLabel } from "./roomLabel.js";
import { isWaterBillableRoomType } from "./waterBilling.js";

function sameDayRange(expectedDate) {
  const start = new Date(expectedDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return {
    $gte: start,
    $lt: end,
  };
}

function addIssue(issues, issueCode, status, recommendedAction, extra = {}) {
  issues.push({
    issueCode,
    status,
    recommendedAction,
    ...extra,
  });
}

export function detectMissingMoveInAnchors({
  reservations = [],
  readings = [],
  periodStartDate = null,
}) {
  const moveInByTenant = new Map();

  for (const reading of readings) {
    if (reading.eventType !== "move-in" || !reading.tenantId) continue;
    const key = String(reading.tenantId);
    const current = moveInByTenant.get(key);
    if (!current || new Date(reading.date) < new Date(current.date)) {
      moveInByTenant.set(key, reading);
    }
  }

  return reservations
    .filter((reservation) => reservation.userId)
    .filter((reservation) => {
      const key = String(reservation.userId._id || reservation.userId);
      if (moveInByTenant.has(key)) return false;

      if (
        periodStartDate &&
        reservation.checkInDate &&
        new Date(reservation.checkInDate) < new Date(periodStartDate)
      ) {
        return false;
      }

      return true;
    })
    .map((reservation) => ({
      reservationId: reservation._id,
      tenantId: reservation.userId._id || reservation.userId,
      tenantName: reservation.userId?.firstName
        ? `${reservation.userId.firstName || ""} ${reservation.userId.lastName || ""}`.trim()
        : "Tenant",
      checkInDate: reservation.checkInDate || null,
      status: reservation.status,
    }));
}

export async function getElectricityRoomDiagnostics(roomId) {
  const room = await Room.findById(roomId)
    .select("name roomNumber branch type capacity")
    .lean();

  if (!room) return null;

  const [periods, readings, reservations] = await Promise.all([
    BillingPeriod.find({ roomId: room._id, isArchived: false })
      .sort({ startDate: 1 })
      .lean(),
    MeterReading.find({ roomId: room._id, isArchived: false })
      .sort({ date: 1, createdAt: 1 })
      .lean(),
    Reservation.find({
      roomId: room._id,
      status: { $in: ["checked-in", "checked-out"] },
      isArchived: { $ne: true },
    })
      .populate("userId", "firstName lastName")
      .lean(),
  ]);

  const issues = [];
  const orphanReadings = readings.filter((reading) => !reading.billingPeriodId);
  const openPeriod = periods.find((period) => period.status === "open") || null;
  const periodStartDate = openPeriod?.startDate || periods[0]?.startDate || null;
  const missingAnchors = detectMissingMoveInAnchors({
    reservations,
    readings,
    periodStartDate,
  });

  if ((reservations.length > 0 || readings.length > 0) && periods.length === 0) {
    addIssue(
      issues,
      "electricity_missing_period",
      "repair_required",
      "Create one open billing period and attach active orphan readings.",
    );
  }

  if (orphanReadings.length > 0) {
    addIssue(
      issues,
      "electricity_orphan_readings",
      "repair_required",
      "Attach orphan readings to the room's active billing period.",
      { readingIds: orphanReadings.map((reading) => reading._id) },
    );
  }

  if (missingAnchors.length > 0) {
    addIssue(
      issues,
      "electricity_missing_movein_anchor",
      "blocked",
      "Add or repair move-in readings before computing or sending bills.",
      { reservations: missingAnchors.map((entry) => entry.reservationId) },
    );
  }

  return {
    entityType: "electricity_room",
    entityId: room._id,
    roomId: room._id,
    roomName: getRoomLabel(room),
    branch: room.branch,
    status: issues.length ? "needs_repair" : "ok",
    activeTenantCount: reservations.filter((reservation) => reservation.status === "checked-in").length,
    reservationIds: reservations.map((reservation) => reservation._id),
    orphanReadingIds: orphanReadings.map((reading) => reading._id),
    openPeriodId: openPeriod?._id || null,
    targetCloseDate: openPeriod ? getUtilityTargetCloseDate(openPeriod.startDate) : null,
    issueCodes: issues.map((issue) => issue.issueCode),
    missingMoveInAnchors: missingAnchors,
    issues,
  };
}

export function classifyWaterRecordSyncStatus({
  roomType,
  eligibleReservationCount = 0,
  tenantShares = [],
}) {
  if (!isWaterBillableRoomType(roomType)) {
    return {
      syncStatus: "room_not_billable",
      syncReason: "room-not-billable",
    };
  }

  if (eligibleReservationCount <= 0) {
    return {
      syncStatus: "no_overlapping_reservations",
      syncReason: "no-overlapping-reservations",
    };
  }

  const hasLinkedBills = tenantShares.some((share) => share?.billId);
  if (hasLinkedBills) {
    return {
      syncStatus: "synced_to_draft_bills",
      syncReason: null,
    };
  }

  return {
    syncStatus: "awaiting_bill_sync",
    syncReason: "draft-bills-not-created",
  };
}

export async function getWaterRecordDiagnostics(recordOrId) {
  const record = recordOrId?._id
    ? recordOrId
    : await WaterBillingRecord.findById(recordOrId).lean();

  if (!record) return null;

  const room = await Room.findById(record.roomId)
    .select("name roomNumber branch type capacity")
    .lean();
  if (!room) return null;

  const reservations = await Reservation.find({
    roomId: room._id,
    status: { $in: ["checked-in", "checked-out"] },
    isArchived: { $ne: true },
    checkInDate: { $lt: record.cycleEnd },
    $or: [{ checkOutDate: null }, { checkOutDate: { $gt: record.cycleStart } }],
  })
    .select("_id")
    .lean();

  const matchingPeriod = await BillingPeriod.findOne({
    roomId: room._id,
    isArchived: false,
    startDate: sameDayRange(record.cycleStart),
    endDate: sameDayRange(record.cycleEnd),
    status: { $in: ["closed", "revised"] },
  })
    .select("_id")
    .lean();

  const { syncStatus, syncReason } = classifyWaterRecordSyncStatus({
    roomType: room.type,
    eligibleReservationCount: reservations.length,
    tenantShares: record.tenantShares || [],
  });

  const issues = [];
  if (record.status === "finalized" && syncStatus === "no_overlapping_reservations") {
    addIssue(
      issues,
      "water_orphan_finalized_record",
      "repair_required",
      "Archive the finalized water record as orphaned utility history.",
    );
  }
  if (syncStatus === "room_not_billable") {
    addIssue(
      issues,
      "water_room_not_billable",
      "informational",
      "No tenant water sync is required for this room type.",
    );
  }

  return {
    entityType: "water_record",
    entityId: record._id,
    roomId: room._id,
    roomName: getRoomLabel(room),
    branch: room.branch,
    status: issues.length ? "needs_attention" : "ok",
    issueCodes: issues.map((issue) => issue.issueCode),
    recordId: record._id,
    eligibleReservationCount: reservations.length,
    reservationIds: reservations.map((reservation) => reservation._id),
    matchedElectricityPeriodId: matchingPeriod?._id || null,
    syncStatus,
    syncReason,
    issues,
  };
}

export async function getUtilityDiagnostics({ branch = null } = {}) {
  const roomFilter = { isArchived: false };
  if (branch) roomFilter.branch = branch;

  const [roomsWithReservations, roomsWithReadings, waterRecords] = await Promise.all([
    Reservation.distinct("roomId", {
      status: "checked-in",
      isArchived: { $ne: true },
    }),
    MeterReading.distinct("roomId", {
      isArchived: false,
    }),
    WaterBillingRecord.find({
      isArchived: false,
      ...(branch ? { branch } : {}),
    }).lean(),
  ]);

  const roomIds = [
    ...new Set(
      [...roomsWithReservations, ...roomsWithReadings]
        .filter(Boolean)
        .map((roomId) => String(roomId)),
    ),
  ];

  const visibleRooms = await Room.find({
    ...roomFilter,
    _id: { $in: roomIds },
  })
    .select("_id")
    .lean();

  const electricityRooms = (
    await Promise.all(
      visibleRooms.map((room) => getElectricityRoomDiagnostics(room._id)),
    )
  ).filter(Boolean);

  const waterDiagnostics = (
    await Promise.all(
      waterRecords.map((record) => getWaterRecordDiagnostics(record)),
    )
  ).filter(Boolean);

  return {
    generatedAt: new Date(),
    summary: {
      electricityRoomCount: electricityRooms.length,
      electricityIssueCount: electricityRooms.reduce(
        (sum, room) => sum + room.issues.length,
        0,
      ),
      waterRecordCount: waterDiagnostics.length,
      waterIssueCount: waterDiagnostics.reduce(
        (sum, record) => sum + record.issues.length,
        0,
      ),
    },
    electricityRooms,
    waterRecords: waterDiagnostics,
  };
}
