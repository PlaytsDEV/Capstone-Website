import test from "node:test";
import assert from "node:assert/strict";

import {
  getReservationConfirmationState,
  hasReservationReceipt,
  hasValidReservationCode,
  isPaymentConfirmed,
} from "./reservationConfirmationState.js";

test("pending/finalizing reservations do not show paid or receipt content", () => {
  const state = getReservationConfirmationState({
    status: "payment_pending",
    paymentStatus: "pending",
    paymentMethod: "gcash",
    reservationCode: "",
  });

  assert.equal(state.state, "pending_finalization");
  assert.equal(state.title, "Reservation Submitted");
  assert.equal(state.showPaymentCard, false);
  assert.equal(state.showReceiptAction, false);
  assert.equal(state.showReservationCodeCard, false);
  assert.equal(state.showFinalizingCodeMessage, true);
});

test("reserved reservations without a valid code show neutral finalization copy", () => {
  const state = getReservationConfirmationState({
    status: "reserved",
    paymentStatus: "paid",
    paymentDate: "2026-05-17T00:00:00.000Z",
    reservationCode: "—",
  });

  assert.equal(state.state, "reserved_no_code");
  assert.equal(state.title, "Room Reserved");
  assert.equal(state.showReservationCodeCard, false);
  assert.equal(state.showFinalizingCodeMessage, true);
  assert.equal(state.showPaymentCard, true);
  assert.equal(state.showReceiptAction, true);
});

test("paid secured reservations show success copy and code", () => {
  const state = getReservationConfirmationState({
    status: "reserved",
    paymentStatus: "paid",
    paymentMethod: "gcash",
    paymentDate: "2026-05-17T00:00:00.000Z",
    reservationCode: "RES-123ABC",
  });

  assert.equal(state.state, "secured");
  assert.equal(state.title, "You're All Set");
  assert.equal(state.showPaymentCard, true);
  assert.equal(state.showReceiptAction, true);
  assert.equal(state.showReservationCodeCard, true);
});

test("payment and receipt helpers require confirmed payment evidence", () => {
  assert.equal(isPaymentConfirmed({ paymentStatus: "pending", paymentDate: "2026-05-17" }), false);
  assert.equal(isPaymentConfirmed({ paymentStatus: "paid" }), true);
  assert.equal(hasReservationReceipt({ paymentStatus: "paid", paymentDate: "2026-05-17" }), true);
  assert.equal(hasReservationReceipt({ paymentStatus: "pending", receiptSentAt: "2026-05-17" }), false);
});

test("blank and dash reservation codes are not treated as valid", () => {
  assert.equal(hasValidReservationCode(""), false);
  assert.equal(hasValidReservationCode("—"), false);
  assert.equal(hasValidReservationCode("N/A"), false);
  assert.equal(hasValidReservationCode("RES-ABC123"), true);
});
