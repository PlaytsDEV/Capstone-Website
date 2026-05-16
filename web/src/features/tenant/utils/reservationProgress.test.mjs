import test from "node:test";
import assert from "node:assert/strict";

import {
  getNextAction,
  getReservationProgress,
} from "./reservationProgress.js";

const baseReservation = {
  _id: "reservation-1",
  roomId: { name: "Room 101", branch: "gil-puyat" },
  roomConfirmed: true,
  agreedToPrivacy: true,
  viewingPreference: "remote_2d_viewing",
  remoteViewingAcknowledged: true,
  firstName: "Tala",
  lastName: "Applicant",
  applicationSubmittedAt: "2026-05-01T00:00:00.000Z",
  reservationFeeAmount: 2000,
};

test("pending-review reservations are not treated as paid or secured", () => {
  const reservation = {
    ...baseReservation,
    status: "pending_application_review",
    paymentStatus: "paid",
    paymongoSessionId: "cs_test_started_early",
  };

  const progress = getReservationProgress(reservation);
  const nextAction = getNextAction(reservation, progress);

  assert.equal(progress.currentStep, "application_submitted");
  assert.equal(progress.steps.find((step) => step.step === "reserved").status, "locked");
  assert.equal(nextAction.title, "Application Under Review");
  assert.equal(nextAction.step, undefined);
});

test("approved applications point applicants to payment", () => {
  const reservation = {
    ...baseReservation,
    status: "approved_for_payment",
    paymentStatus: "pending",
  };

  const progress = getReservationProgress(reservation);
  const nextAction = getNextAction(reservation, progress);

  assert.equal(progress.currentStep, "application_submitted");
  assert.equal(progress.steps.find((step) => step.step === "payment_submitted").status, "current");
  assert.equal(nextAction.title, "Submit Your Payment");
  assert.equal(nextAction.step, 4);
});

test("revision requests route applicants back to the application", () => {
  const reservation = {
    ...baseReservation,
    status: "needs_revision",
    applicationReviewReason: "Please upload a clearer ID.",
  };

  const progress = getReservationProgress(reservation);
  const applicationStep = progress.steps.find(
    (step) => step.step === "application_submitted",
  );
  const nextAction = getNextAction(reservation, progress);

  assert.equal(applicationStep.editable, true);
  assert.equal(nextAction.title, "Application Needs Revision");
  assert.equal(nextAction.step, 3);
});

test("physical visit saved keeps application disabled after refresh", () => {
  const reservation = {
    _id: "reservation-physical",
    roomId: { name: "Room 102", branch: "gil-puyat" },
    roomConfirmed: true,
    agreedToPrivacy: true,
    status: "visit_pending",
    viewingPreference: "physical_visit",
    visitStatus: "physical_visit_scheduled",
    visitDate: "2026-05-20T00:00:00.000Z",
    visitTime: "09:00 AM",
  };

  const progress = getReservationProgress(reservation);
  const nextAction = getNextAction(reservation, progress);

  assert.equal(progress.currentStep, "visit_scheduled");
  assert.equal(nextAction.step, 2);
  assert.equal(nextAction.title, "Physical Visit Scheduled");
});

test("physical visit no-show and reschedule keep application disabled", () => {
  for (const [visitStatus, expectedTitle] of [
    ["no_show", "Visit Marked as No-Show"],
    ["rescheduled", "Visit Rescheduled"],
  ]) {
    const reservation = {
      _id: `reservation-${visitStatus}`,
      roomId: { name: "Room 102", branch: "gil-puyat" },
      roomConfirmed: true,
      agreedToPrivacy: true,
      status: "visit_pending",
      viewingPreference: "physical_visit",
      visitStatus,
      visitDate: "2026-05-20T00:00:00.000Z",
      visitTime: "09:00 AM",
    };

    const progress = getReservationProgress(reservation);
    const nextAction = getNextAction(reservation, progress);

    assert.equal(progress.currentStep, "visit_scheduled");
    assert.equal(nextAction.step, 2);
    assert.equal(nextAction.title, expectedTitle);
  }
});

test("physical visit completed or waived enables application after refresh", () => {
  for (const visitStatus of ["visit_completed", "allowed_without_visit"]) {
    const reservation = {
      _id: `reservation-${visitStatus}`,
      roomId: { name: "Room 102", branch: "gil-puyat" },
      roomConfirmed: true,
      agreedToPrivacy: true,
      status: "visit_approved",
      viewingPreference: "physical_visit",
      visitStatus,
      visitDate: "2026-05-20T00:00:00.000Z",
      visitTime: "09:00 AM",
    };

    const progress = getReservationProgress(reservation);
    const nextAction = getNextAction(reservation, progress);

    assert.equal(progress.currentStep, "visit_completed");
    assert.equal(nextAction.step, 3);
    assert.equal(nextAction.title, "Submit Your Application");
  }
});

test("remote and urgent preferences remain application-allowed after save", () => {
  for (const viewingPreference of ["remote_2d_viewing", "urgent_move_in_review"]) {
    const reservation = {
      _id: `reservation-${viewingPreference}`,
      roomId: { name: "Room 102", branch: "gil-puyat" },
      roomConfirmed: true,
      agreedToPrivacy: true,
      status: "viewing_preference_selected",
      viewingPreference,
      remoteViewingAcknowledged: viewingPreference === "remote_2d_viewing",
      isUrgentMoveIn: viewingPreference === "urgent_move_in_review",
    };

    const progress = getReservationProgress(reservation);
    const nextAction = getNextAction(reservation, progress);

    assert.equal(progress.currentStep, "visit_completed");
    assert.equal(nextAction.step, 3);
    assert.equal(nextAction.title, "Submit Your Application");
  }
});
