import test from "node:test";
import assert from "node:assert/strict";
import {
  isCancellationPending,
  getMoveInActionGuard,
  getRescheduleActionGuard,
} from "./reservationCancellationGuard.js";

test("isCancellationPending returns true when cancellationRequested is true and cancellationStatus is pending", () => {
  const reservation = {
    cancellationRequested: true,
    cancellationStatus: "pending",
  };
  assert.equal(isCancellationPending(reservation), true);
});

test("isCancellationPending returns false when cancellationRequested is false or undefined", () => {
  assert.equal(isCancellationPending(undefined), false);
  assert.equal(isCancellationPending(null), false);
  assert.equal(isCancellationPending({}), false);
  assert.equal(
    isCancellationPending({
      cancellationRequested: false,
      cancellationStatus: "pending",
    }),
    false,
  );
});

test("isCancellationPending returns false when cancellationStatus is approved, rejected, or completed", () => {
  assert.equal(
    isCancellationPending({
      cancellationRequested: true,
      cancellationStatus: "approved",
    }),
    false,
  );
  assert.equal(
    isCancellationPending({
      cancellationRequested: true,
      cancellationStatus: "rejected",
    }),
    false,
  );
  assert.equal(
    isCancellationPending({
      cancellationRequested: false,
      cancellationStatus: "rejected",
    }),
    false,
  );
});

test("getMoveInActionGuard locks Move-In with cancellation warning when cancellation is pending (even if payment is settled)", () => {
  const reservation = {
    cancellationRequested: true,
    cancellationStatus: "pending",
  };
  const guard = getMoveInActionGuard(reservation, { isMoveInPaymentSettled: true });

  assert.equal(guard.canMoveIn, false);
  assert.equal(guard.cancellationPending, true);
  assert.equal(guard.reason, "cancellation_pending");
  assert.equal(
    guard.tooltip,
    "Move-in locked: A cancellation request is pending admin review. Approve or reject the request first.",
  );
  assert.match(guard.alertMessage, /tenant cancellation request is pending review/i);
  assert.match(guard.warningNotification, /Cannot move in tenant: A cancellation request is pending review/i);
});

test("getMoveInActionGuard locks Move-In with payment notice when payment is unsettled and no cancellation is pending", () => {
  const reservation = {
    cancellationRequested: false,
    cancellationStatus: null,
  };
  const guard = getMoveInActionGuard(reservation, { isMoveInPaymentSettled: false });

  assert.equal(guard.canMoveIn, false);
  assert.equal(guard.cancellationPending, false);
  assert.equal(guard.reason, "payment_unsettled");
  assert.equal(
    guard.tooltip,
    "Move-in locked: 1-Month Advance Rent and Security Deposit (1DP + 1Adv) must be settled first.",
  );
  assert.match(guard.alertMessage, /1-Month Advance & Deposit/i);
  assert.equal(guard.warningNotification, null);
});

test("getMoveInActionGuard allows Move-In when payment is settled and no cancellation is pending", () => {
  const reservation = {
    cancellationRequested: false,
    cancellationStatus: null,
  };
  const guard = getMoveInActionGuard(reservation, { isMoveInPaymentSettled: true });

  assert.equal(guard.canMoveIn, true);
  assert.equal(guard.cancellationPending, false);
  assert.equal(guard.reason, null);
  assert.equal(guard.tooltip, "Record tenant move-in and the initial meter reading");
  assert.equal(guard.alertMessage, null);
  assert.equal(guard.warningNotification, null);
});

test("getRescheduleActionGuard locks reschedule when cancellation is pending", () => {
  const reservation = {
    cancellationRequested: true,
    cancellationStatus: "pending",
  };
  const guard = getRescheduleActionGuard(reservation);

  assert.equal(guard.canReschedule, false);
  assert.equal(guard.cancellationPending, true);
  assert.equal(guard.tooltip, "Reschedule locked: A cancellation request is pending admin review.");
  assert.equal(
    guard.warningNotification,
    "Cannot reschedule move-in while a cancellation request is pending review.",
  );
});

test("getRescheduleActionGuard unlocks reschedule when no cancellation is pending", () => {
  const reservation = {
    cancellationRequested: false,
    cancellationStatus: null,
  };
  const guard = getRescheduleActionGuard(reservation);

  assert.equal(guard.canReschedule, true);
  assert.equal(guard.cancellationPending, false);
  assert.equal(guard.tooltip, undefined);
  assert.equal(guard.warningNotification, null);
});
