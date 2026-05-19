import test from "node:test";
import assert from "node:assert/strict";

import { getReservationFlowStageState } from "./reservationFlowStageState.js";

const selectedRoomReservation = {
  _id: "reservation-room-only",
  status: "pending",
  roomId: { _id: "room-1", name: "Room 101" },
  roomConfirmed: false,
  viewingPreference: null,
  viewingType: "inperson",
  visitDate: null,
  visitTime: "",
};

test("step 1 selected room does not mark tenant application ready", () => {
  const applicationStage = getReservationFlowStageState({
    stageId: 3,
    currentStage: 1,
    reservation: selectedRoomReservation,
  });

  assert.equal(applicationStage.state, "locked");
  assert.equal(applicationStage.isReady, false);
  assert.equal(applicationStage.isComplete, false);
});

test("submitted physical viewing preference without admin clearance keeps application locked", () => {
  const reservation = {
    _id: "reservation-visit-pending",
    status: "visit_pending",
    roomConfirmed: true,
    viewingPreference: "physical_visit",
    visitStatus: "physical_visit_scheduled",
    visitDate: "2026-05-20T00:00:00.000Z",
    visitTime: "09:00 AM",
  };

  const viewingStage = getReservationFlowStageState({
    stageId: 2,
    currentStage: 2,
    reservation,
  });
  const applicationStage = getReservationFlowStageState({
    stageId: 3,
    currentStage: 2,
    reservation,
  });

  assert.equal(viewingStage.state, "active");
  assert.equal(applicationStage.state, "locked");
});

test("admin-cleared visit marks tenant application ready", () => {
  for (const visitStatus of ["visit_completed", "allowed_without_visit"]) {
    const reservation = {
      _id: `reservation-${visitStatus}`,
      status: "visit_approved",
      roomConfirmed: true,
      viewingPreference: "physical_visit",
      visitStatus,
      visitDate: "2026-05-20T00:00:00.000Z",
      visitTime: "09:00 AM",
    };

    const applicationStage = getReservationFlowStageState({
      stageId: 3,
      currentStage: 2,
      reservation,
    });

    assert.equal(applicationStage.state, "ready");
    assert.equal(applicationStage.isReady, true);
  }
});

test("closed reservations keep tenant application locked", () => {
  for (const status of ["rejected", "cancelled", "expired"]) {
    const applicationStage = getReservationFlowStageState({
      stageId: 3,
      currentStage: 1,
      reservation: {
        _id: `reservation-${status}`,
        status,
        roomConfirmed: true,
        viewingPreference: "physical_visit",
        visitStatus: "visit_completed",
        visitApproved: true,
      },
    });

    assert.equal(applicationStage.state, "locked");
  }
});

test("payment remains locked until application and documents are approved", () => {
  const underReviewPaymentStage = getReservationFlowStageState({
    stageId: 4,
    currentStage: 3,
    reservation: {
      _id: "reservation-under-review",
      status: "pending_application_review",
      applicationSubmittedAt: "2026-05-01T00:00:00.000Z",
      viewingPreference: "physical_visit",
      visitStatus: "visit_completed",
    },
  });
  const approvedPaymentStage = getReservationFlowStageState({
    stageId: 4,
    currentStage: 3,
    reservation: {
      _id: "reservation-approved",
      status: "approved_for_payment",
      applicationSubmittedAt: "2026-05-01T00:00:00.000Z",
      viewingPreference: "physical_visit",
      visitStatus: "visit_completed",
    },
  });

  assert.equal(underReviewPaymentStage.state, "locked");
  assert.equal(approvedPaymentStage.state, "ready");
});
