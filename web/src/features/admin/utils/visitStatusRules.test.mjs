import test from "node:test";
import assert from "node:assert/strict";

import {
  VISIT_COMPLETED_LOCK_MESSAGE,
  getVisitManagementAvailability,
} from "./visitStatusRules.js";

test("completed visits lock normal admin visit actions", () => {
  const availability = getVisitManagementAvailability({
    visitStatusKey: "visit_completed",
    hasVisitSchedule: true,
  });

  assert.equal(availability.completed, true);
  assert.equal(availability.helperMessage, VISIT_COMPLETED_LOCK_MESSAGE);
  assert.equal(availability.canApproveSchedule, false);
  assert.equal(availability.canRejectSchedule, false);
  assert.equal(availability.canMarkVisited, false);
  assert.equal(availability.canMarkNoShow, false);
  assert.equal(availability.canReschedule, false);
  assert.equal(availability.canCancelVisit, false);
  assert.equal(availability.canAllowWithoutVisit, false);
});

test("pending schedule: approve/reject available, outcome actions not yet available", () => {
  const availability = getVisitManagementAvailability({
    visitStatusKey: "physical_visit_scheduled",
    hasVisitSchedule: true,
  });

  assert.equal(availability.canApproveSchedule, true);
  assert.equal(availability.canRejectSchedule, true);
  assert.equal(availability.canMarkVisited, false);
  assert.equal(availability.canMarkNoShow, false);
  assert.equal(availability.canReschedule, true);
  assert.equal(availability.canCancelVisit, true);
  assert.equal(availability.canAllowWithoutVisit, true);
});

test("approved schedule: outcome actions available, approve/reject no longer available", () => {
  const availability = getVisitManagementAvailability({
    visitStatusKey: "schedule_approved",
    hasVisitSchedule: true,
  });

  assert.equal(availability.canApproveSchedule, false);
  assert.equal(availability.canRejectSchedule, false);
  assert.equal(availability.canMarkVisited, true);
  assert.equal(availability.canMarkNoShow, true);
  assert.equal(availability.canReschedule, true);
  assert.equal(availability.canCancelVisit, true);
  assert.equal(availability.canAllowWithoutVisit, true);
});

test("rescheduled visits: needs re-approval before outcome can be recorded", () => {
  const availability = getVisitManagementAvailability({
    visitStatusKey: "rescheduled",
    hasVisitSchedule: true,
  });

  // Reschedule resets scheduleApproved=false — admin must re-approve before marking visited/no-show
  assert.equal(availability.canApproveSchedule, true);
  assert.equal(availability.canRejectSchedule, true);
  assert.equal(availability.canMarkVisited, false);
  assert.equal(availability.canMarkNoShow, false);
  assert.equal(availability.canReschedule, true);
  assert.equal(availability.canCancelVisit, true);
});

test("no-show visits can be rescheduled but not marked visited normally", () => {
  const availability = getVisitManagementAvailability({
    visitStatusKey: "no_show",
    hasVisitSchedule: true,
  });

  assert.equal(availability.canApproveSchedule, false);
  assert.equal(availability.canRejectSchedule, false);
  assert.equal(availability.canMarkVisited, false);
  assert.equal(availability.canMarkNoShow, false);
  assert.equal(availability.canReschedule, true);
  assert.equal(availability.canCancelVisit, false);
});

test("cancelled visits can only be rescheduled or allowed without visit", () => {
  const availability = getVisitManagementAvailability({
    visitStatusKey: "visit_cancelled",
    hasVisitSchedule: false,
  });

  assert.equal(availability.canApproveSchedule, false);
  assert.equal(availability.canRejectSchedule, false);
  assert.equal(availability.canMarkVisited, false);
  assert.equal(availability.canMarkNoShow, false);
  assert.equal(availability.canReschedule, true);
  assert.equal(availability.canCancelVisit, false);
  assert.equal(availability.canAllowWithoutVisit, true);
});
