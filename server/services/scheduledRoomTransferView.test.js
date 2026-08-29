import { describe, expect, it } from "@jest/globals";
import {
  describeScheduledTransferActionRequired,
  deriveScheduledTransferUserStatus,
  SCHEDULED_TRANSFER_STATUS_LABELS,
} from "./scheduledRoomTransferView.js";

describe("describeScheduledTransferActionRequired", () => {
  it("returns null when no reason", () => {
    expect(describeScheduledTransferActionRequired(null)).toBeNull();
    expect(describeScheduledTransferActionRequired("")).toBeNull();
  });

  it("maps each canonical action reason to a friendly message, never echoing the raw code", () => {
    for (const code of [
      "TRANSFER_BALANCE_UNPAID",
      "ADDITIONAL_BALANCE_DUE",
      "FINANCIAL_ADJUSTMENT_REQUIRED",
      "PAYMENT_ALREADY_RECEIVED",
      "OPERATIONAL_VALIDATION_FAILED",
      "EXECUTION_FAILED",
    ]) {
      const msg = describeScheduledTransferActionRequired(code);
      expect(typeof msg).toBe("string");
      expect(msg.length).toBeGreaterThan(10);
      expect(msg).not.toContain(code);
    }
  });

  it("strips a suffix after ':' (EXECUTION_FAILED: <detail>) before mapping", () => {
    expect(describeScheduledTransferActionRequired("EXECUTION_FAILED: BED_NOT_AVAILABLE")).toMatch(
      /could not be completed/i,
    );
  });

  it("falls back to a generic review message for an unknown reason", () => {
    expect(describeScheduledTransferActionRequired("SOMETHING_NEW")).toMatch(/needs review/i);
  });
});

describe("deriveScheduledTransferUserStatus — only the 5 Admin labels", () => {
  const cases = [
    [{ status: "executed" }, null, "completed"],
    [{ status: "cancelled" }, null, "cancelled"],
    [{ status: "action_required" }, null, "action_required"],
    [{ status: "scheduled" }, { paymentState: "none" }, "ready"],
    [{ status: "scheduled" }, { paymentState: "paid" }, "ready"],
    [{ status: "scheduled" }, { paymentState: "partial" }, "awaiting_payment"],
    [{ status: "scheduled" }, { paymentState: "unpaid" }, "awaiting_payment"],
  ];
  it.each(cases)("%o + %o -> %s", (doc, balance, expected) => {
    const s = deriveScheduledTransferUserStatus(doc, balance);
    expect(s).toBe(expected);
    expect(Object.keys(SCHEDULED_TRANSFER_STATUS_LABELS)).toContain(s);
  });

  it("never emits a raw scheduler enum", () => {
    for (const [doc, balance] of cases) {
      const s = deriveScheduledTransferUserStatus(doc, balance);
      expect(["scheduled", "executed"]).not.toContain(s);
    }
  });
});
