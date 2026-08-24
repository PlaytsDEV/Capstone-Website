/**
 * auditHistoricalContractApprovalBackfill.mjs
 * ============================================================================
 * DRY-RUN-ONLY audit for the historical applicationReviewedBy/pricingApprovedBy/
 * bedId/bedLabel gap discovered while investigating why Job 19 (utils/scheduler.js)
 * could not recover a set of stuck Contracts even after its eligibility check
 * was aligned with resolveReservationContractEligibility.
 *
 * This script NEVER writes to the database. There is no write/apply code path
 * in this file at all — that is deliberate, not merely flag-gated, so running
 * it can never accidentally mutate production data. A future, separately
 * reviewed script would implement the actual apply step once the evidence
 * standard below is explicitly approved.
 *
 * Evidence model
 * --------------
 * Every historical "Admin updated reservation status to approved_for_payment"
 * AuditLog entry has an empty `userId` (a gap in a different part of the
 * codebase — auth middleware not attaching req.user.mongoId for those
 * sessions) but a `user` field holding a deterministic fingerprint:
 *   sha256:<first 12 hex chars of sha256(email.trim().toLowerCase())>
 * (services/audit/auditLogger.js's fingerprintIdentity()). That hash is
 * reproducible — this script recomputes it for every current owner/branch_admin
 * account and looks for an exact, unambiguous match. This is INDIRECT
 * DETERMINISTIC AUDIT EVIDENCE (a hash reversal against known candidates),
 * not DIRECT FOREIGN KEY EVIDENCE (a stored ObjectId). It is reported as such
 * on every candidate — never blurred into "verified".
 *
 * A proposed applicationReviewedBy value is only surfaced when ALL of:
 *   1. A matching "approved_for_payment" AuditLog entry exists for that
 *      reservation.
 *   2. Exactly one current owner/branch_admin account's email hashes to that
 *      fingerprint.
 *   3. No other admin account also matches (collision).
 *   4. No other approval-shaped AuditLog entry for the same reservation
 *      points to a different admin fingerprint (conflicting event).
 * Any failure of the above is reported as AMBIGUOUS and no value is proposed.
 *
 * Usage: node scripts/auditHistoricalContractApprovalBackfill.mjs
 * (dry-run is the only mode this script has; --dry-run is accepted as a no-op
 * for callers that pass it explicitly.)
 * ============================================================================
 */

import "dotenv/config";
import crypto from "crypto";
import mongoose from "mongoose";
import { Contract, Reservation, AuditLog, User, Room } from "../models/index.js";
import {
  resolveReservationContractEligibility,
  roomRequiresIndividualBed,
} from "../services/reservationContractEligibilityService.js";

const STUCK_STATUSES = ["draft", "incomplete", "ready_for_generation"];

const fingerprintOf = (email) =>
  `sha256:${crypto.createHash("sha256").update(String(email).trim().toLowerCase()).digest("hex").slice(0, 12)}`;

const maskContract = (n) => n; // contract numbers are not sensitive; kept as-is
const maskAdmin = (admin) => (admin ? `${admin.role}:${String(admin._id).slice(-6)}` : null);

async function buildAdminFingerprintIndex() {
  const admins = await User.find({ role: { $in: ["owner", "branch_admin"] } })
    .select("_id email role")
    .lean();
  const byFingerprint = new Map();
  for (const admin of admins) {
    const fp = fingerprintOf(admin.email);
    if (!byFingerprint.has(fp)) byFingerprint.set(fp, []);
    byFingerprint.get(fp).push(admin);
  }
  return { admins, byFingerprint };
}

async function resolveApprovalActor(reservationId, byFingerprint) {
  const approvalLogs = await AuditLog.find({
    entityType: "reservation",
    entityId: String(reservationId),
    action: { $regex: /approved_for_payment/i },
  }).select("user userRole timestamp").lean();

  if (approvalLogs.length === 0) {
    return { status: "NO_EVIDENCE", evidence: [] };
  }

  const distinctFingerprints = new Set(approvalLogs.map((l) => l.user));
  if (distinctFingerprints.size > 1) {
    return { status: "AMBIGUOUS_CONFLICTING_EVENTS", evidence: approvalLogs };
  }

  const fingerprint = [...distinctFingerprints][0];
  const candidates = byFingerprint.get(fingerprint) || [];
  if (candidates.length === 0) {
    return { status: "AMBIGUOUS_NO_MATCH", evidence: approvalLogs, fingerprint };
  }
  if (candidates.length > 1) {
    return { status: "AMBIGUOUS_COLLISION", evidence: approvalLogs, fingerprint, candidates };
  }

  return {
    status: "RESOLVED",
    evidence: approvalLogs,
    fingerprint,
    admin: candidates[0],
    evidenceIdentifier: `AuditLog:${approvalLogs[0].timestamp?.toISOString?.() || approvalLogs[0].timestamp}`,
  };
}

async function auditBedBackfill(contract, reservation, room) {
  // Room-type gate FIRST, before any other check — a private room never
  // requires an individual bed assignment (confirmed against real
  // occupancy data: only rooms with more than one concurrent occupant make
  // the bed distinction load-bearing). Do not propose a bed backfill for a
  // private room merely because the Contract's bed fields happen to be
  // blank; blank is the CORRECT state there. This mirrors
  // roomRequiresIndividualBed() in reservationContractEligibilityService.js
  // and must never be evaluated using the stale reservation.preferredRoomType.
  if (!room) return { applicable: false, blocked: true, reason: "CONFLICT: contract.roomId does not resolve to an existing Room" };
  if (!roomRequiresIndividualBed(room.type)) {
    return { applicable: false, reason: `room.type "${room.type}" does not require an individual bed assignment — never proposing a bed backfill` };
  }

  const selectedBed = reservation?.selectedBed;
  const hasContractBed = Boolean(contract.bedId || contract.bedLabel);
  if (hasContractBed) return { applicable: false, reason: "contract already has bedId/bedLabel — not a candidate" };
  if (!selectedBed?.id) return { applicable: false, blocked: true, reason: `room.type "${room.type}" requires a bed assignment, but reservation.selectedBed has no id — no source to copy from` };

  const bed = (room.beds || []).find((b) => b.id === selectedBed.id);
  if (!bed) return { applicable: false, blocked: true, reason: `CONFLICT: bed id ${selectedBed.id} not found in room ${room.roomNumber}'s current beds[] — cannot verify it still belongs to this room` };

  if (room.branch !== contract.branch) {
    return { applicable: false, blocked: true, reason: `CONFLICT: room.branch (${room.branch}) does not match contract.branch (${contract.branch})` };
  }

  // Conflicting assignment check: does any OTHER current contract already claim this bedId for this room?
  const conflicting = await Contract.findOne({
    _id: { $ne: contract._id },
    roomId: contract.roomId,
    bedId: selectedBed.id,
    isCurrent: true,
  }).select("contractNumber").lean();
  if (conflicting) {
    return { applicable: false, blocked: true, reason: `CONFLICT: bed ${selectedBed.id} is already claimed by current contract ${conflicting.contractNumber}` };
  }

  return {
    applicable: true,
    proposedBedId: selectedBed.id,
    proposedBedLabel: selectedBed.code || null,
    evidenceIdentifier: `reservation.selectedBed (${reservation._id})`,
  };
}

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected to: ${mongoose.connection.name}\n`);
  console.log("================================================================");
  console.log("DRY-RUN-ONLY HISTORICAL CONTRACT APPROVAL BACKFILL AUDIT");
  console.log("No writes will occur. This script has no write code path.");
  console.log("================================================================\n");

  const { admins, byFingerprint } = await buildAdminFingerprintIndex();
  console.log(`Admin/owner accounts indexed: ${admins.length}`);
  const collisions = [...byFingerprint.entries()].filter(([, list]) => list.length > 1);
  console.log(`Fingerprint collisions among current admins: ${collisions.length}\n`);

  const stuckContracts = await Contract.find({
    isCurrent: true,
    status: { $in: STUCK_STATUSES },
  }).lean();

  console.log(`Contracts scanned (isCurrent, ${STUCK_STATUSES.join("/")}) : ${stuckContracts.length}\n`);

  const report = {
    scanned: stuckContracts.length,
    candidates: [],
    nonCandidates: [],
    approvalEventsScanned: 0,
    uniqueFingerprints: new Set(),
    uniqueAdminMatches: new Set(),
    collisions: 0,
    noMatch: 0,
    conflictingEvents: 0,
  };

  for (const contract of stuckContracts) {
    const reservation = contract.reservationId
      ? await Reservation.findById(contract.reservationId).lean()
      : null;
    console.log("================================================================");
    console.log(`Contract: ${contract.contractNumber} (${contract._id})`);
    console.log(`Reservation: ${contract.reservationId || "none"}`);

    if (!reservation) {
      console.log("  NO RESERVATION FOUND — non-candidate.");
      report.nonCandidates.push({ contract: contract.contractNumber, reason: "no reservation" });
      continue;
    }

    // Authoritative room type — NEVER reservation.preferredRoomType, which
    // the historical audit proved can be stale (three Private contracts
    // whose preferredRoomType said "quadruple"). contract.roomId is the
    // live, current assignment; contract.roomType was itself validated
    // against it at Contract-creation time (contractGenerationDataService.js
    // CONTRACT_ROOM_TYPE_CONFLICT check), so either is authoritative here —
    // prefer the live Room lookup since it can never go stale.
    const room = contract.roomId ? await Room.findById(contract.roomId).lean() : null;
    const authoritativeRoomType = room?.type || contract.roomType || null;

    const currentEligibility = resolveReservationContractEligibility(reservation, {
      bedExists: Boolean(contract.bedId || contract.bedLabel),
      roomType: authoritativeRoomType,
    });
    console.log(`  Current eligibility: ${currentEligibility.eligible ? "ELIGIBLE" : currentEligibility.blockers[0]?.code || currentEligibility.approvalState} (room.type=${authoritativeRoomType})`);

    // Business-state guard: an open cancellation request means generation is
    // inappropriate regardless of any metadata gap — flag loudly, never
    // silently folded into a "just needs backfill" bucket.
    if (reservation.cancellationRequested && reservation.cancellationStatus === "pending") {
      console.log(`  ** OPEN CANCELLATION REQUEST (pending, requested ${reservation.cancellationRequestedAt}) — human review required regardless of metadata gaps. **`);
    }
    if (reservation.rejectedAt || reservation.cancelledAt) {
      console.log("  ** Reservation has rejectedAt/cancelledAt set — non-candidate. **");
      report.nonCandidates.push({ contract: contract.contractNumber, reason: "rejected/cancelled reservation" });
      continue;
    }

    const proposedFields = [];

    // --- applicationReviewedBy ---
    if (!reservation.applicationReviewedBy) {
      const resolved = await resolveApprovalActor(reservation._id, byFingerprint);
      report.approvalEventsScanned += resolved.evidence.length;
      if (resolved.fingerprint) report.uniqueFingerprints.add(resolved.fingerprint);

      if (resolved.status === "RESOLVED") {
        report.uniqueAdminMatches.add(String(resolved.admin._id));
        proposedFields.push({
          field: "reservation.applicationReviewedBy",
          current: null,
          proposed: maskAdmin(resolved.admin),
          proposedRaw: String(resolved.admin._id),
          evidenceSource: "Admin AuditLog approval event, email-fingerprint crosswalk",
          evidenceIdentifier: resolved.evidenceIdentifier,
          evidenceType: "INDIRECT DETERMINISTIC AUDIT EVIDENCE",
          confidence: "deterministic-indirect",
        });
      } else if (resolved.status === "NO_EVIDENCE") {
        report.noMatch += 1;
        proposedFields.push({ field: "reservation.applicationReviewedBy", current: null, blocked: "NO_EVIDENCE — no approval AuditLog entry found" });
      } else if (resolved.status === "AMBIGUOUS_CONFLICTING_EVENTS") {
        report.conflictingEvents += 1;
        proposedFields.push({ field: "reservation.applicationReviewedBy", current: null, blocked: "AMBIGUOUS — multiple approval events point to different admins" });
      } else if (resolved.status === "AMBIGUOUS_COLLISION") {
        report.collisions += 1;
        proposedFields.push({ field: "reservation.applicationReviewedBy", current: null, blocked: `AMBIGUOUS — fingerprint matches ${resolved.candidates.length} current admin accounts` });
      } else {
        report.noMatch += 1;
        proposedFields.push({ field: "reservation.applicationReviewedBy", current: null, blocked: "AMBIGUOUS — fingerprint matches no current admin account" });
      }
    } else {
      console.log(`  reservation.applicationReviewedBy already set (${reservation.applicationReviewedBy}) — not a candidate for this field.`);
    }

    // --- contract.pricingApprovedBy ---
    if (!contract.pricingApprovedBy) {
      // Business-flow evidence: contractService.js's own createDraftContract
      // derives pricingApprovedBy from reservation.applicationReviewedBy at
      // creation time (structuredSnapshot?.approvedBy || reservation.applicationReviewedBy).
      // That is the one documented, code-verified relationship in this
      // codebase between "who approved the application" and "who approved
      // pricing" — there is no separate pricing-approval log or field. Reusing
      // the SAME resolved actor as applicationReviewedBy is therefore only as
      // strong as that evidence chain, not independently corroborated.
      const appReviewField = proposedFields.find((f) => f.field === "reservation.applicationReviewedBy");
      if (appReviewField && appReviewField.proposedRaw) {
        proposedFields.push({
          field: "contract.pricingApprovedBy",
          current: null,
          proposed: appReviewField.proposed,
          proposedRaw: appReviewField.proposedRaw,
          evidenceSource: "Same admin as applicationReviewedBy, via contractService.js's own createDraftContract derivation formula (pricingApprovedBy = reservation.applicationReviewedBy)",
          evidenceIdentifier: appReviewField.evidenceIdentifier,
          evidenceType: "INDIRECT DETERMINISTIC AUDIT EVIDENCE (circumstantial — inherits from applicationReviewedBy, no independent pricing-approval record exists)",
          confidence: "circumstantial",
        });
      } else if (reservation.applicationReviewedBy) {
        proposedFields.push({
          field: "contract.pricingApprovedBy",
          current: null,
          proposed: maskAdmin({ role: "?", _id: reservation.applicationReviewedBy }),
          proposedRaw: String(reservation.applicationReviewedBy),
          evidenceSource: "reservation.applicationReviewedBy (already present) via the same derivation formula",
          evidenceIdentifier: `Reservation:${reservation._id}`,
          evidenceType: "INDIRECT DETERMINISTIC AUDIT EVIDENCE (circumstantial)",
          confidence: "circumstantial",
        });
      } else {
        proposedFields.push({ field: "contract.pricingApprovedBy", current: null, blocked: "INSUFFICIENT FOR AUTOMATIC BACKFILL — no resolved approver to derive from" });
      }
    }

    // --- bedId / bedLabel ---
    const bedAudit = await auditBedBackfill(contract, reservation, room);
    if (bedAudit.applicable) {
      proposedFields.push({
        field: "contract.bedId",
        current: "",
        proposed: bedAudit.proposedBedId,
        evidenceSource: "reservation.selectedBed.id, cross-checked against the room's current beds[] and branch, no conflicting current-contract claim",
        evidenceIdentifier: bedAudit.evidenceIdentifier,
        evidenceType: "DIRECT EVIDENCE (same reservation record, cross-validated against live Room)",
        confidence: "direct",
      });
      proposedFields.push({
        field: "contract.bedLabel",
        current: "",
        proposed: bedAudit.proposedBedLabel,
        evidenceSource: "reservation.selectedBed.code, same validation as bedId",
        evidenceIdentifier: bedAudit.evidenceIdentifier,
        evidenceType: "DIRECT EVIDENCE (same reservation record, cross-validated against live Room)",
        confidence: "direct",
      });
    } else if (bedAudit.blocked) {
      proposedFields.push({ field: "contract.bedId/bedLabel", blocked: bedAudit.reason });
    }

    // --- simulate post-repair eligibility (in-memory only, nothing saved) ---
    const simulatedReservation = { ...reservation };
    const simulatedContract = { ...contract };
    for (const f of proposedFields) {
      if (f.blocked) continue;
      if (f.field === "reservation.applicationReviewedBy") simulatedReservation.applicationReviewedBy = f.proposedRaw;
      if (f.field === "contract.bedId") simulatedContract.bedId = f.proposed;
      if (f.field === "contract.bedLabel") simulatedContract.bedLabel = f.proposed;
    }
    const postRepairEligibility = resolveReservationContractEligibility(simulatedReservation, {
      bedExists: Boolean(simulatedContract.bedId || simulatedContract.bedLabel),
      roomType: authoritativeRoomType,
    });

    const hasDeterministicChange = proposedFields.some((f) => !f.blocked);
    const hasBlockedField = proposedFields.some((f) => f.blocked);

    console.log(`  Post-simulated-repair eligibility: ${postRepairEligibility.eligible ? "ELIGIBLE" : postRepairEligibility.blockers[0]?.code || postRepairEligibility.approvalState}`);
    for (const f of proposedFields) {
      if (f.blocked) {
        console.log(`  - ${f.field}: BLOCKED — ${f.blocked}`);
      } else {
        console.log(`  - ${f.field}: ${JSON.stringify(f.current)} -> ${JSON.stringify(f.proposed)} [${f.confidence}] evidence=${f.evidenceIdentifier}`);
      }
    }

    const entry = {
      contract: contract.contractNumber,
      contractId: String(contract._id),
      currentEligibility: currentEligibility.eligible ? "ELIGIBLE" : (currentEligibility.blockers[0]?.code || currentEligibility.approvalState),
      postRepairEligibility: postRepairEligibility.eligible ? "ELIGIBLE" : (postRepairEligibility.blockers[0]?.code || postRepairEligibility.approvalState),
      proposedFields,
      openCancellation: Boolean(reservation.cancellationRequested && reservation.cancellationStatus === "pending"),
    };

    if (hasDeterministicChange || hasBlockedField) {
      report.candidates.push(entry);
    } else {
      report.nonCandidates.push({ contract: contract.contractNumber, reason: "already fully populated or no proposable fields" });
    }
  }

  console.log("\n================================================================");
  console.log("SUMMARY");
  console.log("================================================================");
  console.log(`Contracts scanned: ${report.scanned}`);
  console.log(`Candidates (at least one proposed or blocked field): ${report.candidates.length}`);
  console.log(`Non-candidates: ${report.nonCandidates.length}`);
  console.log(`\nApproval hash crosswalk:`);
  console.log(`  Approval AuditLog events scanned: ${report.approvalEventsScanned}`);
  console.log(`  Unique fingerprints seen: ${report.uniqueFingerprints.size}`);
  console.log(`  Unique admin matches: ${report.uniqueAdminMatches.size}`);
  console.log(`  Collisions: ${report.collisions}`);
  console.log(`  No-match fingerprints: ${report.noMatch}`);
  console.log(`  Conflicting events: ${report.conflictingEvents}`);

  console.log(`\nProduction reservations modified: 0`);
  console.log(`Production contracts modified: 0`);
  console.log(`Production PDFs generated: 0`);
  console.log(`Tenant notifications sent: 0`);

  await mongoose.disconnect();
  return report;
}

main().catch((err) => {
  console.error("Audit script failed:", err);
  process.exit(1);
});
