import test from "node:test";
import assert from "node:assert/strict";

import {
  SAVE_VIEWING_PREFERENCE_LABEL,
  canFreelyEditViewingPreference,
  getVisitScheduleSubmitLabel,
  getVisitSummaryUiState,
} from "./reservationVisitUiState.js";

const physicalReservation = (visitStatus) => ({
  status: "visit_pending",
  viewingPreference: "physical_visit",
  visitStatus,
  visitDate: "2026-05-20T00:00:00.000Z",
  visitTime: "09:00 AM",
});

test("first-time viewing preference submit button uses the submit label", () => {
  assert.equal(
    getVisitScheduleSubmitLabel("physical_visit"),
    SAVE_VIEWING_PREFERENCE_LABEL,
  );
});

test("remote and urgent first-time preference labels use submit viewing preference", () => {
  for (const selectedVisit of ["remote_2d_viewing", "urgent_move_in_review"]) {
    assert.equal(
      getVisitScheduleSubmitLabel(selectedVisit),
      SAVE_VIEWING_PREFERENCE_LABEL,
    );
  }
});

test("confirmed physical visit schedule hides free edit actions and locks application", () => {
  const ui = getVisitSummaryUiState({
    selectedVisit: "physical_visit",
    reservation: physicalReservation("physical_visit_scheduled"),
  });

  assert.equal(ui.canProceedToApplication, false);
  assert.equal(ui.applicationCtaLabel, "Application Locked");
  assert.equal(ui.showBack, false);
  assert.equal(ui.showChangeViewingPreference, false);
  assert.equal(ui.showReturnToDashboard, true);
  assert.match(ui.lockedMessage, /admin marks your physical visit as completed/i);
});

test("confirmed physical visit schedules ignore free edit mode", () => {
  assert.equal(
    canFreelyEditViewingPreference({
      selectedVisit: "physical_visit",
      hasSavedPhysicalVisit: true,
    }),
    false,
  );
  assert.equal(
    canFreelyEditViewingPreference({
      selectedVisit: "physical_visit",
      hasSavedPhysicalVisit: false,
    }),
    true,
  );
  assert.equal(
    canFreelyEditViewingPreference({
      selectedVisit: "remote_2d_viewing",
      hasSavedPhysicalVisit: true,
    }),
    true,
  );
});

test("no-show and rescheduled physical visits keep application locked", () => {
  for (const visitStatus of ["no_show", "rescheduled"]) {
    const ui = getVisitSummaryUiState({
      selectedVisit: "physical_visit",
      reservation: physicalReservation(visitStatus),
    });

    assert.equal(ui.canProceedToApplication, false);
    assert.equal(ui.applicationCtaLabel, "Application Locked");
    assert.equal(ui.showBack, false);
    assert.equal(ui.showChangeViewingPreference, false);
  }
});

test("completed or waived physical visits enable application without reopening old stages", () => {
  for (const visitStatus of ["visit_completed", "allowed_without_visit"]) {
    const ui = getVisitSummaryUiState({
      selectedVisit: "physical_visit",
      reservation: physicalReservation(visitStatus),
    });

    assert.equal(ui.canProceedToApplication, true);
    assert.equal(ui.applicationCtaLabel, "Proceed to Application");
    assert.equal(ui.showBack, false);
    assert.equal(ui.showChangeViewingPreference, false);
  }
});

test("remote and urgent summaries preserve existing proceed and edit behavior", () => {
  for (const selectedVisit of ["remote_2d_viewing", "urgent_move_in_review"]) {
    const ui = getVisitSummaryUiState({
      selectedVisit,
      reservation: { viewingPreference: selectedVisit },
    });

    assert.equal(ui.canProceedToApplication, true);
    assert.equal(ui.showBack, true);
    assert.equal(ui.showChangeViewingPreference, true);
    assert.equal(ui.applicationCtaLabel, "Proceed to Application");
  }
});

test("locked remote and urgent summaries hide editable actions", () => {
  for (const selectedVisit of ["remote_2d_viewing", "urgent_move_in_review"]) {
    const ui = getVisitSummaryUiState({
      selectedVisit,
      reservation: { viewingPreference: selectedVisit },
      viewingPreferenceLocked: true,
    });

    assert.equal(ui.canProceedToApplication, false);
    assert.equal(ui.showBack, false);
    assert.equal(ui.showChangeViewingPreference, false);
    assert.equal(ui.showReturnToDashboard, true);
    assert.equal(ui.applicationCtaLabel, "View Reservation Status");
    assert.match(ui.lockedMessage, /already submitted and locked/i);
  }
});
