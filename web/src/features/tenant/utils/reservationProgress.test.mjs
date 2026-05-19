import test from "node:test";
import assert from "node:assert/strict";

import {
  getNextAction,
  getReservationProgress,
} from "./reservationProgress.js";
import {
  canAccessTenantApplication,
  isTenantApplicationStageRequestBlocked,
} from "./physicalVisitFlow.js";

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

test("reserved applicant progress uses reserved applicant wording", () => {
  const reservation = {
    ...baseReservation,
    status: "reserved",
    paymentStatus: "paid",
    paymentDate: "2026-05-10T00:00:00.000Z",
  };

  const progress = getReservationProgress(reservation);
  const nextAction = getNextAction(reservation, progress);
  const reservedStep = progress.steps.find((step) => step.step === "reserved");

  assert.equal(progress.currentStep, "reserved");
  assert.equal(reservedStep.status, "completed");
  assert.equal(reservedStep.title, "6. Room Reserved");
  assert.equal(reservedStep.description, "Room reservation confirmed");
  assert.equal(nextAction.title, "Room Reserved");
  assert.equal(
    nextAction.description,
    "Your room reservation has been confirmed. Please wait for further instructions from the admin.",
  );
  assert.equal(nextAction.buttonText, "View Reservation Status");
});

test("moved-in reservations keep tenant-stage wording separate from reserved applicants", () => {
  const reservation = {
    ...baseReservation,
    status: "moveIn",
    paymentStatus: "paid",
  };

  const progress = getReservationProgress(reservation);
  const nextAction = getNextAction(reservation, progress);

  assert.equal(progress.currentStep, "reserved");
  assert.equal(nextAction.title, "Tenant Stay Active");
  assert.equal(nextAction.description, "Your tenant stay is active.");
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
    assert.equal(canAccessTenantApplication(reservation), true);
    assert.equal(isTenantApplicationStageRequestBlocked(3, reservation), false);
  }
});

test("stale schedule status with visitApproved still unlocks after refetch", () => {
  const reservation = {
    _id: "reservation-refetch-unlock",
    roomId: { name: "Room 102", branch: "gil-puyat" },
    roomConfirmed: true,
    agreedToPrivacy: true,
    status: "visit_approved",
    viewingPreference: "physical_visit",
    visitStatus: "schedule_approved",
    scheduleApproved: true,
    visitApproved: true,
    visitDate: "2026-05-20T00:00:00.000Z",
    visitTime: "09:00 AM",
  };

  const progress = getReservationProgress(reservation);
  const nextAction = getNextAction(reservation, progress);

  assert.equal(canAccessTenantApplication(reservation), true);
  assert.equal(isTenantApplicationStageRequestBlocked(3, reservation), false);
  assert.equal(progress.currentStep, "visit_completed");
  assert.equal(nextAction.step, 3);
  assert.equal(nextAction.title, "Submit Your Application");
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
    assert.equal(canAccessTenantApplication(reservation), true);
    assert.equal(isTenantApplicationStageRequestBlocked(3, reservation), false);
  }
});

test("rejected, cancelled, and expired reservations do not reopen application access", () => {
  for (const status of ["rejected", "cancelled", "expired"]) {
    const reservation = {
      ...baseReservation,
      _id: `reservation-${status}`,
      status,
      viewingPreference: "physical_visit",
      visitStatus: "visit_completed",
      visitApproved: true,
    };

    const progress = getReservationProgress(reservation);
    const nextAction = getNextAction(reservation, progress);

    assert.equal(canAccessTenantApplication(reservation), false);
    assert.equal(isTenantApplicationStageRequestBlocked(3, reservation), true);
    assert.notEqual(nextAction.step, 3);
  }
});
