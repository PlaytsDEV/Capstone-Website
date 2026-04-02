import dayjs from "dayjs";
import {
  Reservation,
  Room,
  WaterBillingRecord,
} from "../models/index.js";
import {
  getPreviousUtilityCycleBoundary,
  getUtilityTargetCloseDate,
  isSameUtilityCycleBoundary,
  roundMoney,
} from "./billingPolicy.js";
import { upsertDraftBillsForUtility } from "./utilityBillFlow.js";

export const WATER_BILLABLE_ROOM_TYPES = ["private", "double-sharing"];

export function isWaterBillableRoomType(roomType) {
  return WATER_BILLABLE_ROOM_TYPES.includes(roomType);
}

export function normalizeCycleDate(value) {
  return dayjs(value).startOf("day").toDate();
}

export function getNextScheduledWaterCycleEnd(latestRecord = null, referenceDate = new Date()) {
  if (latestRecord?.cycleEnd) {
    return dayjs(latestRecord.cycleEnd)
      .add(1, "month")
      .date(15)
      .startOf("day")
      .toDate();
  }

  const reference = dayjs(referenceDate).startOf("day");
  const currentMonth15th = reference.date(15);
  return (reference.date() <= 15 ? currentMonth15th : currentMonth15th.add(1, "month"))
    .startOf("day")
    .toDate();
}

export function buildWaterCycle({ cycleEnd = null, latestRecord = null, referenceDate = new Date() }) {
  const normalizedEnd = normalizeCycleDate(
    cycleEnd || getNextScheduledWaterCycleEnd(latestRecord, referenceDate),
  );
  const cycleStart = latestRecord?.cycleEnd
    ? normalizeCycleDate(latestRecord.cycleEnd)
    : dayjs(normalizedEnd).subtract(1, "month").startOf("day").toDate();

  return {
    cycleStart,
    cycleEnd: normalizedEnd,
  };
}

export function validateWaterCycleWindow({ cycleStart, cycleEnd }) {
  const normalizedStart = normalizeCycleDate(cycleStart);
  const normalizedEnd = normalizeCycleDate(cycleEnd);

  if (!isSameUtilityCycleBoundary(normalizedEnd, getUtilityTargetCloseDate(normalizedStart))) {
    throw new Error("Water billing periods must follow the fixed 15th-to-15th cycle.");
  }

  return {
    cycleStart: normalizedStart,
    cycleEnd: normalizedEnd,
  };
}

export function computeWaterUsage(previousReading, currentReading) {
  const previous = Number(previousReading);
  const current = Number(currentReading);
  if (!Number.isFinite(previous) || previous < 0) {
    throw new Error("Previous reading must be a non-negative number.");
  }
  if (!Number.isFinite(current) || current < 0) {
    throw new Error("Current reading must be a non-negative number.");
  }
  if (current < previous) {
    throw new Error("Current reading cannot be lower than the previous reading.");
  }
  return roundMoney(current - previous);
}

export function computeWaterAmount(usage, ratePerUnit) {
  const rate = Number(ratePerUnit);
  if (!Number.isFinite(rate) || rate <= 0) {
    throw new Error("Water rate must be a positive number.");
  }
  return roundMoney(Number(usage || 0) * rate);
}

function distributeAmount(totalAmount, recipientCount) {
  if (recipientCount <= 0) return [];
  const totalCents = Math.max(0, Math.round(Number(totalAmount || 0) * 100));
  const base = Math.floor(totalCents / recipientCount);
  let remainder = totalCents - base * recipientCount;

  return Array.from({ length: recipientCount }, () => {
    const cents = base + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    return cents / 100;
  });
}

export function buildWaterShareAmounts(roomType, totalAmount, recipientCount) {
  if (!isWaterBillableRoomType(roomType) || recipientCount <= 0) {
    return [];
  }

  if (roomType === "private" && recipientCount === 1) {
    return [roundMoney(totalAmount)];
  }

  return distributeAmount(totalAmount, recipientCount);
}

function sameDayRange(expectedDate) {
  const start = dayjs(expectedDate).startOf("day");
  const end = start.add(1, "day");
  return {
    $gte: start.toDate(),
    $lt: end.toDate(),
  };
}

export async function getLatestWaterRecordForRoom(roomId) {
  return WaterBillingRecord.findOne({
    roomId,
    isArchived: false,
  })
    .sort({ cycleEnd: -1, createdAt: -1 });
}

export async function getFinalizedWaterRecordForPeriod(roomId, cycleStart, cycleEnd) {
  return WaterBillingRecord.findOne({
    roomId,
    status: "finalized",
    isArchived: false,
    cycleStart: sameDayRange(cycleStart),
    cycleEnd: sameDayRange(cycleEnd),
  });
}

export function buildWaterResult(record, room) {
  const tenantCount = record.tenantShares?.length || 0;
  const shareUsage = tenantCount > 0 ? roundMoney((record.usage || 0) / tenantCount) : 0;

  return {
    id: record._id,
    billingPeriodId: record._id,
    utilityType: "water",
    roomId: room?._id || record.roomId,
    branch: record.branch,
    computedAt: record.updatedAt || record.finalizedAt || record.createdAt,
    ratePerUnit: record.ratePerUnit,
    totalUsage: record.usage,
    totalRoomCost: record.finalAmount,
    verified: true,
    segments: [
      {
        segmentIndex: 0,
        periodLabel: `${dayjs(record.cycleStart).format("MMM D")} - ${dayjs(record.cycleEnd).format("MMM D, YYYY")}`,
        readingFrom: record.previousReading,
        readingTo: record.currentReading,
        unitsConsumed: record.usage,
        totalCost: record.finalAmount,
        activeTenantCount: tenantCount,
        sharePerTenantUnits: shareUsage,
        sharePerTenantCost: tenantCount > 0 ? roundMoney((record.finalAmount || 0) / tenantCount) : 0,
        activeTenantIds: (record.tenantShares || []).map((share) => share.tenantId).filter(Boolean),
        coveredTenantNames: (record.tenantShares || []).map((share) => share.tenantName || "Tenant"),
      },
    ],
    tenantSummaries: (record.tenantShares || []).map((share) => ({
      tenantId: share.tenantId,
      tenantName: share.tenantName,
      totalUsage: shareUsage,
      billAmount: share.shareAmount || 0,
      billId: share.billId || null,
    })),
  };
}

export async function getCoveredReservationsForWaterCycle(roomId, cycleStart, cycleEnd) {
  return Reservation.find({
    roomId,
    status: { $in: ["checked-in", "checked-out"] },
    isArchived: { $ne: true },
    checkInDate: { $lt: cycleEnd },
    $or: [{ checkOutDate: null }, { checkOutDate: { $gt: cycleStart } }],
  })
    .populate("userId", "firstName lastName")
    .sort({ checkInDate: 1 });
}

function mapReservationShares(reservations, shareAmounts) {
  return reservations.map((reservation, index) => {
    const user = reservation.userId;
    const tenantName = user
      ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Tenant"
      : "Tenant";

    return {
      tenantId: user?._id || null,
      reservationId: reservation._id,
      tenantName,
      shareAmount: shareAmounts[index] || 0,
      billId: null,
    };
  });
}

export async function buildWaterTenantSnapshot(room, cycleStart, cycleEnd, finalAmount) {
  if (!isWaterBillableRoomType(room.type)) return [];

  const reservations = await getCoveredReservationsForWaterCycle(
    room._id,
    cycleStart,
    cycleEnd,
  );
  const shareAmounts = buildWaterShareAmounts(
    room.type,
    finalAmount,
    reservations.length,
  );

  return mapReservationShares(reservations, shareAmounts);
}

export async function applyWaterRecordToDraftBills(waterRecordLike) {
  const waterRecord = waterRecordLike instanceof WaterBillingRecord
    ? waterRecordLike
    : await WaterBillingRecord.findById(waterRecordLike?._id || waterRecordLike);

  if (!waterRecord || waterRecord.status !== "finalized") {
    return { applied: false, appliedBillCount: 0, reason: "not-finalized" };
  }

  const room = await Room.findById(waterRecord.roomId).lean();
  if (!room) {
    return { applied: false, appliedBillCount: 0, reason: "missing-room" };
  }

  if (!isWaterBillableRoomType(room.type)) {
    return { applied: false, appliedBillCount: 0, reason: "room-not-billable" };
  }

  const coveredReservations = await getCoveredReservationsForWaterCycle(
    room._id,
    waterRecord.cycleStart,
    waterRecord.cycleEnd,
  );
  if (coveredReservations.length === 0) {
    return { applied: false, appliedBillCount: 0, reason: "no-overlapping-reservations" };
  }

  const periodLike = {
    _id: waterRecord._id,
    startDate: waterRecord.cycleStart,
    endDate: waterRecord.cycleEnd,
  };
  const resultLike = buildWaterResult(waterRecord, room);
  const updatedSummaries = await upsertDraftBillsForUtility({
    period: periodLike,
    room,
    tenantSummaries: resultLike.tenantSummaries,
    utilityType: "water",
  });

  waterRecord.tenantShares = updatedSummaries.map((summary) => ({
    tenantId: summary.tenantId || null,
    reservationId:
      (waterRecord.tenantShares || []).find((share) => String(share.tenantId) === String(summary.tenantId))?.reservationId || null,
    tenantName: summary.tenantName || "Tenant",
    shareAmount: summary.billAmount || 0,
    billId: summary.billId || null,
  }));
  await waterRecord.save();

  return {
    applied: true,
    appliedBillCount: updatedSummaries.length,
    periodId: waterRecord._id,
  };
}
