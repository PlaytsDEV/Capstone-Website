import { describe, expect, test } from "@jest/globals";
import {
  ADDRESS_NORMALIZE_STATUS,
  joinAddressParts,
  normalizeAddress,
  normalizeReservationAddress,
  stripRegionSuffix,
} from "./addressUtils.js";

describe("normalizeAddress", () => {
  test("canonical worked example: duplicate house number + repeated city/province tail", () => {
    const result = normalizeAddress(
      "17, 17 St. Mary St., Duplex Homes, Molino IV, City of Bacoor, Cavite, City of Bacoor, Cavite",
    );
    expect(result.value).toBe("17 St. Mary St., Duplex Homes, Molino IV, City of Bacoor, Cavite");
    expect(result.status).toBe(ADDRESS_NORMALIZE_STATUS.AUTO_FIXED);
  });

  test("duplicate leading house number", () => {
    expect(normalizeAddress("17, 17 St. Mary St.").value).toBe("17 St. Mary St.");
  });

  test("duplicate city/province sequence", () => {
    const result = normalizeAddress("City of Bacoor, Cavite, City of Bacoor, Cavite");
    expect(result.value).toBe("City of Bacoor, Cavite");
    expect(result.reasons).toContain("REPEATED_SEQUENCE");
  });

  test("exact repeated single segment", () => {
    const result = normalizeAddress("Molino IV, Molino IV");
    expect(result.value).toBe("Molino IV");
    expect(result.reasons).toContain("REPEATED_SEGMENT");
  });

  test("duplicate punctuation", () => {
    expect(normalizeAddress("17 St. Mary St.,, Duplex Homes").value).toBe("17 St. Mary St., Duplex Homes");
  });

  test("extra whitespace collapses", () => {
    expect(normalizeAddress("17   St. Mary St.").value).toBe("17 St. Mary St.");
  });

  test("leading/trailing commas and whitespace are cleaned", () => {
    expect(normalizeAddress(" , 17 St. Mary St. ,").value).toBe("17 St. Mary St.");
  });

  test("case-insensitive dedup preserves the first occurrence's casing", () => {
    const result = normalizeAddress("Cavite, CAVITE");
    expect(result.value).toBe("Cavite");
  });

  test("does not over-clean a legitimately similar but distinct place name (San Jose)", () => {
    const result = normalizeAddress("San Jose, San Jose del Monte");
    expect(result.value).toBe("San Jose, San Jose del Monte");
    expect(result.status).toBe(ADDRESS_NORMALIZE_STATUS.UNCHANGED);
  });

  test("does not over-clean a legitimately similar but distinct place name (General Trias)", () => {
    const result = normalizeAddress("General Trias, General Trias City");
    expect(result.value).toBe("General Trias, General Trias City");
    expect(result.status).toBe(ADDRESS_NORMALIZE_STATUS.UNCHANGED);
  });

  test.each([
    "17, 17 St. Mary St., Duplex Homes, Molino IV, City of Bacoor, Cavite, City of Bacoor, Cavite",
    "Molino IV, Molino IV",
    "City of Bacoor, Cavite, City of Bacoor, Cavite",
    "17 St. Mary St.,, Duplex Homes",
    "17   St. Mary St.",
    "San Jose, San Jose del Monte",
    "General Trias, General Trias City",
    "Cavite, CAVITE",
    "Already Clean Street, City, Province",
  ])("is idempotent for %j", (input) => {
    const once = normalizeAddress(input).value;
    const twice = normalizeAddress(once).value;
    expect(twice).toBe(once);
  });

  test("handles null/undefined/non-string input safely", () => {
    expect(normalizeAddress(null)).toEqual({ value: "", status: ADDRESS_NORMALIZE_STATUS.ALREADY_CLEAN, reasons: [] });
    expect(normalizeAddress(undefined)).toEqual({ value: "", status: ADDRESS_NORMALIZE_STATUS.ALREADY_CLEAN, reasons: [] });
    expect(normalizeAddress("")).toEqual({ value: "", status: ADDRESS_NORMALIZE_STATUS.ALREADY_CLEAN, reasons: [] });
  });

  test("already-clean input is left byte-stable and reported ALREADY_CLEAN", () => {
    const input = "Already Clean Street, City, Province";
    const result = normalizeAddress(input);
    expect(result.value).toBe(input);
    expect(result.status).toBe(ADDRESS_NORMALIZE_STATUS.ALREADY_CLEAN);
  });

  test("whitespace-only fix is reported AUTO_FIXED", () => {
    const result = normalizeAddress("17   St. Mary St.");
    expect(result.status).toBe(ADDRESS_NORMALIZE_STATUS.AUTO_FIXED);
  });
});

describe("stripRegionSuffix", () => {
  test.each([
    ["123 Sample St., Quezon City, National Capital Region (NCR)", "123 Sample St., Quezon City"],
    ["123 Sample St., Quezon City, NCR", "123 Sample St., Quezon City"],
    ["123 Sample St., Bacoor, Region IV-A (CALABARZON)", "123 Sample St., Bacoor"],
    ["123 Sample St., Bacoor, Cavite", "123 Sample St., Bacoor, Cavite"],
  ])("%j -> %j", (input, expected) => {
    expect(stripRegionSuffix(input)).toBe(expected);
  });

  test("handles null/non-string safely", () => {
    expect(stripRegionSuffix(null)).toBe("");
    expect(stripRegionSuffix(undefined)).toBe("");
  });
});

describe("joinAddressParts / normalizeReservationAddress", () => {
  const address = {
    unitHouseNo: "17",
    street: "17 St. Mary St.",
    barangay: "Duplex Homes",
    city: "Molino IV, City of Bacoor",
    province: "Cavite",
  };

  test("joinAddressParts joins the structured fields in order", () => {
    expect(joinAddressParts(address)).toBe(
      "17, 17 St. Mary St., Duplex Homes, Molino IV, City of Bacoor, Cavite",
    );
  });

  test("joinAddressParts handles missing fields safely", () => {
    expect(joinAddressParts({ street: "17 St. Mary St.", city: "Bacoor" })).toBe("17 St. Mary St., Bacoor");
    expect(joinAddressParts(null)).toBe("");
    expect(joinAddressParts(undefined)).toBe("");
  });

  test("normalizeReservationAddress composes join -> stripRegionSuffix -> normalize", () => {
    expect(normalizeReservationAddress(address)).toBe(
      "17 St. Mary St., Duplex Homes, Molino IV, City of Bacoor, Cavite",
    );
  });

  test("normalizeReservationAddress strips a trailing region qualifier", () => {
    expect(normalizeReservationAddress({
      street: "123 Sample St.",
      city: "Quezon City",
      province: "National Capital Region (NCR)",
    })).toBe("123 Sample St., Quezon City");
  });
});
