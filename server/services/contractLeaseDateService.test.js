import { describe, expect, test } from "@jest/globals";
import { deriveContractLeaseDates } from "./contractLeaseDateService.js";

describe("canonical legal Contract term derivation", () => {
  test.each([
    [3, "2026-11-28T00:00:00.000Z"],
    [12, "2027-08-28T00:00:00.000Z"],
  ])("derives a %i-month term as an exact whole number of calendar months", (months, expectedEnd) => {
    const result = deriveContractLeaseDates({
      leaseStartDate: new Date("2026-08-28T00:00:00.000Z"),
      leaseDurationMonths: months,
    });

    expect(result.leaseStartDate.toISOString()).toBe("2026-08-28T00:00:00.000Z");
    expect(result.leaseEndDate.toISOString()).toBe(expectedEnd);
    expect(result.leaseDurationMonths).toBe(months);
  });
});
