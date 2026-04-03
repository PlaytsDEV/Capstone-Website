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

function distributeCents(totalAmount, recipientCount) {
  if (recipientCount <= 0) return [];

  const totalCents = Math.max(0, Math.round(Number(totalAmount || 0) * 100));
  const baseShare = Math.floor(totalCents / recipientCount);
  let remainder = totalCents - (baseShare * recipientCount);

  return Array.from({ length: recipientCount }, () => {
    const share = baseShare + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder -= 1;
    return share;
  });
}

export function calculateOverlapDays(checkInDate, checkOutDate, cycleStart, cycleEnd) {
  const start = Math.max(
    dayjs(checkInDate).startOf("day").valueOf(),
    dayjs(cycleStart).startOf("day").valueOf(),
  );
  const end = Math.min(
    dayjs(checkOutDate || cycleEnd).startOf("day").valueOf(),
    dayjs(cycleEnd).startOf("day").valueOf(),
  );

  if (start >= end) return 0;
  return dayjs(end).diff(dayjs(start), "day");
}

export function buildWaterShareAmounts(roomType, totalAmount, reservations, cycleStart, cycleEnd) {
  if (!isWaterBillableRoomType(roomType) || reservations.length === 0) {
    return [];
  }

  if (roomType === "private" && reservations.length === 1) {
    return [roundMoney(totalAmount)];
  }

  const tenantDaysArray = reservations.map((res) =>
    calculateOverlapDays(res.checkInDate, res.checkOutDate, cycleStart, cycleEnd),
  );

  const totalDays = tenantDaysArray.reduce((sum, days) => sum + days, 0);

  if (totalDays <= 0) {
    return distributeCents(totalAmount, reservations.length).map((cents) => cents / 100);
  }

  const totalCents = Math.max(0, Math.round(Number(totalAmount || 0) * 100));
  const rawShares = tenantDaysArray.map((days) => (days / totalDays) * totalCents);
  const baseShares = rawShares.map(Math.floor);

  let remainder = totalCents - baseShares.reduce((a, b) => a + b, 0);
  const fractionals = rawShares.map((raw, index) => ({ index, frac: raw - baseShares[index] }));
  fractionals.sort((a, b) => b.frac - a.frac);

  for (let i = 0; i < remainder; i++) {
    baseShares[fractionals[i].index] += 1;
  }

  return baseShares.map((cents) => cents / 100);
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
  const totalCost = record.finalAmount || 0;
  const totalUsage = record.usage || 0;
  const tenantShares = record.tenantShares || [];
  const billAmounts = tenantShares.map((share) => roundMoney(share.shareAmount || 0));
  const hasUniformShare = billAmounts.length <= 1 || billAmounts.every((amount) => amount === billAmounts[0]);
  const uniformShareCost = hasUniformShare && billAmounts.length > 0 ? billAmounts[0] : null;
  const uniformShareUsage = hasUniformShare && tenantCount > 0
    ? roundMoney(totalUsage / tenantCount)
    : null;

  return {
    id: record._id,
    billingPeriodId: record._id,
    utilityType: "water",
    roomId: room?._id || record.roomId,
    branch: record.branch,
    computedAt: record.updatedAt || record.finalizedAt || record.createdAt,
    ratePerUnit: record.ratePerUnit,
    totalUsage: totalUsage,
    totalRoomCost: totalCost,
    verified: true,
    segments: [
      {
        segmentIndex: 0,
        periodLabel: `${dayjs(record.cycleStart).format("MMM D")} - ${dayjs(record.cycleEnd).format("MMM D, YYYY")}`,
        readingFrom: record.previousReading,
        readingTo: record.currentReading,
        unitsConsumed: totalUsage,
        totalCost: totalCost,
        activeTenantCount: tenantCount,
        sharePerTenantUnits: uniformShareUsage,
        sharePerTenantCost: uniformShareCost,
        activeTenantIds: tenantShares.map((share) => share.tenantId).filter(Boolean),
        coveredTenantNames: tenantShares.map((share) => share.tenantName || "Tenant"),
      },
    ],
    tenantSummaries: tenantShares.map((share) => {
      const shareProportion = totalCost > 0 ? (share.shareAmount || 0) / totalCost : (1 / (tenantCount || 1));
      const shareUsage = roundMoney(totalUsage * shareProportion);

      return {
        tenantId: share.tenantId,
        tenantName: share.tenantName,
        totalUsage: shareUsage,
        billAmount: share.shareAmount || 0,
        billId: share.billId || null,
      };
    }),
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
    reservations,
    cycleStart,
    cycleEnd,
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
