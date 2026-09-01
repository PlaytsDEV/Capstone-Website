import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  calculateLivePenaltyDetails,
  buildItemFinancialBreakdown,
} from "./tenantDetailConstants.js";

test("calculateLivePenaltyDetails correctly computes penalty past grace period", () => {
  const result = calculateLivePenaltyDetails({
    dueDate: "2026-08-30",
    currentDate: "2026-09-01",
    persistedPenalty: 0,
    ratePerDay: 50,
    graceDays: 1,
  });

  assert.equal(result.daysLate, 2);
  assert.equal(result.graceDays, 1);
  assert.equal(result.billableDays, 1);
  assert.equal(result.isWithinGracePeriod, false);
  assert.equal(result.penaltyAmount, 50);
  assert.equal(
    result.explanation,
    "1 billable day (2 days past due − 1-day grace period) @ ₱50/day",
  );
});

test("calculateLivePenaltyDetails recognizes within-grace-period state", () => {
  const result = calculateLivePenaltyDetails({
    dueDate: "2026-08-31",
    currentDate: "2026-09-01",
    persistedPenalty: 0,
    ratePerDay: 50,
    graceDays: 1,
  });

  assert.equal(result.daysLate, 1);
  assert.equal(result.billableDays, 0);
  assert.equal(result.isWithinGracePeriod, true);
  assert.equal(result.penaltyAmount, 0);
  assert.match(result.explanation, /Within 1-day grace period/);
});

test("calculateLivePenaltyDetails respects higher persisted penalty from database if already applied", () => {
  const result = calculateLivePenaltyDetails({
    dueDate: "2026-08-25",
    currentDate: "2026-09-01",
    persistedPenalty: 350,
    ratePerDay: 50,
    graceDays: 1,
  });

  assert.equal(result.penaltyAmount, 350);
});

test("buildItemFinancialBreakdown assembles complete financial math object", () => {
  const breakdown = buildItemFinancialBreakdown({
    category: "rent",
    billedAmount: 14400,
    balanceAmount: 6300,
    dueDate: "2026-08-30",
    currentDate: "2026-09-01",
    persistedPenalty: 0,
    discountAmount: 0,
    creditAmount: 0,
  });

  assert.equal(breakdown.baseAmount, 14400);
  assert.equal(breakdown.penaltyAmount, 50);
  assert.equal(breakdown.totalAssessed, 14450);
  assert.equal(breakdown.amountPaid, 8100);
  assert.equal(breakdown.balanceDue, 6350);
});

test("buildItemFinancialBreakdown correctly nets out persistedPenalty to prevent double-counting", () => {
  const breakdown = buildItemFinancialBreakdown({
    category: "rent",
    billedAmount: 5000,
    balanceAmount: 5200, // Includes 200 persisted penalty
    dueDate: "2026-08-25",
    currentDate: "2026-09-01",
    persistedPenalty: 200, // already in remaining amount
    discountAmount: 0,
    creditAmount: 0,
  });

  assert.equal(breakdown.baseAmount, 5000);
  assert.equal(breakdown.penaltyAmount, 300); // 6 billable days * 50 = 300 (higher than persisted 200)
  assert.equal(breakdown.totalAssessed, 5300);
  assert.equal(breakdown.amountPaid, 0); // 5000 base - 5000 base remaining = 0 paid
  assert.equal(breakdown.balanceDue, 5300); // 5000 base remaining + 300 evaluated penalty
});

test("TenantBillingTab source includes financial breakdown table rendering and zero-gradient classes", () => {
  const tabCode = readFileSync(
    new URL("./TenantBillingTab.jsx", import.meta.url),
    "utf8",
  );
  assert.match(tabCode, /financialBreakdown/);
  assert.match(tabCode, /Late Payment Penalty/);
  assert.doesNotMatch(tabCode, /bg-gradient/);
});
