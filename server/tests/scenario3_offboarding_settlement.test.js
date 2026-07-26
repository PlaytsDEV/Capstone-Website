/**
 * ============================================================================
 * SCENARIO 3 TEST SUITE: OFFBOARDING FINANCIAL SETTLEMENT & DEPOSIT RECONCILIATION
 * ============================================================================
 * Tests all 6 edge cases under General Scenario 3:
 * 1. Early Vacancy Deposit Forfeiture & Contract Breach logic
 * 2. Standard Contract End Deposit Reconciliation & Net Refund calculation
 * 3. Key Non-Return Assessment Penalty (₱500) & Itemized Damage Deductions
 * 4. Deposit Refund State Machine transitions (pending -> approved -> processed) & invalid transition guards
 * 5. 30-Day Refund SLA Deadline & Expiration Evaluator (healthy, warning, overdue, completed)
 * 6. Final Balance Reconciliation & Settlement Summary Payload Integrity
 */

import { describe, it, expect } from "@jest/globals";
import {
  calculateOffboardingSettlement,
  validateDepositRefundTransition,
  evaluateDepositRefundSLA,
  KEY_NON_RETURN_PENALTY,
  REFUND_SLA_DAYS,
} from "../services/offboardingSettlementService.js";
import dayjs from "dayjs";

describe("Scenario 3: Offboarding Financial Settlement & Deposit Reconciliation", () => {
  it("1. should forfeit security deposit on early vacancy contract breach", () => {
    const leaseEndDate = new Date("2026-12-31T00:00:00Z");
    const actualMoveOutDate = new Date("2026-07-15T00:00:00Z"); // 5 months early

    const settlement = calculateOffboardingSettlement({
      leaseEndDate,
      moveOutDate: actualMoveOutDate,
      monthlyRent: 6000,
      outstandingBalance: 1500,
      damageDeductions: 500,
      keyReturned: true,
    });

    expect(settlement.isEarlyVacancy).toBe(true);
    expect(settlement.depositForfeited).toBe(true);
    expect(settlement.depositForfeitureReason).toBe("early_vacancy");
    expect(settlement.netAmount).toBe(0);
    expect(settlement.depositRefundAmount).toBe(0);
    expect(settlement.depositRefundStatus).toBe("forfeited");
    expect(settlement.depositRefundDeadline).toBeNull();
  });

  it("2. should calculate net refund for normal lease completion", () => {
    const leaseEndDate = new Date("2026-07-01T00:00:00Z");
    const actualMoveOutDate = new Date("2026-07-15T00:00:00Z"); // Completed lease

    const settlement = calculateOffboardingSettlement({
      leaseEndDate,
      moveOutDate: actualMoveOutDate,
      monthlyRent: 6000,
      outstandingBalance: 1000,
      damageDeductions: 500,
      keyReturned: true,
    });

    expect(settlement.isEarlyVacancy).toBe(false);
    expect(settlement.depositForfeited).toBe(false);
    expect(settlement.totalDeductions).toBe(1500); // 1000 + 500
    expect(settlement.netAmount).toBe(4500); // 6000 - 1500
    expect(settlement.depositRefundStatus).toBe("pending");
    expect(settlement.settlementType).toBe("refund");

    const expectedDeadline = dayjs(actualMoveOutDate).add(REFUND_SLA_DAYS, "day").toDate();
    expect(settlement.depositRefundDeadline.getTime()).toBe(expectedDeadline.getTime());
  });

  it("3. should assess key non-return fee (₱500) and itemized damage deductions", () => {
    const leaseEndDate = new Date("2026-07-01T00:00:00Z");
    const actualMoveOutDate = new Date("2026-07-15T00:00:00Z");

    const settlementWithKeyPenalty = calculateOffboardingSettlement({
      leaseEndDate,
      moveOutDate: actualMoveOutDate,
      monthlyRent: 5000,
      outstandingBalance: 0,
      damageDeductions: 1200,
      keyReturned: false, // Applies ₱500 penalty
    });

    expect(settlementWithKeyPenalty.keyDeduction).toBe(KEY_NON_RETURN_PENALTY);
    expect(settlementWithKeyPenalty.totalDeductions).toBe(1700); // 1200 damage + 500 key
    expect(settlementWithKeyPenalty.netAmount).toBe(3300); // 5000 - 1700
  });

  it("4. should enforce deposit refund state machine transition rules", () => {
    // Valid transitions
    expect(validateDepositRefundTransition("pending", "approved").valid).toBe(true);
    expect(validateDepositRefundTransition("approved", "processed").valid).toBe(true);
    expect(validateDepositRefundTransition("pending", "forfeited").valid).toBe(true);

    // Invalid transitions
    const invalidFromProcessed = validateDepositRefundTransition("processed", "pending");
    expect(invalidFromProcessed.valid).toBe(false);
    expect(invalidFromProcessed.error).toContain("Cannot transition deposit refund status");

    const invalidFromForfeited = validateDepositRefundTransition("forfeited", "approved");
    expect(invalidFromForfeited.valid).toBe(false);
  });

  it("5. should evaluate 30-day refund SLA status correctly", () => {
    const today = new Date("2026-07-26T12:00:00Z");

    // Overdue refund (deadline was 5 days ago)
    const overdueDeadline = new Date("2026-07-21T12:00:00Z");
    const evalOverdue = evaluateDepositRefundSLA(
      { depositRefundStatus: "pending", depositRefundDeadline: overdueDeadline },
      today
    );
    expect(evalOverdue.slaStatus).toBe("overdue");
    expect(evalOverdue.isOverdue).toBe(true);

    // Approaching warning refund (deadline in 3 days)
    const warningDeadline = new Date("2026-07-29T12:00:00Z");
    const evalWarning = evaluateDepositRefundSLA(
      { depositRefundStatus: "pending", depositRefundDeadline: warningDeadline },
      today
    );
    expect(evalWarning.slaStatus).toBe("warning");
    expect(evalWarning.isOverdue).toBe(false);

    // Healthy refund (deadline in 20 days)
    const healthyDeadline = new Date("2026-08-15T12:00:00Z");
    const evalHealthy = evaluateDepositRefundSLA(
      { depositRefundStatus: "pending", depositRefundDeadline: healthyDeadline },
      today
    );
    expect(evalHealthy.slaStatus).toBe("healthy");

    // Completed refund
    const evalCompleted = evaluateDepositRefundSLA(
      { depositRefundStatus: "processed", depositRefundDeadline: overdueDeadline },
      today
    );
    expect(evalCompleted.slaStatus).toBe("completed");
    expect(evalCompleted.isOverdue).toBe(false);
  });

  it("6. should verify balance reconciliation integrity when deductions exceed deposit", () => {
    const leaseEndDate = new Date("2026-07-01T00:00:00Z");
    const actualMoveOutDate = new Date("2026-07-15T00:00:00Z");

    const settlementExcessDeduction = calculateOffboardingSettlement({
      leaseEndDate,
      moveOutDate: actualMoveOutDate,
      monthlyRent: 4000,
      outstandingBalance: 3500,
      damageDeductions: 1000,
      keyReturned: false, // + 500 = total 5000
    });

    expect(settlementExcessDeduction.totalDeductions).toBe(5000);
    expect(settlementExcessDeduction.netAmount).toBe(0); // Floor at 0
    expect(settlementExcessDeduction.settlementType).toBe("payment_due");
  });
});
