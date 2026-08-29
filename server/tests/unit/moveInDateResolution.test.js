import { describe, it, expect } from "@jest/globals";
import { readMoveInDate, resolveMoveInConfirmationDate } from "../../utils/lifecycleNaming.js";

describe("Move-In Date Resolution & Normalization", () => {
  it("prioritizes confirmedMoveInDate over moveInDate and intendedMoveInDate", () => {
    const reservation = {
      intendedMoveInDate: new Date("2026-09-01"),
      moveInDate: new Date("2026-09-01"),
      confirmedMoveInDate: new Date("2026-08-30"),
    };
    const resolved = readMoveInDate(reservation);
    expect(new Date(resolved).toISOString().slice(0, 10)).toBe("2026-08-30");
  });

  it("returns confirmedMoveInDate sourceField when includeSource is true", () => {
    const reservation = {
      intendedMoveInDate: new Date("2026-09-01"),
      moveInDate: new Date("2026-09-01"),
      confirmedMoveInDate: new Date("2026-08-30"),
    };
    const resolved = readMoveInDate(reservation, { includeSource: true });
    expect(resolved.sourceField).toBe("confirmedMoveInDate");
    expect(new Date(resolved.value).toISOString().slice(0, 10)).toBe("2026-08-30");
  });

  it("falls back to moveInDate when confirmedMoveInDate is not set", () => {
    const reservation = {
      intendedMoveInDate: new Date("2026-09-01"),
      moveInDate: new Date("2026-09-01"),
      confirmedMoveInDate: null,
    };
    const resolved = readMoveInDate(reservation);
    expect(new Date(resolved).toISOString().slice(0, 10)).toBe("2026-09-01");
  });

  it("falls back to intendedMoveInDate when moveInDate is not set", () => {
    const reservation = {
      intendedMoveInDate: new Date("2026-09-01"),
      moveInDate: null,
      confirmedMoveInDate: null,
    };
    const resolved = readMoveInDate(reservation);
    expect(new Date(resolved).toISOString().slice(0, 10)).toBe("2026-09-01");
  });

  describe("resolveMoveInConfirmationDate", () => {
    it("resolves confirmedMoveInDate when provided directly", () => {
      const result = resolveMoveInConfirmationDate({
        confirmedMoveInDate: "2026-09-01",
        actualMoveInDate: null,
        reservation: { moveInDate: "2026-08-25" },
      });
      expect(result.toISOString().slice(0, 10)).toBe("2026-09-01");
    });

    it("resolves actualMoveInDate when confirmedMoveInDate is omitted", () => {
      const result = resolveMoveInConfirmationDate({
        actualMoveInDate: "2026-08-30",
        reservation: { moveInDate: "2026-09-01" },
      });
      expect(result.toISOString().slice(0, 10)).toBe("2026-08-30");
    });

    it("falls back to reservation scheduled moveInDate when neither payload date is provided", () => {
      const result = resolveMoveInConfirmationDate({
        reservation: { moveInDate: "2026-09-01" },
      });
      expect(result.toISOString().slice(0, 10)).toBe("2026-09-01");
    });
  });
});
