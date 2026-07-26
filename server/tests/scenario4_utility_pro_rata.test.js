/**
 * ============================================================================
 * SCENARIO 4 TEST SUITE: PRO-RATA UTILITY CONSUMPTION & SHARED METER DISTRIBUTION
 * ============================================================================
 * Tests all 6 edge cases under General Scenario 4:
 * 1. Mid-Month Move-In / Move-Out Pro-Rata Electric Split (exact day overlap)
 * 2. Meter Rollover Boundary Reset & Negative Reading Entry Validation
 * 3. Abnormal Consumption Spike Warning Flag (> 1500 kWh threshold alarm)
 * 4. Vacant Bed Slot Cost Shielding & Owner Absorption Overhead Calculation
 * 5. Centavo Discrepancy Auto-Allocation (zero variance against total meter charge)
 * 6. Utility Period Status Locking Guard (posted / locked period immutability)
 */

import { describe, it, expect } from "@jest/globals";
import {
  validateMeterReading,
  calculateMidMonthProRataDays,
  calculateOccupancyShieldedUtilitySplit,
  validateUtilityPeriodLock,
  SPIKE_THRESHOLD_KWH,
} from "../services/utilityAnomalyService.js";
import { calculateProRataUtilitySplits } from "../services/proRataUtilityEngine.js";

describe("Scenario 4: Pro-Rata Utility Consumption & Shared Meter Distribution", () => {
  it("1. should calculate exact mid-month move-in / move-out pro-rata active days", () => {
    const periodStart = new Date("2026-07-01T00:00:00Z");
    const periodEnd = new Date("2026-07-31T00:00:00Z");

    // Tenant moved in on July 16 (16 days active out of 31)
    const midMonthMoveIn = calculateMidMonthProRataDays({
      moveInDate: new Date("2026-07-16T00:00:00Z"),
      moveOutDate: null,
      periodStartDate: periodStart,
      periodEndDate: periodEnd,
    });

    expect(midMonthMoveIn.activeDays).toBe(16);
    expect(midMonthMoveIn.totalPeriodDays).toBe(31);
    expect(midMonthMoveIn.activeRatio).toBeCloseTo(16 / 31, 2);
  });

  it("2. should detect sub-meter rollover boundary reset and handle negative reading entries", () => {
    // Rollover: 99,800 -> 150 (rollover past 99,999)
    const rolloverResult = validateMeterReading({
      previousReading: 99800,
      currentReading: 150,
      maxCapacity: 99999,
    });

    expect(rolloverResult.isValid).toBe(true);
    expect(rolloverResult.isRollover).toBe(true);
    expect(rolloverResult.consumption).toBe(350); // (99999 - 99800) + 150 + 1

    // Invalid negative reading entry
    const invalidResult = validateMeterReading({
      previousReading: -50,
      currentReading: 100,
    });
    expect(invalidResult.isValid).toBe(false);
    expect(invalidResult.error).toContain("Invalid meter reading input");
  });

  it("3. should flag abnormal consumption spike warnings (> 1500 kWh)", () => {
    const spikeResult = validateMeterReading({
      previousReading: 1000,
      currentReading: 3200, // 2200 kWh consumption (> 1500 limit)
      spikeThresholdKwh: SPIKE_THRESHOLD_KWH,
    });

    expect(spikeResult.isValid).toBe(true);
    expect(spikeResult.isSpike).toBe(true);
    expect(spikeResult.warning).toContain("Abnormal consumption spike detected");
    expect(spikeResult.consumption).toBe(2200);
  });

  it("4. should shield active occupants from paying vacant bed slot overhead", () => {
    // 4-bed room with only 2 active tenants, ₱4,000 total electric bill
    const occupants = [
      { userId: "tenant1", activeDays: 30, isPrimary: true },
      { userId: "tenant2", activeDays: 30 },
    ];

    const shieldedResult = calculateOccupancyShieldedUtilitySplit({
      totalMeterAmount: 4000,
      roomCapacity: 4, // 2/4 = 50% occupied
      occupants,
    });

    expect(shieldedResult.totalBilledToTenants).toBe(2000); // Only 50% billed to tenants
    expect(shieldedResult.vacantBedOverhead).toBe(2000);   // 50% absorbed by owner
    expect(shieldedResult.splits[0].allocatedAmount).toBe(1000);
    expect(shieldedResult.splits[1].allocatedAmount).toBe(1000);
  });

  it("5. should guarantee zero centavo variance against total meter charge via primary occupant allocation", () => {
    const occupants = [
      { userId: "tenant1", activeDays: 30, isPrimary: true },
      { userId: "tenant2", activeDays: 30 },
      { userId: "tenant3", activeDays: 30 },
    ];

    const proRataResult = calculateProRataUtilitySplits({
      totalMeterAmount: 1000.00,
      occupants,
    });

    expect(proRataResult.variance).toBe(0);
    expect(proRataResult.splits[0].allocatedAmount).toBe(333.34); // Centavo remainder allocated to primary
    expect(proRataResult.splits[1].allocatedAmount).toBe(333.33);
    expect(proRataResult.splits[2].allocatedAmount).toBe(333.33);
  });

  it("6. should enforce utility period immutability locking when posted or locked", () => {
    const draftLock = validateUtilityPeriodLock("draft");
    expect(draftLock.isLocked).toBe(false);
    expect(draftLock.canModify).toBe(true);

    const postedLock = validateUtilityPeriodLock("posted");
    expect(postedLock.isLocked).toBe(true);
    expect(postedLock.canModify).toBe(false);
    expect(postedLock.error).toContain("locked against modifications");

    const lockedStatus = validateUtilityPeriodLock("locked");
    expect(lockedStatus.isLocked).toBe(true);
  });
});
