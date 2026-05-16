import test from "node:test";
import assert from "node:assert/strict";

import {
  ROOM_SELECTION_LOCKED_MESSAGE,
  canApplicantReselectRoom,
  getReservationStageAccess,
  isApplicantRoomSelectionLocked,
} from "./reservationRoomLock.js";

const selectedRoomReservation = {
  _id: "reservation-locked",
  roomConfirmed: true,
  roomId: {
    name: "GP - Room 305",
    branch: "gil-puyat",
    type: "quadruple",
    floor: 3,
    capacity: 4,
    price: 6300,
  },
  selectedBed: { id: "bed-1", position: "upper" },
  reservationFeeAmount: 2000,
};

test("active reservation cannot edit or change the selected room", () => {
  for (const status of [
    "viewing_preference_selected",
    "visit_pending",
    "visit_approved",
    "pending_application_review",
    "approved_for_payment",
    "payment_pending",
    "reserved",
  ]) {
    const reservation = { ...selectedRoomReservation, status };

    assert.equal(canApplicantReselectRoom(reservation), false);
    assert.equal(isApplicantRoomSelectionLocked(reservation), true);
  }
});

test("confirmed pending reservation locks room selection", () => {
  const reservation = {
    ...selectedRoomReservation,
    status: "pending",
    roomConfirmed: true,
  };

  assert.equal(canApplicantReselectRoom(reservation), false);
  assert.equal(isApplicantRoomSelectionLocked(reservation), true);
});

test("draft, rejected, cancelled, expired, and admin-approved reservations can reselect", () => {
  assert.equal(
    canApplicantReselectRoom({
      ...selectedRoomReservation,
      status: "pending",
      roomConfirmed: false,
    }),
    true,
  );

  for (const status of ["rejected", "cancelled", "expired"]) {
    assert.equal(
      canApplicantReselectRoom({
        ...selectedRoomReservation,
        status,
        roomConfirmed: true,
      }),
      true,
    );
  }

  assert.equal(
    canApplicantReselectRoom({
      ...selectedRoomReservation,
      status: "visit_pending",
      roomConfirmed: true,
      roomReselectionStatus: "approved",
    }),
    true,
  );
});

test("direct stage access stays read-only and hides room editing actions", () => {
  const access = getReservationStageAccess(
    {
      ...selectedRoomReservation,
      status: "pending_application_review",
    },
    1,
  );

  assert.equal(access.readOnly, true);
  assert.equal(access.canChangeRoom, false);
  assert.equal(access.canConfirmRoom, false);
  assert.equal(access.lockedMessage, ROOM_SELECTION_LOCKED_MESSAGE);
});

test("locked room summary remains visible in read-only mode", () => {
  const access = getReservationStageAccess(
    {
      ...selectedRoomReservation,
      status: "visit_pending",
    },
    1,
  );

  assert.equal(access.readOnly, true);
  assert.equal(access.roomSummaryVisible, true);
});
