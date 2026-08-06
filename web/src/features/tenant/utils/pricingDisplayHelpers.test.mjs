import test from "node:test";
import assert from "node:assert/strict";
import { isPricingDisplayUsable, getResolvedMonthlyRate } from "./pricingDisplayHelpers.js";

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
