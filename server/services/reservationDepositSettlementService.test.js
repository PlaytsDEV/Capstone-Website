import { describe, expect, test } from "@jest/globals";
import {
  RESERVATION_DEPOSIT_SOURCES,
  amountsMatch,
  normalizePaymentMethod,
  resolveReservationFee,
  toCentavos,
} from "./reservationDepositSettlementService.js";

describe("reservationDepositSettlementService money and source rules", () => {
  test("normalizes currency values to centavos without floating-point equality", () => {
    expect(toCentavos(6300)).toBe(630000);
    expect(toCentavos("6300.005")).toBe(630001);
    expect(amountsMatch(0.1 + 0.2, 0.3)).toBe(true);
    expect(amountsMatch(2000, 1999.99)).toBe(false);
  });

  test("preserves an explicit zero-value pricing snapshot", async () => {
    const fallback = async () => 2000;
    await expect(
      resolveReservationFee({ reservationFeeAmount: 0 }, fallback),
    ).resolves.toBe(0);
  });

  test("uses the fallback only when the snapshot is nullish", async () => {
    await expect(
      resolveReservationFee({ reservationFeeAmount: null }, async () => 2000),
    ).resolves.toBe(2000);
  });

  test("limits settlement sources to reviewed backend paths", () => {
    expect(RESERVATION_DEPOSIT_SOURCES).toEqual([
      "paymongo",
      "manual_proof",
      "legacy_reconciliation",
    ]);
    expect(RESERVATION_DEPOSIT_SOURCES).not.toContain("client");
  });
});

describe("normalizePaymentMethod", () => {
  test("preserves the actual PayMongo channel instead of collapsing it to the provider name", () => {
    expect(normalizePaymentMethod("paymongo", { paymentMethod: "gcash" })).toBe("gcash");
    expect(normalizePaymentMethod("paymongo", { paymentMethod: "card" })).toBe("card");
  });

  test("normalizes channel casing, spacing, and separators", () => {
    expect(normalizePaymentMethod("paymongo", { paymentMethod: "GCash" })).toBe("gcash");
    expect(normalizePaymentMethod("paymongo", { paymentMethod: "bank_transfer" })).toBe("bank");
  });

  test("falls back to a generic online payment for a real but unmapped channel", () => {
    expect(normalizePaymentMethod("paymongo", { paymentMethod: "dob" })).toBe("online");
    expect(normalizePaymentMethod("paymongo", { paymentMethod: "qrph" })).toBe("online");
  });

  test("falls back to the provider name only when no channel evidence is available", () => {
    expect(normalizePaymentMethod("paymongo", {})).toBe("paymongo");
    expect(normalizePaymentMethod("paymongo", { currency: "PHP" })).toBe("paymongo");
  });

  test("keeps manual-proof settlement behavior unchanged", () => {
    expect(normalizePaymentMethod("manual_proof", { paymentMethod: "bank" })).toBe("bank");
    expect(normalizePaymentMethod("manual_proof", {})).toBe("bank");
  });
});
