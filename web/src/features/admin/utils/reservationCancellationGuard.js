/**
 * Reservation Cancellation Guard Utilities
 *
 * Provides central helper functions to evaluate cancellation request states
 * and guard admin lifecycle actions (Move In, Reschedule) against pending cancellations.
 */

/**
 * Checks if a reservation has an unresolved cancellation request pending review.
 *
 * @param {Object|null|undefined} reservation - The reservation object.
 * @returns {boolean} True if cancellation is requested and status is pending.
 */
export function isCancellationPending(reservation) {
  return Boolean(
    reservation?.cancellationRequested &&
    reservation?.cancellationStatus === "pending"
  );
}

/**
 * Evaluates the Move-In action guard for a reservation.
 *
 * Prioritizes pending cancellation over payment settlement blockers to ensure
 * admins resolve cancellations before attempting occupancy actions.
 *
 * @param {Object|null|undefined} reservation - The reservation object.
 * @param {Object} [options]
 * @param {boolean} [options.isMoveInPaymentSettled=false] - Whether 1DP+1Adv is settled.
 * @returns {Object} Guard status containing lock states, tooltips, and alerts.
 */
export function getMoveInActionGuard(reservation, { isMoveInPaymentSettled = false } = {}) {
  const cancellationPending = isCancellationPending(reservation);

  if (cancellationPending) {
    return {
      canMoveIn: false,
      cancellationPending: true,
      reason: "cancellation_pending",
      tooltip: "Move-in locked: A cancellation request is pending admin review. Approve or reject the request first.",
      alertMessage: "A tenant cancellation request is pending review. Review and resolve (Approve or Reject) the cancellation request above before moving in the tenant.",
      warningNotification: "Cannot move in tenant: A cancellation request is pending review. Please approve or reject the request first.",
    };
  }

  if (!isMoveInPaymentSettled) {
    return {
      canMoveIn: false,
      cancellationPending: false,
      reason: "payment_unsettled",
      tooltip: "Move-in locked: 1-Month Advance Rent and Security Deposit (1DP + 1Adv) must be settled first.",
      alertMessage: "1-Month Advance & Deposit (1DP + 1Adv) settlement is pending.",
      warningNotification: null,
    };
  }

  return {
    canMoveIn: true,
    cancellationPending: false,
    reason: null,
    tooltip: "Record tenant move-in and the initial meter reading",
    alertMessage: null,
    warningNotification: null,
  };
}

/**
 * Evaluates the Reschedule Move-In action guard for a reservation.
 *
 * @param {Object|null|undefined} reservation - The reservation object.
 * @returns {Object} Guard status for rescheduling actions.
 */
export function getRescheduleActionGuard(reservation) {
  const cancellationPending = isCancellationPending(reservation);

  if (cancellationPending) {
    return {
      canReschedule: false,
      cancellationPending: true,
      tooltip: "Reschedule locked: A cancellation request is pending admin review.",
      warningNotification: "Cannot reschedule move-in while a cancellation request is pending review.",
    };
  }

  return {
    canReschedule: true,
    cancellationPending: false,
    tooltip: undefined,
    warningNotification: null,
  };
}
