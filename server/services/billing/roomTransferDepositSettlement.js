/**
 * ============================================================================
 * ROOM-TRANSFER SECURITY-DEPOSIT SETTLEMENT (pure calculation)
 * ============================================================================
 * A room transfer may change the REQUIRED security deposit (canonical rule:
 * 1x the destination room's approved monthly rate — the same figure
 * structuredInitialPaymentPolicy / depositUtils use for move-in).
 *
 * This computes the deposit adjustment as its OWN component, never netted
 * with rent:
 *
 *   depositDelta = destinationRequiredDeposit - depositCurrentlyHeld
 *
 *   depositDelta > 0  -> additionalDepositDue  = depositDelta   (billed;
 *                        held cash rises only when that component is PAID)
 *   depositDelta = 0  -> no adjustment
 *   depositDelta < 0  -> excessDepositHeld     = -depositDelta   (NOT
 *                        refunded / NOT converted to rent credit here — it
 *                        stays refundable held cash for move-out clearance;
 *                        depositHeldAfterTransfer stays at the higher held
 *                        amount)
 *
 * Pure function — no DB, no mutation. `roundMoney` for centavo safety.
 * ============================================================================
 */
import { roundMoney } from "./billingPolicy.js";

/**
 * @param {Object} params
 * @param {number} params.depositCurrentlyHeld - reservation.securityDepositHeld (actual cash held)
 * @param {number} params.destinationRequiredDeposit - canonical destination deposit (= successor Contract approved monthly rate)
 * @returns {{
 *   depositPreviouslyHeld: number,
 *   destinationRequiredDeposit: number,
 *   depositDelta: number,
 *   additionalDepositDue: number,
 *   excessDepositHeld: number,
 *   depositHeldAfterTransferBeforePayment: number,
 * }}
 */
export function calculateRoomTransferDepositSettlement({
  depositCurrentlyHeld,
  destinationRequiredDeposit,
}) {
  const held = roundMoney(Math.max(0, Number(depositCurrentlyHeld) || 0));
  const required = roundMoney(Math.max(0, Number(destinationRequiredDeposit) || 0));
  const delta = roundMoney(required - held);

  const additionalDepositDue = delta > 0 ? delta : 0;
  const excessDepositHeld = delta < 0 ? roundMoney(-delta) : 0;

  return {
    depositPreviouslyHeld: held,
    destinationRequiredDeposit: required,
    depositDelta: delta,
    additionalDepositDue,
    excessDepositHeld,
    // Held cash does NOT change at transfer time: a shortfall is billed and
    // funded on payment; an excess simply remains held.
    depositHeldAfterTransferBeforePayment: held,
  };
}
