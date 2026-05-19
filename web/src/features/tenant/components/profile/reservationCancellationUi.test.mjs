import test from "node:test";
import assert from "node:assert/strict";

import {
  getReservationCancellationUiState,
  hasPaidReservationFee,
} from "./reservationCancellationUi.js";

test("paid reserved reservation can request cancellation", () => {
  const reservation = {
    status: "reserved",
    paymentStatus: "paid",
    paymentDate: "2026-05-17T00:00:00.000Z",
  };

  assert.equal(hasPaidReservationFee(reservation), true);
  assert.deepEqual(getReservationCancellationUiState(reservation), {
    visible: true,
    canRequest: true,
    isPending: false,
  });
});

test("pending cancellation request shows pending state instead of request action", () => {
  const reservation = {
    status: "reserved",
    paymentStatus: "paid",
    cancellationRequested: true,
    cancellationStatus: "pending",
  };

  assert.deepEqual(getReservationCancellationUiState(reservation), {
    visible: true,
    canRequest: false,
    isPending: true,
  });
});

test("moved-in and cancelled reservations hide applicant cancellation request action", () => {
  assert.equal(
    getReservationCancellationUiState({
      status: "moveIn",
      paymentStatus: "paid",
    }).visible,
    false,
  );
  assert.equal(
    getReservationCancellationUiState({
      status: "cancelled",
      paymentStatus: "paid",
    }).visible,
    false,
  );
});
