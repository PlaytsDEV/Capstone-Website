import { describe, expect, it } from "@jest/globals";
import {
  generatePaymentReference,
  isRawPaymentGatewayId,
  formatDisplayReference,
} from "./referenceGenerator.js";

describe("referenceGenerator", () => {
  describe("generatePaymentReference", () => {
    it("generates a structured payment reference with default prefix and current date", () => {
      const fixedDate = new Date("2026-08-18T12:00:00Z");
      const ref = generatePaymentReference({ date: fixedDate });
      expect(ref).toMatch(/^PAY-20260818-[A-Z2-9]{6}$/);
    });

    it("supports custom prefixes and random length", () => {
      const fixedDate = new Date("2026-12-25T00:00:00Z");
      const ref = generatePaymentReference({ prefix: "REF-RES", date: fixedDate, randomLength: 4 });
      expect(ref).toMatch(/^REF-RES-20261225-[A-Z2-9]{4}$/);
    });

    it("generates unique values across multiple calls", () => {
      const set = new Set();
      for (let i = 0; i < 50; i++) {
        set.add(generatePaymentReference());
      }
      expect(set.size).toBe(50);
    });
  });

  describe("isRawPaymentGatewayId", () => {
    it("detects pay_ IDs", () => {
      expect(isRawPaymentGatewayId("pay_mPxYFUnBuW2SgCabJkrLV447")).toBe(true);
    });

    it("detects cs_, src_, evt_ IDs", () => {
      expect(isRawPaymentGatewayId("cs_test_123456")).toBe(true);
      expect(isRawPaymentGatewayId("src_abc123")).toBe(true);
      expect(isRawPaymentGatewayId("evt_xyz789")).toBe(true);
    });

    it("detects 24-character hex MongoDB ObjectIDs", () => {
      expect(isRawPaymentGatewayId("66bc2e89d81d2c14f092eabc")).toBe(true);
    });

    it("returns false for valid Lilycrest references", () => {
      expect(isRawPaymentGatewayId("PAY-20260818-7K2M9X")).toBe(false);
      expect(isRawPaymentGatewayId("PAY-A1B2C3D4")).toBe(false);
      expect(isRawPaymentGatewayId("RES-AB12CD")).toBe(false);
    });

    it("returns false for empty or non-string values", () => {
      expect(isRawPaymentGatewayId(null)).toBe(false);
      expect(isRawPaymentGatewayId(undefined)).toBe(false);
      expect(isRawPaymentGatewayId("")).toBe(false);
    });
  });

  describe("formatDisplayReference", () => {
    it("returns clean Lilycrest reference unchanged", () => {
      expect(formatDisplayReference("PAY-20260818-7K2M9X")).toBe("PAY-20260818-7K2M9X");
      expect(formatDisplayReference("RES-AB12CD")).toBe("RES-AB12CD");
    });

    it("masks raw PayMongo IDs into clean display format", () => {
      expect(formatDisplayReference("pay_mPxYFUnBuW2SgCabJkrLV447")).toBe("PAY-REF-RLV447");
    });

    it("returns fallback for null or empty string", () => {
      expect(formatDisplayReference(null)).toBe("—");
      expect(formatDisplayReference("")).toBe("—");
      expect(formatDisplayReference(undefined, "N/A")).toBe("N/A");
    });
  });
});
