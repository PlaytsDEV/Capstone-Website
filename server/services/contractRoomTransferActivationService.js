import mongoose from "mongoose";
import { Contract } from "../models/index.js";
import { transitionContract, ABANDONED_TRANSFER_SUCCESSOR_STATUSES } from "./contractService.js";

const error = (message, code, statusCode = 400, details) =>
  Object.assign(new Error(message), { code, statusCode, details });

/**
 * Read-only resolution of "the" room-transfer successor Contract for a given
 * predecessor — shared by transferStayWorkflow's pre-mutation validation
 * (server/utils/tenantActionService.js) and createReplacementContractForTransfer's
 * creation-time idempotency guard (server/services/contractService.js), so
 * both agree on exactly what counts as an abandoned vs. live successor.
 * Never guesses: zero matches or more than one both throw rather than
 * picking one.
 */
export async function resolveRoomTransferSuccessor({ predecessorContractId, session = null }) {
  const successors = await Contract.find({
    replacesContractId: predecessorContractId,
    contractPurpose: "replacement",
    status: { $nin: [...ABANDONED_TRANSFER_SUCCESSOR_STATUSES] },
  }).session(session);

  if (successors.length > 1) {
    throw error(
      "Multiple room-transfer successor Contracts already reference this Contract — admin repair required.",
      "MULTIPLE_TRANSFER_SUCCESSORS",
      409,
      { predecessorId: String(predecessorContractId), successorIds: successors.map((c) => String(c._id)) },
    );
  }
  if (successors.length === 0) {
    throw error(
      "No prepared room-transfer replacement Contract was found for this tenancy. " +
      "Prepare and finalize a replacement Contract before executing the transfer.",
      "ROOM_TRANSFER_CONTRACT_NOT_PREPARED",
      409,
      { predecessorId: String(predecessorContractId) },
    );
  }
  return successors[0];
}

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
 * already-ambiguous state), never "is it time yet".
 *
 * transferStayWorkflow (server/utils/tenantActionService.js) is that caller:
 * it resolves and validates the successor BEFORE any physical mutation, then
 * calls this function with its own transaction session as the last step
 * before commit, so a Contract activation failure rolls back the physical
 * transfer too, and a physical mutation failure never reaches Contract
 * activation at all.
 *
 * Session behavior:
 *   session supplied  -> participates in the caller's transaction; never
 *                         starts, commits, or aborts its own session.
 *   session omitted   -> preserves the original standalone behavior (opens
 *                         and manages its own mongoose session/transaction).
 *
 * Idempotent: already-active/current successor -> no-op success, no
 * re-transition, no duplicate predecessor mutation.
 * ============================================================================
 */
async function runRoomTransferActivation({ successorContractId, actorId, session }) {
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
    return { activated: false, alreadyActive: true, successor, predecessor: null };
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

  return { activated: true, alreadyActive: false, successor, predecessor };
}

export async function activateRoomTransferSuccessor({ successorContractId, actorId, session = null }) {
  if (session) {
    return runRoomTransferActivation({ successorContractId, actorId, session });
  }

  const ownSession = await mongoose.startSession();
  try {
    let result;
    await ownSession.withTransaction(async () => {
      result = await runRoomTransferActivation({ successorContractId, actorId, session: ownSession });
    });
    return result;
  } finally {
    await ownSession.endSession();
  }
}
