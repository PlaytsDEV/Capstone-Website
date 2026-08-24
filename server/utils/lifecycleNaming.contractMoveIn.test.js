import { describe, expect, test } from "@jest/globals";
import { readMoveInDate } from "./lifecycleNaming.js";

describe("canonical Reservation move-in date resolution", () => {
  test("falls back to legacy targetMoveInDate when every newer field is null", () => {
    const targetMoveInDate = new Date("2026-08-28T00:00:00.000Z");
    const reservation = {
      confirmedMoveInDate: null,
      moveInDate: null,
      intendedMoveInDate: null,
      targetMoveInDate,
    };

    expect(readMoveInDate(reservation)).toBe(targetMoveInDate);
    expect(readMoveInDate(reservation, { includeSource: true })).toEqual({
      value: targetMoveInDate,
      sourceField: "targetMoveInDate",
    });
  });

  test("reports the same higher-priority source that readMoveInDate consumes", () => {
    const confirmedMoveInDate = new Date("2026-08-24T00:00:00.000Z");
    const reservation = {
      confirmedMoveInDate,
      targetMoveInDate: new Date("2026-08-28T00:00:00.000Z"),
    };

    expect(readMoveInDate(reservation)).toBe(confirmedMoveInDate);
    expect(readMoveInDate(reservation, { includeSource: true }).sourceField)
      .toBe("confirmedMoveInDate");
  });
});
