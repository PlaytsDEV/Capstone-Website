import dayjs from "dayjs";
import { calculateProRataUtilitySplits } from "./proRataUtilityEngine.js";

/**
 * ============================================================================
 * UTILITY ANOMALY & PRO-RATA COST SHIELDING SERVICE (Scenario 4)
 * ============================================================================
 * Handles sub-meter reading anomaly validation (rollovers, spikes), mid-month
 * pro-rata active day calculation, vacant bed slot cost shielding, and utility
 * period immutability locking.
 */

export const DEFAULT_METER_MAX_CAPACITY = 99999;
export const SPIKE_THRESHOLD_KWH = 1500;

/**
 * Validates meter reading inputs, rollover resets, and consumption spikes.
 */
export function validateMeterReading({
  previousReading = 0,
  currentReading = 0,
  maxCapacity = DEFAULT_METER_MAX_CAPACITY,
  spikeThresholdKwh = SPIKE_THRESHOLD_KWH,
} = {}) {
  const prev = Number(previousReading || 0);
  const curr = Number(currentReading || 0);
  const cap = Number(maxCapacity || DEFAULT_METER_MAX_CAPACITY);
  const threshold = Number(spikeThresholdKwh || SPIKE_THRESHOLD_KWH);

  if (isNaN(prev) || isNaN(curr) || prev < 0 || curr < 0) {
    return {
      isValid: false,
      isRollover: false,
      isSpike: false,
      consumption: 0,
      error: "Invalid meter reading input: values must be non-negative numbers.",
    };
  }

  // Meter rollover boundary check (current < previous)
  if (curr < prev) {
    const rolloverConsumption = cap - prev + curr + 1;
    const isExtremeSpike = rolloverConsumption > threshold;
    return {
      isValid: true,
      isRollover: true,
      isSpike: isExtremeSpike,
      consumption: rolloverConsumption,
      warning: isExtremeSpike
        ? `Meter rollover detected with high consumption (${rolloverConsumption} kWh > ${threshold} kWh limit)`
        : `Meter rollover boundary detected (${prev} -> ${curr})`,
    };
  }

  const consumption = curr - prev;
  const isSpike = consumption > threshold;

  return {
    isValid: true,
    isRollover: false,
    isSpike,
    consumption,
    warning: isSpike
      ? `Abnormal consumption spike detected (${consumption} kWh exceeds ${threshold} kWh threshold)`
      : null,
  };
}

/**
 * Calculates exact active occupant days for mid-month move-in / move-out within a billing period.
 */
export function calculateMidMonthProRataDays({
  moveInDate = null,
  moveOutDate = null,
  periodStartDate = new Date("2026-07-01"),
  periodEndDate = new Date("2026-07-31"),
} = {}) {
  const pStart = dayjs(periodStartDate).startOf("day");
  const pEnd = dayjs(periodEndDate).endOf("day");
  const totalPeriodDays = Math.max(1, pEnd.diff(pStart, "day") + 1);

  const mIn = moveInDate ? dayjs(moveInDate).startOf("day") : pStart;
  const mOut = moveOutDate ? dayjs(moveOutDate).endOf("day") : pEnd;

  const activeStart = mIn.isBefore(pStart) ? pStart : mIn;
  const activeEnd = mOut.isAfter(pEnd) ? pEnd : mOut;

  if (activeEnd.isBefore(activeStart)) {
    return { activeDays: 0, totalPeriodDays, activeRatio: 0 };
  }

  const activeDays = Math.max(1, activeEnd.diff(activeStart, "day") + 1);
  const activeRatio = Math.min(1, activeDays / totalPeriodDays);

  return {
    activeDays,
    totalPeriodDays,
    activeRatio: Math.round(activeRatio * 10000) / 10000,
  };
}

/**
 * Calculates pro-rata utility splits while shielding active occupants from vacant bed slot overhead.
 */
export function calculateOccupancyShieldedUtilitySplit({
  totalMeterAmount = 0,
  roomCapacity = 4,
  occupants = [],
} = {}) {
  const amount = Number(totalMeterAmount || 0);
  const capacity = Math.max(1, Number(roomCapacity || 1));

  if (amount <= 0 || !Array.isArray(occupants) || occupants.length === 0) {
    return {
      splits: [],
      totalBilledToTenants: 0,
      vacantBedOverhead: amount,
      variance: 0,
    };
  }

  const activeBedsCount = occupants.length;
  const occupiedBedRatio = Math.min(1, activeBedsCount / capacity);

  // Active occupants only pay for the portion corresponding to occupied beds
  const totalBilledToTenants = Math.round(amount * occupiedBedRatio * 100) / 100;
  const vacantBedOverhead = Math.round((amount - totalBilledToTenants) * 100) / 100;

  // Delegate pro-rata distribution of tenant share to proRataUtilityEngine
  const proRataResult = calculateProRataUtilitySplits({
    totalMeterAmount: totalBilledToTenants,
    occupants,
  });

  return {
    splits: proRataResult.splits,
    totalBilledToTenants: proRataResult.totalAllocated,
    vacantBedOverhead,
    occupiedBedRatio,
    variance: proRataResult.variance,
  };
}

/**
 * Enforces utility period status immutability locking.
 */
export function validateUtilityPeriodLock(periodStatus = "draft") {
  const LOCKED_STATUSES = ["posted", "locked", "closed"];
  const isLocked = LOCKED_STATUSES.includes(String(periodStatus).toLowerCase());

  if (isLocked) {
    return {
      isLocked: true,
      canModify: false,
      error: `Utility period is ${periodStatus} and locked against modifications or recalculations.`,
    };
  }

  return {
    isLocked: false,
    canModify: true,
  };
}
