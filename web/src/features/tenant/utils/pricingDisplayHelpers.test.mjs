import test from "node:test";
import assert from "node:assert/strict";
import {
  isPricingDisplayUsable,
  getResolvedMonthlyRate,
  getEffectiveMonthlyStayRate,
} from "./pricingDisplayHelpers.js";

test("preview pricing display for a 12-month GP Quadruple lease resolves to PHP 5,400", () => {
  const pricingDisplay = {
    status: "preview",
    regularMonthlyRate: 6000,
    discountPercentage: 10,
    finalMonthlyRate: 5400,
    leaseType: "long_term",
  };
  assert.equal(isPricingDisplayUsable(pricingDisplay), true);
  assert.equal(getResolvedMonthlyRate(pricingDisplay), 5400);
});

test("preview pricing display for a 5-month GP Quadruple lease resolves to PHP 6,300", () => {
  const pricingDisplay = {
    status: "preview",
    regularMonthlyRate: 7000,
    discountPercentage: 10,
    finalMonthlyRate: 6300,
    leaseType: "short_term",
  };
  assert.equal(getResolvedMonthlyRate(pricingDisplay), 6300);
});

test("snapshotted (approved) pricing display is treated as usable", () => {
  const pricingDisplay = { status: "snapshotted", finalMonthlyRate: 5400 };
  assert.equal(isPricingDisplayUsable(pricingDisplay), true);
  assert.equal(getResolvedMonthlyRate(pricingDisplay), 5400);
});

test("unavailable pricing display never returns a guessed number", () => {
  const pricingDisplay = { status: "unavailable", reason: "LEASE_DURATION_INVALID" };
  assert.equal(isPricingDisplayUsable(pricingDisplay), false);
  assert.equal(getResolvedMonthlyRate(pricingDisplay), null);
});

test("missing pricingDisplay (not yet fetched) is treated as unavailable, not zero", () => {
  assert.equal(isPricingDisplayUsable(undefined), false);
  assert.equal(getResolvedMonthlyRate(null), null);
});

test("a malformed finalMonthlyRate (non-finite) does not produce a fake number", () => {
  const pricingDisplay = { status: "preview", finalMonthlyRate: "not-a-number" };
  assert.equal(getResolvedMonthlyRate(pricingDisplay), null);
});

test("getEffectiveMonthlyStayRate computes base rate + appliance fees with formatting", () => {
  const reservationData = {
    room: {
      type: "quadruple",
      monthlyPrice: 5400,
      isDiscountEnabled: true,
    },
    leaseDuration: "12",
    applianceFees: 200,
    selectedAppliances: [{ name: "Laptop", fee: 200, quantity: 1 }],
  };

  const result = getEffectiveMonthlyStayRate(reservationData);
  assert.equal(result.baseMonthlyRent, 5400);
  assert.equal(result.applianceFees, 200);
  assert.equal(result.estimatedMonthlyTotal, 5600);
  assert.equal(result.formattedMonthlyRate, "₱5,600 / mo");
  assert.equal(result.applianceNote, "Includes ₱200/mo appliance add-ons");
});

test("getEffectiveMonthlyStayRate reacts to short-term lease duration override", () => {
  const reservationData = {
    room: {
      type: "quadruple",
      isDiscountEnabled: true,
    },
    leaseDuration: "12",
  };

  const shortTermResult = getEffectiveMonthlyStayRate(reservationData, { leaseDuration: "3" });
  assert.equal(shortTermResult.baseMonthlyRent, 6300);
  assert.equal(shortTermResult.estimatedMonthlyTotal, 6300);
  assert.equal(shortTermResult.formattedMonthlyRate, "₱6,300 / mo");
  assert.equal(shortTermResult.applianceNote, "");
});
