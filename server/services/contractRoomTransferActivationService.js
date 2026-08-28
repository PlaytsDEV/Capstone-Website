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
  const validPredecessorStatuses = ["active", "published", "expiring_soon"];
  if (!predecessor || !validPredecessorStatuses.includes(predecessor.status) || predecessor.isCurrent !== true) {
    throw error(
      "The predecessor Contract is not active/current — the relationship is ambiguous or " +
      "was already superseded by something else. Admin review required.",
      "TRANSFER_PREDECESSOR_NOT_ACTIVE",
      409,
      { predecessorId: String(successor.replacesContractId) },
    );
  }

  // Clear the predecessor from the partial unique stayId/isCurrent index
  // before making the successor current. Both writes use the same transaction,
  // so external readers still observe one atomic cutover while MongoDB never
  // has to accept two current Contracts for the stay inside the transaction.
  predecessor.supersededByContractId = successor._id;
  await transitionContract(
    predecessor,
    "replaced",
    actorId,
    `Superseded by room transfer successor Contract ${successor.contractNumber}`,
    session,
  );

  successor.isCurrent = true;
  await transitionContract(
    successor,
    "active",
    actorId,
    "Room transfer executed; successor Contract activated",
    session,
  );

  // A pending lease renewal chained off the predecessor we just replaced is
  // now meaningless — its frozen currentTerms snapshot still describes the
  // old room/bed/rate. Left alone it would either dangle forever (caught,
  // but not resolved, by the renewal cron's predecessor.status check) or,
  // in the unlikely case the predecessor's status was ever restored, could
  // still activate with stale data. Cancel it here, synchronously, in the
  // same transaction as the transfer itself.
  const danglingRenewal = await Contract.findOne({
    contractPurpose: "renewal",
    replacesContractId: predecessor._id,
    status: { $in: ["published", "renewal_pending"] },
  }).session(session);
  if (danglingRenewal) {
    await transitionContract(
      danglingRenewal,
      "cancelled",
      actorId,
      "predecessor_transferred",
      session,
    );
  }

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

/**
 * ============================================================================
 * ROOM-TRANSFER CONTRACT CUTOVER — DRAFT SUCCESSOR (Contract-domain only)
 * ============================================================================
 * The canonical one-step room transfer (transferStayWorkflow) generates the
 * replacement Contract as a tenant-visible Draft in the same transaction as
 * the physical move — exactly like a fresh move-in Contract, which is also a
 * Draft while the tenant already occupies the room. This activator makes
 * that Draft the tenant's current Contract WITHOUT requiring a wet-signed
 * finalDocument first:
 *
 *   successor:   generated (status unchanged), isCurrent false -> true,
 *                tenantVisible -> true
 *   predecessor: active/published/expiring_soon -> replaced,
 *                isCurrent true -> false, supersededByContractId set
 *
 * "active" still means "wet-signed final document exists" everywhere else —
 * this never sets the successor to "active". A later wet-signed upload chains
 * the Draft generated -> ... -> published -> active unchanged.
 *
 * Ordering: the predecessor is flipped to isCurrent:false FIRST (via
 * transitionContract -> "replaced", a terminal status), so when the
 * successor's isCurrent:true write lands the partial unique index
 * { stayId, isCurrent:true } (both Contracts share the tenant's one Stay)
 * only ever sees a single current Contract for the stay. Same session =
 * atomic to external readers.
 *
 * Idempotent: an already-current successor is a no-op success.
 * ============================================================================
 */
async function runRoomTransferDraftActivation({ successorContractId, actorId, session }) {
  const successor = await Contract.findById(successorContractId).session(session);
  if (!successor) {
    throw error("Room-transfer successor Contract not found.", "TRANSFER_SUCCESSOR_NOT_FOUND", 404);
  }
  if (successor.contractPurpose !== "replacement") {
    throw error("Contract is not a room-transfer replacement successor.", "NOT_A_TRANSFER_SUCCESSOR", 409);
  }

  if (successor.isCurrent === true) {
    return { activated: false, alreadyActive: true, successor, predecessor: null };
  }

  // A prepared Draft is the minimum: it must be at least "generated" so the
  // tenant has a reviewable document (and contractAcknowledgementService can
  // bind acknowledgement to its prepared version/hash). Pre-generation
  // drafts are a caller bug — transferStayWorkflow always generates first.
  const READY_DRAFT_STATUSES = new Set([
    "generated",
    "awaiting_signatures",
    "partially_signed",
    "signed",
    "awaiting_notarization",
    "notarized",
    "ready_for_publication",
    "published",
  ]);
  if (!READY_DRAFT_STATUSES.has(successor.status)) {
    throw error(
      "Room-transfer successor Contract has no prepared document yet — it cannot become the tenant's current Contract.",
      "TRANSFER_SUCCESSOR_NOT_PREPARED",
      409,
      { status: successor.status },
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
  const validPredecessorStatuses = ["active", "published", "expiring_soon"];
  if (!predecessor || !validPredecessorStatuses.includes(predecessor.status) || predecessor.isCurrent !== true) {
    throw error(
      "The predecessor Contract is not active/current — the relationship is ambiguous or " +
      "was already superseded by something else. Admin review required.",
      "TRANSFER_PREDECESSOR_NOT_ACTIVE",
      409,
      { predecessorId: String(successor.replacesContractId) },
    );
  }

  predecessor.supersededByContractId = successor._id;
  await transitionContract(
    predecessor,
    "replaced",
    actorId,
    `Superseded by room transfer successor Contract ${successor.contractNumber}`,
    session,
  );

  successor.isCurrent = true;
  successor.tenantVisible = true;
  successor.updatedBy = actorId;
  successor.statusHistory.push({
    status: successor.status,
    changedBy: actorId,
    reason: "Room transfer executed; successor Draft Contract is now the tenant's current Contract (wet-signing pending)",
  });
  await successor.save({ session });

  // Same rationale as runRoomTransferActivation: a pending renewal chained
  // off the predecessor we just replaced still carries the old room's frozen
  // terms — cancel it in this same transaction.
  const danglingRenewal = await Contract.findOne({
    contractPurpose: "renewal",
    replacesContractId: predecessor._id,
    status: { $in: ["published", "renewal_pending"] },
  }).session(session);
  if (danglingRenewal) {
    await transitionContract(
      danglingRenewal,
      "cancelled",
      actorId,
      "predecessor_transferred",
      session,
    );
  }

  return { activated: true, alreadyActive: false, successor, predecessor };
}

export async function activateRoomTransferSuccessorDraft({ successorContractId, actorId, session = null }) {
  if (session) {
    return runRoomTransferDraftActivation({ successorContractId, actorId, session });
  }

  const ownSession = await mongoose.startSession();
  try {
    let result;
    await ownSession.withTransaction(async () => {
      result = await runRoomTransferDraftActivation({ successorContractId, actorId, session: ownSession });
    });
    return result;
  } finally {
    await ownSession.endSession();
  }
}
