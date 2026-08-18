import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { validateTargetMoveInDate } from "./reservationValidation.js";
import {
  formatDateInputValue,
  getMoveInDateConstraints,
  getDateConstraints,
} from "../pages/reservation-steps/applicationFormConstants.js";

describe("move-in date validation & constraints (3 days up to 3 months)", () => {
  it("formatDateInputValue formats dates as YYYY-MM-DD", () => {
    const d = new Date(2026, 7, 21); // Aug 21 2026
    assert.equal(formatDateInputValue(d), "2026-08-21");
    assert.equal(formatDateInputValue(""), "");
    assert.equal(formatDateInputValue(null), "");
  });

  it("getMoveInDateConstraints computes correct min and max date strings", () => {
    const base = new Date(2026, 7, 18); // 2026-08-18
    const constraints = getMoveInDateConstraints(base);
    assert.equal(constraints.moveInMin, "2026-08-21"); // +3 days
    assert.equal(constraints.moveInMax, "2026-11-18"); // +3 months
    assert.equal(constraints.minMoveInDate, "2026-08-21");
    assert.equal(constraints.maxMoveInDate, "2026-11-18");
  });

  it("getDateConstraints returns non-empty birthday and move-in constraints", () => {
    const constraints = getDateConstraints();
    assert.ok(constraints.birthdayMin);
    assert.ok(constraints.birthdayMax);
    assert.ok(constraints.moveInMin);
    assert.ok(constraints.moveInMax);
    assert.ok(constraints.moveInMin < constraints.moveInMax);
  });

  it("validateTargetMoveInDate requires a date", () => {
    const res = validateTargetMoveInDate("");
    assert.equal(res.valid, false);
    assert.match(res.error, /required/i);
  });

  it("validateTargetMoveInDate rejects invalid date strings", () => {
    const res = validateTargetMoveInDate("not-a-date");
    assert.equal(res.valid, false);
    assert.match(res.error, /valid/i);
  });

  it("validateTargetMoveInDate rejects dates earlier than 3 days from today", () => {
    const today = new Date();
    const todayStr = formatDateInputValue(today);
    const resToday = validateTargetMoveInDate(todayStr);
    assert.equal(resToday.valid, false);
    assert.match(resToday.error, /at least 3 days from today/i);

    const tomorrow = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    const resTomorrow = validateTargetMoveInDate(formatDateInputValue(tomorrow));
    assert.equal(resTomorrow.valid, false);

    const twoDaysLater = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 2);
    const resTwoDays = validateTargetMoveInDate(formatDateInputValue(twoDaysLater));
    assert.equal(resTwoDays.valid, false);
  });

  it("validateTargetMoveInDate accepts exactly 3 days from today", () => {
    const today = new Date();
    const threeDaysLater = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 3);
    const res = validateTargetMoveInDate(formatDateInputValue(threeDaysLater));
    assert.equal(res.valid, true);
    assert.equal(res.error, undefined);
  });

  it("validateTargetMoveInDate accepts dates within 1 to 2 months from today", () => {
    const today = new Date();
    const oneMonthLater = new Date(today.getFullYear(), today.getMonth() + 1, today.getDate());
    const res1 = validateTargetMoveInDate(formatDateInputValue(oneMonthLater));
    assert.equal(res1.valid, true);

    const twoMonthsLater = new Date(today.getFullYear(), today.getMonth() + 2, today.getDate());
    const res2 = validateTargetMoveInDate(formatDateInputValue(twoMonthsLater));
    assert.equal(res2.valid, true);
  });

  it("validateTargetMoveInDate accepts dates up to 3 months from today", () => {
    const today = new Date();
    const threeMonthsLater = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate());
    const res = validateTargetMoveInDate(formatDateInputValue(threeMonthsLater));
    assert.equal(res.valid, true);
  });

  it("validateTargetMoveInDate rejects dates beyond 3 months from today", () => {
    const today = new Date();
    const beyondThreeMonths = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate() + 2);
    const res = validateTargetMoveInDate(formatDateInputValue(beyondThreeMonths));
    assert.equal(res.valid, false);
    assert.match(res.error, /up to 3 months/i);
  });
});
