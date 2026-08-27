/**
 * ============================================================================
 * AUDIT: MOVED-OUT TENANTS WITH A STILL-ACTIVE CONTRACT (READ-ONLY)
 * ============================================================================
 *
 * Reports Reservations at status "moveOut" whose current Contract (resolved
 * via the same canonical selector every other lifecycle service uses,
 * resolveAuthoritativeCurrentContract) is still at a non-terminal status
 * (active/expiring_soon/published/renewal_pending) — the exact gap the
 * contract lifecycle audit found: Contract.status previously was never
 * touched by move-out at all. This script exists to baseline how much
 * existing/historical data is affected before and after the P2/P9 fix
 * (moveOutStayWorkflow now transitions the Contract on move-out).
 *
 * Also reports the two related conditions from the same audit's §16:
 *   - Contract exists but its Reservation was cancelled before completing
 *     both required payment gates (the pre-correction over-eager generation
 *     bug fixed in reservationDepositSettlementService.js).
 *   - Multiple current Contracts for one tenant (would surface as
 *     MULTIPLE_CANONICAL_CONTRACTS from the selector — reported, not
 *     silently resolved).
 *
 * DOES NOT MODIFY ANY RECORD. Throws immediately if any write-intent flag
 * is passed, matching the convention of the other audit_*.mjs scripts.
 * ============================================================================
 */
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Contract, Reservation } from "../models/index.js";
import { resolveAuthoritativeCurrentContract } from "../services/tenantContractSelectionService.js";

dotenv.config();

if (process.argv.some((argument) => ["--write", "--apply", "--delete", "--void", "--repair"].includes(argument))) {
  throw new Error("This audit is dry-run only and never changes Contract or Reservation records.");
}
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");

const id = (value) => (value ? String(value) : "");

const NON_TERMINAL_CONTRACT_STATUSES = new Set([
  "active", "expiring_soon", "published", "renewal_pending",
]);

await mongoose.connect(process.env.MONGODB_URI);
try {
  // ── Check 1: moved-out Reservation, Contract still non-terminal ─────────
  const movedOutReservations = await Reservation.find({ status: "moveOut" })
    .select("_id reservationCode userId roomId moveOutDate")
    .lean();

  const staleContractFindings = [];
  const ambiguousFindings = [];
  let scannedReservations = 0;

  for (const reservation of movedOutReservations) {
    scannedReservations += 1;
    let contract = null;
    try {
      contract = await resolveAuthoritativeCurrentContract({ reservationId: reservation._id });
    } catch (resolveError) {
      if (resolveError?.code === "MULTIPLE_CANONICAL_CONTRACTS") {
        ambiguousFindings.push({
          reservationId: id(reservation._id),
          reservationCode: reservation.reservationCode,
          tenantId: id(reservation.userId),
          issue: "MULTIPLE_CANONICAL_CONTRACTS",
        });
      }
      continue;
    }
    if (contract && NON_TERMINAL_CONTRACT_STATUSES.has(contract.status)) {
      staleContractFindings.push({
        reservationId: id(reservation._id),
        reservationCode: reservation.reservationCode,
        tenantId: id(reservation.userId),
        moveOutDate: reservation.moveOutDate,
        contractId: id(contract._id),
        contractNumber: contract.contractNumber,
        contractStatus: contract.status,
        contractIsCurrent: contract.isCurrent,
      });
    }
  }

  // ── Check 2: Contract exists, Reservation cancelled before both payment
  // gates were satisfied (the over-eager-generation class this audit's
  // mid-stream correction fixed going forward — this only surfaces
  // pre-existing historical data, not anything the corrected code can
  // still produce). ─────────────────────────────────────────────────────
  const cancelledReservations = await Reservation.find({ status: "cancelled" })
    .select("_id reservationCode userId reservationFeePaymentStatus initialPaymentStatus financialWorkflowVersion")
    .lean();
  const cancelledIds = cancelledReservations.map((r) => r._id);
  const contractsOnCancelledReservations = cancelledIds.length
    ? await Contract.find({ reservationId: { $in: cancelledIds }, archivedAt: null })
        .select("_id contractNumber reservationId status isCurrent")
        .lean()
    : [];
  const cancelledById = new Map(cancelledReservations.map((r) => [id(r._id), r]));
  const contractOnCancelledFindings = contractsOnCancelledReservations.map((contract) => {
    const reservation = cancelledById.get(id(contract.reservationId));
    return {
      contractId: id(contract._id),
      contractNumber: contract.contractNumber,
      contractStatus: contract.status,
      contractIsCurrent: contract.isCurrent,
      reservationId: id(reservation?._id),
      reservationCode: reservation?.reservationCode,
      reservationFeePaymentStatus: reservation?.reservationFeePaymentStatus || null,
      initialPaymentStatus: reservation?.initialPaymentStatus || null,
      financialWorkflowVersion: reservation?.financialWorkflowVersion || "legacy",
    };
  });

  process.stdout.write(`${JSON.stringify({
    dryRun: true,
    generatedAt: new Date().toISOString(),
    check1_movedOutTenantsWithStillActiveContract: {
      scannedReservations,
      findingsCount: staleContractFindings.length,
      findings: staleContractFindings,
    },
    check1b_ambiguousCanonicalContract: {
      findingsCount: ambiguousFindings.length,
      findings: ambiguousFindings,
    },
    check2_contractExistsOnCancelledReservation: {
      scannedCancelledReservations: cancelledReservations.length,
      findingsCount: contractOnCancelledFindings.length,
      findings: contractOnCancelledFindings,
    },
  }, null, 2)}\n`);
} finally {
  await mongoose.disconnect();
}
