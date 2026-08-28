import test from "node:test";
import assert from "node:assert/strict";

import {
  canFreelyEditViewingPreference,
  formatVisitSlotLabel,
  getVisitScheduleSubmitLabel,
  getVisitSummaryUiState,
  getVisitConfirmButtonLabel,
  getViewingNextStepGuidance,
  getViewingConfirmationSubtitle,
} from "./reservationVisitUiState.js";

const physicalReservation = (visitStatus) => ({
  status: "visit_pending",
  viewingPreference: "physical_visit",
  visitStatus,
  visitDate: "2026-05-20T00:00:00.000Z",
  visitTime: "09:00 AM",
});

test("first-time physical visit submit button uses the specific request label", () => {
  assert.equal(
    getVisitScheduleSubmitLabel("physical_visit"),
    "Submit",
  );
});

test("remote and urgent first-time preference labels use specific request labels", () => {
  assert.equal(
    getVisitScheduleSubmitLabel("remote_2d_viewing"),
    "Submit Remote Viewing Request",
  );
  assert.equal(
    getVisitScheduleSubmitLabel("urgent_move_in_review"),
    "Submit Priority Review Request",
  );
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
  assert.match(ui.lockedMessage, /physical visit is completed/i);
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

test("formatVisitSlotLabel formats various time representations properly", () => {
  assert.equal(formatVisitSlotLabel(""), "Not scheduled");
  assert.equal(formatVisitSlotLabel(null), "Not scheduled");
  assert.equal(formatVisitSlotLabel(undefined), "Not scheduled");
  assert.equal(formatVisitSlotLabel("09:00 AM"), "09:00 AM");
  assert.equal(formatVisitSlotLabel("9:00 am"), "09:00 AM");
  assert.equal(formatVisitSlotLabel("13:00"), "01:00 PM");
  assert.equal(formatVisitSlotLabel("08:30"), "08:30 AM");
  assert.equal(formatVisitSlotLabel("00:00"), "12:00 AM");
  assert.equal(formatVisitSlotLabel({ label: "10:00 AM" }), "10:00 AM");
  assert.equal(formatVisitSlotLabel({ slot: "02:00 PM" }), "02:00 PM");
  assert.equal(formatVisitSlotLabel(null, "No visit selected"), "No visit selected");
});

test("getVisitConfirmButtonLabel returns contextual action labels", () => {
  assert.equal(getVisitConfirmButtonLabel("remote_2d_viewing"), "Confirm Remote Viewing");
  assert.equal(getVisitConfirmButtonLabel("physical_visit"), "Confirm Visit Schedule");
  assert.equal(getVisitConfirmButtonLabel("urgent_move_in_review"), "Confirm Priority Request");
  assert.equal(getVisitConfirmButtonLabel("remote_2d_viewing", true), "Submitting...");
  assert.equal(getVisitConfirmButtonLabel("physical_visit", true), "Submitting...");
});

test("getViewingNextStepGuidance returns accurate next-step instructions", () => {
  assert.match(
    getViewingNextStepGuidance("remote_2d_viewing"),
    /No in-person visit required.*tenant application/i
  );
  assert.match(
    getViewingNextStepGuidance("physical_visit"),
    /arrive at the branch on time.*unlocks after your visit is completed/i
  );
  assert.match(
    getViewingNextStepGuidance("urgent_move_in_review"),
    /priority viewing request.*admin queue.*complete your tenant application/i
  );
});

test("getViewingConfirmationSubtitle returns tailored subtitle copy", () => {
  assert.equal(
    getViewingConfirmationSubtitle("remote_2d_viewing"),
    "Please confirm your remote viewing preference."
  );
  assert.equal(
    getViewingConfirmationSubtitle("physical_visit"),
    "Please review your visit schedule before confirming."
  );
  assert.equal(
    getViewingConfirmationSubtitle("urgent_move_in_review"),
    "Please confirm your priority review request."
  );
});

