import test from "node:test";
import assert from "node:assert/strict";
import { formatPeso, getProviderRateLabel } from "./maintenanceUtils.js";

test("formatPeso: formats single values cleanly without generating a range", () => {
  assert.equal(formatPeso(24), "PHP 24");
  assert.equal(formatPeso(0), "PHP 0");
  assert.equal(formatPeso(1250), "PHP 1,250");
  assert.equal(formatPeso(24.5), "PHP 24.50");
  assert.equal(formatPeso("24"), "PHP 24");
  assert.notEqual(formatPeso(24), "PHP 24 - PHP 0");
});

test("formatPeso: formats ranges when both min and max are provided and distinct", () => {
  assert.equal(formatPeso(500, 1500), "PHP 500 - PHP 1,500");
  assert.equal(formatPeso("500", "1500"), "PHP 500 - PHP 1,500");
  assert.equal(formatPeso(0, 500), "PHP 0 - PHP 500");
});

test("formatPeso: handles equal min and max as a single rate", () => {
  assert.equal(formatPeso(500, 500), "PHP 500");
  assert.equal(formatPeso(0, 0), "PHP 0");
});

test("formatPeso: handles missing/null bounds gracefully without generating 'PHP X - PHP 0'", () => {
  assert.equal(formatPeso(500, null), "PHP 500");
  assert.equal(formatPeso(500, undefined), "PHP 500");
  assert.equal(formatPeso(null, 1500), "PHP 1,500");
  assert.equal(formatPeso(undefined, 1500), "PHP 1,500");
  assert.equal(formatPeso(null, null), "Rate not recorded");
  assert.equal(formatPeso(undefined, undefined), "Rate not recorded");
  assert.equal(formatPeso(), "Rate not recorded");
});

test("getProviderRateLabel: formats provider rate bounds accurately", () => {
  assert.equal(getProviderRateLabel({ minRate: 500, maxRate: 1500 }), "PHP 500 - PHP 1,500");
  assert.equal(getProviderRateLabel({ minimumRate: 800, maximumRate: null }), "PHP 800");
  assert.equal(getProviderRateLabel({}), "Rate not recorded");
});
