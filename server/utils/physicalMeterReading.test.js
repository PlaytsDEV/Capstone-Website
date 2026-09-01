import { describe, expect, test } from "@jest/globals";
import {
  assertPhysicalMeterContinuity,
  parsePhysicalMeterReading,
} from "./physicalMeterReading.js";

describe("parsePhysicalMeterReading", () => {
  test.each([0, 0.5, 123, 123.45, "0", "123.45"])("accepts %p", (value) => {
    expect(parsePhysicalMeterReading(value)).toBe(Number(value));
  });

  test.each([-1, -0.01, "-6", "", "   ", "abc", NaN, Infinity, -Infinity, true, false])(
    "rejects %p",
    (value) => {
      expect(() => parsePhysicalMeterReading(value)).toThrow();
    },
  );

  test("rejects null and undefined when required", () => {
    expect(() => parsePhysicalMeterReading(null)).toThrow();
    expect(() => parsePhysicalMeterReading(undefined)).toThrow();
  });
});

describe("physical meter continuity", () => {
  test("normal regression is rejected", () => {
    expect(() => assertPhysicalMeterContinuity({ reading: 99, previousReading: 100, eventType: "moveOut" })).toThrow();
  });

  test.each(["meterReplacement", "meterRollover"])("%s explicitly permits a lower reading", (eventType) => {
    expect(assertPhysicalMeterContinuity({ reading: 5, previousReading: 100, eventType })).toBe(5);
  });
});
