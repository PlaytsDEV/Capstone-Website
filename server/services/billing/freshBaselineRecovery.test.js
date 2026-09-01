import { describe, expect, test } from "@jest/globals";
import mongoose from "mongoose";
import { classifyUtilityPeriodDocuments, utilityPeriodStateError, UTILITY_PERIOD_STATE } from "./utilityPeriodLifecycleService.js";
import { validateHistoricalGapResolution } from "./utilityHistoricalGapService.js";
import { parseRepairArgs, CONFIRM_TOKEN, TARGET } from "../../scripts/repair_gp705_gp1008_utility_lifecycle_v2.mjs";

const id = () => String(new mongoose.Types.ObjectId());
const baseArgs = (overrides = {}) => ({
  "schedule-id": TARGET.scheduleId, "source-period-id": TARGET.sourcePeriodId, "destination-period-id": TARGET.destinationPeriodId,
  "source-opening": "1301.25", "destination-opening": "1266.5", "observed-at": "2026-09-01T04:20:00.000Z",
  "source-evidence": "photo:gp705:fresh", "destination-evidence": "photo:gp1008:fresh",
  "source-review-owner": id(), "source-review-reference": "review:gp705:001", "destination-gap-reference": "gap:gp1008:001",
  "expected-source-updated-at": "2026-09-01T09:08:48.910Z", "expected-destination-updated-at": "2026-09-01T09:16:32.147Z",
  "expected-bill-updated-at": "2026-09-01T09:08:48.744Z", "expected-reservation-updated-at": "2026-09-01T12:11:36.903Z",
  "reservation-change-reference": "investigation:reservation-update:pending", "actor-id": id(), ...overrides,
});
const argv = (overrides = {}, write = false) => {
  const args = Object.entries(baseArgs(overrides)).flatMap(([key, value]) => value == null ? [] : [`--${key}`, String(value)]);
  if (write) args.push("--write", "--confirm-token", CONFIRM_TOKEN);
  return args;
};

describe("fresh-baseline recovery domain contract", () => {
  test("6. source replacement state is MANUAL_REVIEW_REQUIRED", () => {
    expect(classifyUtilityPeriodDocuments([{ status: "manual_review_required", isArchived: false, startDate: new Date("2026-09-01T04:20:00Z") }], { cutoverAt: new Date("2026-09-01T04:20:00Z") }).state).toBe(UTILITY_PERIOD_STATE.MANUAL_REVIEW_REQUIRED);
  });
  test("7. manual review produces a typed source transfer blocker", () => {
    const error = utilityPeriodStateError({ resolution: { state: UTILITY_PERIOD_STATE.MANUAL_REVIEW_REQUIRED, activeCount: 1, period: { manualReview: { reason: "unknown_prebaseline_consumption" } } }, roomLabel: "GP-705", role: "source" });
    expect(error).toMatchObject({ code: "ROOM_TRANSFER_SOURCE_ELECTRICITY_PERIOD_REVIEW_REQUIRED", statusCode: 409 });
    expect(error.message).toContain("unresolved pre-baseline interval");
  });
  test("8. destination replacement remains OPEN", () => {
    expect(classifyUtilityPeriodDocuments([{ status: "open", isArchived: false, startDate: new Date("2026-09-01T04:20:00Z") }], { cutoverAt: new Date("2026-09-01T04:20:00Z") }).state).toBe(UTILITY_PERIOD_STATE.OPEN);
  });
  test("9. a cutover before the destination fresh baseline is outside the period", () => {
    expect(classifyUtilityPeriodDocuments([{ status: "open", isArchived: false, startDate: new Date("2026-09-01T04:20:00Z") }], { cutoverAt: new Date("2026-09-01T04:19:59Z") }).state).toBe(UTILITY_PERIOD_STATE.OUTSIDE_PERIOD);
  });
  test("10. review resolution normalizes actor-authorized outcome evidence", () => {
    expect(validateHistoricalGapResolution({ outcome: "OTHER_REVIEWED_DISPOSITION", explanation: "Reviewed", evidenceReferences: ["ledger:1"], approvalReference: "approval:1", financialDispositionType: "MANUAL_DEBIT", financialAmount: 25.129 })).toMatchObject({ outcome: "OTHER_REVIEWED_DISPOSITION", financialAmount: 25.13, evidenceReferences: ["ledger:1"] });
  });
  test("11. approved non-charge requires explicit approval metadata", () => {
    expect(() => validateHistoricalGapResolution({ outcome: "APPROVED_NON_CHARGE", explanation: "Business loss", approvalReference: "" })).toThrow("Approval reference");
    expect(validateHistoricalGapResolution({ outcome: "APPROVED_NON_CHARGE", explanation: "Business loss", approvalReference: "approval:owner:1" })).toMatchObject({ financialAmount: 0, financialDispositionType: "AUTHORIZED_BUSINESS_LOSS_NON_CHARGE" });
  });
  test("12. accounting adjustment preserves canonical signed money semantics", () => {
    expect(validateHistoricalGapResolution({ outcome: "ACCOUNTING_ADJUSTMENT", explanation: "Approved credit", approvalReference: "approval:1", financialDispositionType: "TENANT_CREDIT", financialAmount: -12.345 })).toMatchObject({ financialAmount: -12.34 });
    expect(() => validateHistoricalGapResolution({ outcome: "ACCOUNTING_ADJUSTMENT", explanation: "No amount", approvalReference: "approval:1", financialDispositionType: "DEBIT", financialAmount: 0 })).toThrow("non-zero signed amount");
  });
  test("13. reconstructed outcome cannot accept an invented client amount", () => {
    expect(() => validateHistoricalGapResolution({ outcome: "RECONSTRUCTED_FROM_VERIFIED_READING", explanation: "Found reading", evidenceReferences: ["photo:1"], approvalReference: "approval:1", financialAmount: 10 })).toThrow("canonical billing recomputation");
  });
  test("14. one lifecycle-active period is the resolver invariant", () => {
    expect(classifyUtilityPeriodDocuments([{ status: "open", isArchived: false, startDate: new Date() }, { status: "manual_review_required", isArchived: false, startDate: new Date() }]).state).toBe(UTILITY_PERIOD_STATE.AMBIGUOUS);
  });
  test("18. future observedAt is rejected", () => {
    expect(() => parseRepairArgs(argv({ "observed-at": "2099-01-01T00:00:00.000Z" }))).toThrow("cannot be in the future");
  });
  test("20. reservation fingerprint is an explicit required v2 input", () => {
    expect(() => parseRepairArgs(argv({ "expected-reservation-updated-at": null }))).toThrow("expected-reservation-updated-at");
    expect(() => parseRepairArgs(argv({}, true))).toThrow("Reservation.updatedAt change reference");
  });
  test("21. v2 dry-run plan does not contain a reschedule input", () => {
    expect(() => parseRepairArgs([...argv(), "--effective-transfer-date", "2026-09-02"])).toThrow("Unsupported argument");
  });
  test("v2 write uses a distinct exact confirmation token", () => {
    expect(() => parseRepairArgs([...argv(), "--write", "--confirm-token", "GP705-GP1008-2026-09-01"])).toThrow(CONFIRM_TOKEN);
  });
});
