/**
 * ============================================================================
 * ONE-OFF REPAIR: stale published Contract on a moved-out tenant
 * ============================================================================
 *
 * Reservation: RES-S515DF (6a8ee3538ecb32f9f52663fc), status "moveOut",
 *   moveOutDate 2026-08-26
 * Stay: 6a8eed038ecb32f9f526a36e, status "completed", endReason "move_out"
 * Contract: LIL-GP-2026-00098 (6a8ee6668ecb32f9f5267adb), stuck at
 *   status "published", isCurrent: true
 * (tenant identity intentionally omitted — the record IDs above are
 *  sufficient to identify the target; the tenant is not PII-relevant to
 *  the repair.)
 *
 * Found by audit_moved_out_tenants_with_active_contract.mjs — this Contract
 * predates the P2 fix (moveOutStayWorkflow now transitions the Contract on
 * move-out via transitionContract); it was never touched when this tenant
 * actually moved out, so it never reached a terminal status.
 *
 * This script applies the exact same transition moveOutStayWorkflow now
 * applies automatically for a normal, full-term move-out (Stay -> "completed"):
 * Contract -> "expired", via the real transitionContract() service function
 * (respects CONTRACT_TRANSITIONS, appends a statusHistory entry, forces
 * isCurrent:false because "expired" is a terminal status) — not a raw field
 * edit.
 *
 * HARD-TARGETED to one Contract _id and one Reservation _id. It performs
 * exactly one Contract.save() (inside transitionContract) and touches no
 * other Contract / Reservation / Stay / Room / Bed / Bill / Payment /
 * document / acknowledgement record. It aborts unless every precondition
 * below still holds on the live record:
 *
 *   Contract._id                    === CONTRACT_ID
 *   Contract.contractNumber         === "LIL-GP-2026-00098"
 *   Contract.reservationId          === RESERVATION_ID
 *   Contract.status                 === "published"
 *   Contract.isCurrent              === true
 *   Contract.archivedAt             == null
 *   Contract.supersededByContractId == null
 *   Contract.duplicateOfContractId  == null
 *   Reservation.status              === "moveOut"
 *   a Stay for that Reservation with status "completed" exists
 *
 * If the Contract is already terminal (status "expired"/"terminated"/etc.
 * or isCurrent:false) the script reports "no action needed" and exits 0 —
 * it is safe to re-run (idempotent).
 *
 * Requires explicit --apply --confirm=REPAIR_STALE_CONTRACT. Dry-run by
 * default (prints what it would do, changes nothing).
 * ============================================================================
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Contract, Reservation, Stay } from "../models/index.js";
import { transitionContract } from "../services/contractService.js";

dotenv.config();

const CONTRACT_ID = "6a8ee6668ecb32f9f5267adb";
const RESERVATION_ID = "6a8ee3538ecb32f9f52663fc";
const CONTRACT_NUMBER = "LIL-GP-2026-00098";

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const CONFIRMED = args.includes("--confirm=REPAIR_STALE_CONTRACT");

if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");

const abort = (message) => {
  throw new Error(`Refusing to run: ${message}`);
};

await mongoose.connect(process.env.MONGODB_URI);
try {
  const contract = await Contract.findById(CONTRACT_ID);
  const reservation = await Reservation.findById(RESERVATION_ID).lean();

  if (!contract) abort(`Contract ${CONTRACT_ID} not found.`);
  if (!reservation) abort(`Reservation ${RESERVATION_ID} not found.`);

  // Identity — the record must be exactly the one this script documents.
  if (contract.contractNumber !== CONTRACT_NUMBER) {
    abort(`Contract number is "${contract.contractNumber}", expected "${CONTRACT_NUMBER}".`);
  }
  if (String(contract.reservationId) !== RESERVATION_ID) {
    abort("Contract does not reference the expected Reservation.");
  }
  if (String(contract.tenantId) !== String(reservation.userId)) {
    abort("Contract.tenantId does not match Reservation.userId.");
  }

  // Already-terminal → idempotent no-op (safe to re-run).
  const alreadyTerminal =
    contract.isCurrent === false ||
    ["expired", "terminated", "cancelled", "replaced", "archived", "renewed"].includes(contract.status);
  if (alreadyTerminal) {
    console.log(JSON.stringify({
      noActionNeeded: true,
      reason: "Contract is already terminal / non-current.",
      contractId: CONTRACT_ID,
      currentStatus: contract.status,
      currentIsCurrent: contract.isCurrent,
    }, null, 2));
    await mongoose.disconnect();
    process.exit(0);
  }

  // Preconditions for the repair — must be the exact stale state.
  if (contract.status !== "published") abort(`Contract status is "${contract.status}", expected "published".`);
  if (contract.isCurrent !== true) abort(`Contract isCurrent is ${contract.isCurrent}, expected true.`);
  if (contract.archivedAt != null) abort("Contract is archived.");
  if (contract.supersededByContractId != null) abort("Contract has already been superseded.");
  if (contract.duplicateOfContractId != null) abort("Contract is flagged as a duplicate.");
  if (reservation.status !== "moveOut") abort(`Reservation status is "${reservation.status}", expected "moveOut".`);

  const completedStay = await Stay.findOne({
    reservationId: RESERVATION_ID,
    status: "completed",
  }).lean();
  if (!completedStay) {
    abort('No Stay with status "completed" found for this Reservation — the normal-completion assumption does not hold.');
  }

  const before = {
    contractId: CONTRACT_ID,
    contractNumber: contract.contractNumber,
    status: contract.status,
    isCurrent: contract.isCurrent,
    reservationStatus: reservation.status,
    stayStatus: completedStay.status,
    stayEndReason: completedStay.endReason,
  };

  // transitionContract stamps contract.updatedBy = actorId and the schema
  // requires it, so a null actor is not an option here. Attribute the
  // repair to the Contract's own last actor (the admin who published it) —
  // same pattern repair_contract_target_movein_drafts.mjs uses — with the
  // reason string carrying the remediation context.
  const repairActorId = contract.updatedBy || contract.createdBy || contract.tenantId;

  if (!APPLY || !CONFIRMED) {
    console.log(JSON.stringify({
      dryRun: true,
      before,
      proposedTransition: 'published -> expired (normal full-term move-out completion; matches P2 moveOutStayWorkflow)',
      proposedIsCurrent: false,
      repairActorId: String(repairActorId),
      writesPerformed: 0,
      note: "Re-run with --apply --confirm=REPAIR_STALE_CONTRACT to execute.",
    }, null, 2));
  } else {
    await transitionContract(
      contract,
      "expired",
      repairActorId,
      "One-off repair: stale published Contract on already moved-out tenant (predates P2 move-out<->Contract sync fix). See repair_stale_moveout_contract_6a8ee666.mjs.",
      null,
    );
    const after = await Contract.findById(CONTRACT_ID).lean();
    console.log(JSON.stringify({
      applied: true,
      before,
      after: {
        status: after.status,
        isCurrent: after.isCurrent,
        statusHistoryTail: (after.statusHistory || []).slice(-1),
      },
      contractsModified: 1,
      reservationsModified: 0,
      staysModified: 0,
    }, null, 2));
  }
} finally {
  await mongoose.disconnect();
}
