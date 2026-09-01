import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (relativePath) => readFileSync(new URL(relativePath, import.meta.url), "utf8");

const historicalModal = read("./NewBillingPeriodModal.jsx");
const openModal = read("./OpenCurrentPeriodModal.jsx");
const billingTab = read("./UtilityBillingTab.jsx");
const overview = read("./utility/UtilityCycleOverviewCard.jsx");
const transferCard = read("../tenants/details/ScheduledRoomTransferCard.jsx");
const utilityApi = read("../../../../shared/api/utilityApi.js");
const utilityHooks = read("../../../../shared/hooks/queries/useUtility.js");

test("current-period opening and historical generation are separate admin commands", () => {
  assert.match(openModal, /useOpenUtilityPeriod/);
  assert.match(openModal, /Open Current Period/);
  assert.match(historicalModal, /useGenerateHistoricalUtilityPeriod/);
  assert.match(historicalModal, /Generate Historical/);
  assert.doesNotMatch(historicalModal, /useCloseUtilityPeriod|useDeleteUtilityPeriod/);
});

test("historical generation never deletes or replaces an active period", () => {
  assert.match(historicalModal, /An active period already exists/);
  assert.doesNotMatch(historicalModal, /deletePeriod\.mutateAsync/);
  assert.match(historicalModal, /generateHistoricalPeriod\.mutateAsync/);
});

test("overview exposes lifecycle-aware actions and a distinct manual-review state", () => {
  assert.match(overview, /!currentPeriod && !manualReviewPeriod/);
  assert.match(overview, /Open Current Period/);
  assert.match(overview, /Generate Historical Cycle/);
  assert.match(overview, /Billing Period Requires Review/);
  assert.match(billingTab, /periodList\.find\(\(p\) => p\.status === "manual_review_required"\)/);
});

test("opening readings accept zero but reject blank, negative, NaN, and Infinity", () => {
  assert.match(openModal, /value !== "" && Number\.isFinite\(Number\(value\)\) && Number\(value\) >= 0/);
  assert.match(openModal, /Zero is allowed/);
  assert.match(historicalModal, /startNum >= 0/);
  assert.match(historicalModal, /endNum >= 0/);
  assert.match(historicalModal, /isBlankValue\(periodForm\.startReading\)/);
});

test("transfer completion meter inputs enforce finite non-negative readings", () => {
  assert.match(transferCard, /Number\.isFinite\(Number\(sourceReading\)\) \|\| Number\(sourceReading\) < 0/);
  assert.match(transferCard, /Number\.isFinite\(Number\(targetReading\)\) \|\| Number\(targetReading\) < 0/);
  assert.match(transferCard, /type="number"[\s\S]*?min="0"[\s\S]*?step="0\.01"/);
});

test("the historical API and query hook use the dedicated endpoint", () => {
  assert.match(utilityApi, /periods\/historical/);
  assert.match(utilityHooks, /useGenerateHistoricalUtilityPeriod/);
  assert.match(utilityHooks, /utilityApi\.generateHistoricalPeriod/);
});
