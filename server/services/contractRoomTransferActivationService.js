import mongoose from "mongoose";
import { Contract } from "../models/index.js";
import { transitionContract } from "./contractService.js";

const error = (message, code, statusCode = 400, details) =>
  Object.assign(new Error(message), { code, statusCode, details });

/**
 * ============================================================================
 * ROOM-TRANSFER CONTRACT CUTOVER (Contract-domain only)
 * ============================================================================
 * A room-transfer successor Contract (contractPurpose: "replacement") is
 * created FINAL-eligible-but-not-yet-effective by
 * createReplacementContractForTransfer (server/services/contractService.js)
 * — isCurrent: false, predecessor completely untouched. This is the one
 * function that flips both sides of the transition:
 *
 *   successor:   published -> active,   isCurrent: false -> true
 *   predecessor: active    -> replaced, isCurrent: true  -> false
 *
 * Unlike contractRenewalActivationService.activateDueRenewalContracts, this
 * is NOT date-gated and is NOT wired into a scheduler. Room transfer changes
 * where the tenant physically lives — activating the Contract independently
 * of the actual physical transfer would let Contract B say "Room B, ACTIVE"
 * while Stay/Room/Bed state still says "Room A", which must never happen.
 * This function trusts its caller on timing entirely: it only enforces
 * legal/relationship invariants (finality, a valid predecessor, no
 * already-ambiguous state), never "is it time yet". The actual physical
 * room-transfer execution workflow is expected to call this as part of its
 * own successful completion in a later integration phase — deliberately not
 * wired here (Contract-only phase).
 *
 * Idempotent: already-active/current successor -> no-op success, no
 * re-transition, no duplicate predecessor mutation.
 * ============================================================================
 */
export async function activateRoomTransferSuccessor({ successorContractId, actorId }) {
  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const successor = await Contract.findById(successorContractId).session(session);
      if (!successor) {
        throw error("Room-transfer successor Contract not found.", "TRANSFER_SUCCESSOR_NOT_FOUND", 404);
      }
      if (successor.contractPurpose !== "replacement") {
        throw error(
          "Contract is not a room-transfer replacement successor.",
          "NOT_A_TRANSFER_SUCCESSOR",
          409,
        );
      }

      if (successor.status === "active" && successor.isCurrent === true) {
        result = { activated: false, alreadyActive: true, successor, predecessor: null };
        return;
      }

      if (successor.status !== "published" || !successor.finalDocument) {
        throw error(
          "Room-transfer successor Contract is not yet legally final — a wet-signed contract " +
          "(finalDocument) is required before it can become the tenant's active Contract.",
          "TRANSFER_SUCCESSOR_NOT_FINAL",
          422,
          { status: successor.status, hasFinalDocument: Boolean(successor.finalDocument) },
        );
      }

      if (!successor.replacesContractId) {
        throw error(
          "Room-transfer successor Contract has no predecessor relationship.",
          "TRANSFER_PREDECESSOR_REQUIRED",
          409,
        );
      }
      const predecessor = await Contract.findById(successor.replacesContractId).session(session);
      if (!predecessor || predecessor.status !== "active" || predecessor.isCurrent !== true) {
        throw error(
          "The predecessor Contract is not active/current — the relationship is ambiguous or " +
          "was already superseded by something else. Admin review required.",
          "TRANSFER_PREDECESSOR_NOT_ACTIVE",
          409,
          { predecessorId: String(successor.replacesContractId) },
        );
      }

      successor.isCurrent = true;
      await transitionContract(
        successor,
        "active",
        actorId,
        "Room transfer executed; successor Contract activated",
        session,
      );

      predecessor.supersededByContractId = successor._id;
      await transitionContract(
        predecessor,
        "replaced",
        actorId,
        `Superseded by room transfer successor Contract ${successor.contractNumber}`,
        session,
      );

      result = { activated: true, alreadyActive: false, successor, predecessor };
    });
    return result;
  } finally {
    await session.endSession();
  }
}
