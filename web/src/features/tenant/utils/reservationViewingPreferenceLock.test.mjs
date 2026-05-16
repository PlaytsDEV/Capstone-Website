import test from "node:test";
import assert from "node:assert/strict";

import {
  VIEWING_PREFERENCE_LOCKED_MESSAGE,
  canApplicantSubmitViewingPreference,
  getViewingPreferenceStepAccess,
  isViewingPreferenceChangeAllowed,
  isViewingPreferenceSubmitted,
} from "./reservationViewingPreferenceLock.js";

const baseReservation = {
  _id: "reservation-1",
  status: "viewing_preference_selected",
  roomConfirmed: true,
};

test("applicant can submit a viewing preference once before one is saved", () => {
  const reservation = { ...baseReservation, status: "pending" };

  assert.equal(isViewingPreferenceSubmitted(reservation), false);
  assert.equal(
    canApplicantSubmitViewingPreference(reservation, "physical_visit"),
    true,
  );
  assert.equal(
    getViewingPreferenceStepAccess(reservation, "physical_visit").canSubmit,
    true,
  );
});

test("saved viewing preference becomes read-only while active", () => {
  const reservation = {
    ...baseReservation,
    viewingPreference: "remote_2d_viewing",
    remoteViewingAcknowledged: true,
  };
  const access = getViewingPreferenceStepAccess(reservation, "remote_2d_viewing");

  assert.equal(access.submitted, true);
  assert.equal(access.readOnly, true);
  assert.equal(access.canSubmit, false);
  assert.equal(access.message, VIEWING_PREFERENCE_LOCKED_MESSAGE);
});

test("physical visit cannot switch to remote or urgent after saving", () => {
  const reservation = {
    ...baseReservation,
    status: "visit_pending",
    viewingPreference: "physical_visit",
    visitDate: "2026-05-20",
    visitTime: "09:00 AM",
    visitCode: "VIS-ABC123",
  };

  assert.equal(
    canApplicantSubmitViewingPreference(reservation, "remote_2d_viewing"),
    false,
  );
  assert.equal(
    canApplicantSubmitViewingPreference(reservation, "urgent_move_in_review"),
    false,
  );
});

test("remote viewing cannot switch to physical or urgent after saving", () => {
  const reservation = {
    ...baseReservation,
    viewingPreference: "remote_2d_viewing",
    remoteViewingAcknowledged: true,
  };

  assert.equal(
    canApplicantSubmitViewingPreference(reservation, "physical_visit"),
    false,
  );
  assert.equal(
    canApplicantSubmitViewingPreference(reservation, "urgent_move_in_review"),
    false,
  );
});

test("saved remote viewing details infer a locked remote preference", () => {
  const access = getViewingPreferenceStepAccess({
    ...baseReservation,
    remoteViewingAcknowledged: true,
    remoteViewingQuestions: "Can admin confirm the desk size?",
  });

  assert.equal(access.submittedPreference, "remote_2d_viewing");
  assert.equal(access.readOnly, true);
});

test("urgent review cannot switch to physical or remote after saving", () => {
  const reservation = {
    ...baseReservation,
    viewingPreference: "urgent_move_in_review",
    isUrgentMoveIn: true,
  };

  assert.equal(
    canApplicantSubmitViewingPreference(reservation, "physical_visit"),
    false,
  );
  assert.equal(
    canApplicantSubmitViewingPreference(reservation, "remote_2d_viewing"),
    false,
  );
});

test("admin action markers lock physical visit preference switching", () => {
  for (const marker of [
    { visitScheduledAt: "2026-05-17T08:00:00.000Z" },
    { scheduleApproved: true },
    { scheduleApprovedAt: "2026-05-17T08:00:00.000Z" },
    { visitCode: "VIS-ABC123" },
    { status: "visit_approved" },
  ]) {
    const reservation = {
      ...baseReservation,
      status: "visit_pending",
      viewingPreference: "physical_visit",
      visitDate: "2026-05-20",
      visitTime: "09:00 AM",
      ...marker,
    };

    assert.equal(
      canApplicantSubmitViewingPreference(reservation, "remote_2d_viewing"),
      false,
    );
  }
});

test("rejected, cancelled, expired, and admin-reset preferences can be changed", () => {
  for (const status of ["rejected", "cancelled", "expired", "archived"]) {
    const reservation = {
      ...baseReservation,
      status,
      viewingPreference: "remote_2d_viewing",
      remoteViewingAcknowledged: true,
    };

    assert.equal(isViewingPreferenceChangeAllowed(reservation), true);
    assert.equal(
      canApplicantSubmitViewingPreference(reservation, "physical_visit"),
      true,
    );
  }

  assert.equal(
    canApplicantSubmitViewingPreference(
      {
        ...baseReservation,
        status: "visit_pending",
        viewingPreference: "remote_2d_viewing",
        remoteViewingAcknowledged: true,
        viewingPreferenceChangeStatus: "approved",
      },
      "physical_visit",
    ),
    true,
  );
});

test("direct step access stays read-only and does not reopen options", () => {
  const access = getViewingPreferenceStepAccess(
    {
      ...baseReservation,
      viewingPreference: "urgent_move_in_review",
      isUrgentMoveIn: true,
    },
    "physical_visit",
  );

  assert.equal(access.readOnly, true);
  assert.equal(access.lockOptions, true);
  assert.equal(access.canSubmit, false);
  assert.equal(access.statusCtaLabel, "View Reservation Status");
});

test("repeated submit is blocked unless rejected physical visit is rescheduled", () => {
  assert.equal(
    canApplicantSubmitViewingPreference(
      {
        ...baseReservation,
        viewingPreference: "remote_2d_viewing",
        remoteViewingAcknowledged: true,
      },
      "remote_2d_viewing",
    ),
    false,
  );

  assert.equal(
    canApplicantSubmitViewingPreference(
      {
        ...baseReservation,
        status: "visit_pending",
        viewingPreference: "physical_visit",
        visitDate: "2026-05-20",
        visitTime: "09:00 AM",
        scheduleRejected: true,
      },
      "physical_visit",
    ),
    true,
  );
});
