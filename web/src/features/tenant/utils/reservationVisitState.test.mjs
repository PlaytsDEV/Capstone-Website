import test from "node:test";
import assert from "node:assert/strict";

import {
  getPersistedPhysicalVisitState,
  normalizeReservationVisitDate,
} from "./reservationVisitState.js";

test("physical visit summary stays hidden until the visit is persisted", () => {
  const state = getPersistedPhysicalVisitState(
    {
      status: "pending",
      viewingPreference: "",
      visitDate: "",
      visitTime: "",
    },
    "physical_visit",
  );

  assert.equal(state.hasSavedPhysicalVisit, false);
});

test("physical visit summary is available for saved reservation schedule data", () => {
  const state = getPersistedPhysicalVisitState(
    {
      viewingPreference: "physical_visit",
      visitDate: "2099-06-01T00:00:00.000Z",
      visitTime: "09:00 AM",
    },
    "physical_visit",
  );

  assert.equal(state.hasSavedPhysicalVisit, true);
  assert.equal(state.savedVisitDate, "2099-06-01");
  assert.equal(state.savedVisitTime, "09:00 AM");
});

test("rejected physical visit schedules do not stay in saved summary mode", () => {
  const state = getPersistedPhysicalVisitState(
    {
      viewingPreference: "physical_visit",
      visitDate: "2099-06-01T00:00:00.000Z",
      visitTime: "09:00 AM",
    },
    "physical_visit",
    true,
  );

  assert.equal(state.hasSavedPhysicalVisit, false);
});

test("visit date normalization keeps date-only values stable", () => {
  assert.equal(normalizeReservationVisitDate("2099-06-01"), "2099-06-01");
  assert.equal(
    normalizeReservationVisitDate("2099-06-01T00:00:00.000Z"),
    "2099-06-01",
  );
});
