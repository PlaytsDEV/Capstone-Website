import test from "node:test";
import assert from "node:assert/strict";

import {
  isPhysicalVisitApplicationLocked,
} from "./physicalVisitFlow.js";

test("scheduled physical visits keep final application submission locked", () => {
  assert.equal(
    isPhysicalVisitApplicationLocked({
      status: "visit_approved",
      viewingPreference: "physical_visit",
      viewingType: "inperson",
      visitStatus: "physical_visit_scheduled",
      scheduleApproved: true,
      visitApproved: false,
      visitDate: "2026-05-20T00:00:00.000Z",
      visitTime: "09:00 AM",
    }),
    true,
  );
});

test("completed physical visits unlock final application submission", () => {
  assert.equal(
    isPhysicalVisitApplicationLocked({
      status: "visit_approved",
      viewingPreference: "physical_visit",
      viewingType: "inperson",
      visitStatus: "visit_completed",
      visitApproved: true,
    }),
    false,
  );
});

test("remote viewing does not use the physical visit submission lock", () => {
  assert.equal(
    isPhysicalVisitApplicationLocked({
      status: "viewing_preference_selected",
      viewingPreference: "remote_2d_viewing",
      viewingType: "remote_2d",
    }),
    false,
  );
});
