/**
 * repairOrphanContracts.mjs
 * ============================================================================
 * PR 3 (Orphan Lifecycle / Cleanup Safety) repair tool.
 *
 * Finds Contract documents whose reservationId and/or tenantId no longer
 * resolve to an existing Reservation/User (the orphan pattern found by the
 * 2026-08-25 production audit — includes at least one Contract that had
 * reached status "generated" / publicationStatus "ready_for_resident" with
 * a real prepared PDF before its parent Reservation/User vanished).
 *
 * Read-only by default. Classifies every orphan found; only a
 * DETERMINISTIC_ARCHIVABLE record can ever be mutated, and only in --apply
 * mode with an explicit confirmation flag. Nothing is ever hard-deleted —
 * eligible records are archived (status: voided, isCurrent: false,
 * publicationStatus: withdrawn), never removed, so the record and its
 * history remain inspectable.
 *
 * Usage:
 *   node scripts/repairOrphanContracts.mjs                          # dry-run (default)
 *   node scripts/repairOrphanContracts.mjs --dry-run                # same, explicit
 *   node scripts/repairOrphanContracts.mjs --apply --confirm=ARCHIVE_ORPHANS
 *
 * Classification:
 *   ALREADY_INERT_NO_ACTION      — isCurrent:false and status already terminal;
 *                                   nothing to do, just a dangling historical ref.
 *   DETERMINISTIC_ARCHIVABLE     — orphaned, still isCurrent:true (or non-terminal),
 *                                   AND no billing/payment/signed/notarized/final
 *                                   document evidence, AND no other collection
 *                                   references it. Safe to archive automatically.
 *   AMBIGUOUS_MANUAL_REVIEW      — orphaned but has real evidence attached
 *                                   (billing, payment, signed/final document, or
 *                                   another collection — e.g. a disciplinary
 *                                   record — references it). Never auto-repaired.
 * ============================================================================
 */

import dotenv from "dotenv";
import mongoose from "mongoose";

import { Contract, Reservation, User, Bill, Payment } from "../models/index.js";
import { archiveContractsForReservationHardDelete } from "../services/contractArchiveService.js";

dotenv.config();

const args = process.argv.slice(2);
const APPLY = args.includes("--apply");
const CONFIRM_FLAG = args.find((a) => a.startsWith("--confirm="));
const CONFIRMED = CONFIRM_FLAG === "--confirm=ARCHIVE_ORPHANS";

const line = (c = "=") => c.repeat(78);
const TERMINAL_STATUSES = new Set(["voided", "cancelled", "archived", "rejected", "replaced", "terminated"]);

async function countOtherCollectionReferences(reservationId, contractId) {
  const database = mongoose.connection.db;
  const excluded = new Set(["contracts", "reservations", "auditlogs"]);
  const collections = await database.listCollections({}, { nameOnly: true }).toArray();
  const hits = [];
  for (const { name } of collections) {
    if (!name || excluded.has(name) || name.startsWith("system.")) continue;
    const count = await database.collection(name).countDocuments({
      $or: [
        { reservationId },
        { contractId },
        { contract: contractId },
      ],
    }, { limit: 1 });
    if (count > 0) hits.push(name);
  }
  return hits;
}

async function classifyOrphan(contract) {
  if (contract.isCurrent !== true && TERMINAL_STATUSES.has(contract.status)) {
    return { classification: "ALREADY_INERT_NO_ACTION", reasons: [] };
  }

  const [billings, payments, otherCollections] = await Promise.all([
    Bill.countDocuments({ contractId: contract._id }),
    Payment.countDocuments({ contractId: contract._id }),
    countOtherCollectionReferences(contract.reservationId, contract._id),
  ]);

  const reasons = [];
  if ((contract.signedDocuments || []).length > 0) reasons.push("signedDocuments");
  if ((contract.notarizedDocuments || []).length > 0) reasons.push("notarizedDocuments");
  if (contract.finalDocument || contract.finalStorageKey) reasons.push("finalDocument");
  if (contract.printedAt || contract.printedBy) reasons.push("printedIssuance");
  if (billings > 0) reasons.push(`billings(${billings})`);
  if (payments > 0) reasons.push(`payments(${payments})`);
  if (otherCollections.length) reasons.push(`otherCollections(${otherCollections.join(",")})`);

  if (reasons.length) {
    return { classification: "AMBIGUOUS_MANUAL_REVIEW", reasons };
  }
  return { classification: "DETERMINISTIC_ARCHIVABLE", reasons: [] };
}

async function main() {
  console.log(line());
  console.log(`  ORPHAN CONTRACT REPAIR${APPLY ? " [APPLY MODE]" : " [DRY-RUN]"}`);
  console.log(line());

  if (APPLY && !CONFIRMED) {
    console.error("❌  --apply requires --confirm=ARCHIVE_ORPHANS. Aborting — no changes made.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  console.log("  ℹ  Connected to MongoDB\n");

  const allContracts = await Contract.find({}).select(
    "_id contractNumber reservationId tenantId status isCurrent publicationStatus " +
    "signedDocuments notarizedDocuments finalDocument finalStorageKey printedAt printedBy createdAt",
  );
  console.log(`  ℹ  Scanned ${allContracts.length} Contract document(s)\n`);

  const results = { ALREADY_INERT_NO_ACTION: [], DETERMINISTIC_ARCHIVABLE: [], AMBIGUOUS_MANUAL_REVIEW: [] };

  for (const contract of allContracts) {
    const [reservationExists, tenantExists] = await Promise.all([
      contract.reservationId ? Reservation.exists({ _id: contract.reservationId }) : null,
      contract.tenantId ? User.exists({ _id: contract.tenantId }) : null,
    ]);
    if (reservationExists || tenantExists) continue; // not an orphan

    const { classification, reasons } = await classifyOrphan(contract);
    results[classification].push({ contract, reasons });
  }

  for (const [classification, entries] of Object.entries(results)) {
    console.log(line("-"));
    console.log(`  ${classification} (${entries.length})`);
    console.log(line("-"));
    for (const { contract, reasons } of entries) {
      console.log(
        `    ${contract.contractNumber}  status=${contract.status}  isCurrent=${contract.isCurrent}  ` +
        `publicationStatus=${contract.publicationStatus || "-"}  createdAt=${contract.createdAt?.toISOString?.() || "-"}`,
      );
      console.log(`      reservationId=${contract.reservationId}  tenantId=${contract.tenantId}`);
      if (reasons.length) console.log(`      reasons: ${reasons.join(", ")}`);
    }
    if (!entries.length) console.log("    (none)");
    console.log();
  }

  console.log(line());
  console.log(
    `  SUMMARY: archivable=${results.DETERMINISTIC_ARCHIVABLE.length}  ` +
    `ambiguous=${results.AMBIGUOUS_MANUAL_REVIEW.length}  ` +
    `already-inert=${results.ALREADY_INERT_NO_ACTION.length}`,
  );
  console.log(line());

  if (!APPLY) {
    console.log("\n  Dry-run only — no changes made. Re-run with --apply --confirm=ARCHIVE_ORPHANS to archive the DETERMINISTIC_ARCHIVABLE set above.");
    await mongoose.disconnect();
    return;
  }

  console.log("\n  Applying archival to DETERMINISTIC_ARCHIVABLE records only...\n");
  for (const { contract } of results.DETERMINISTIC_ARCHIVABLE) {
    try {
      const archived = await archiveContractsForReservationHardDelete({
        reservationId: contract.reservationId,
        actorId: null,
      });
      console.log(`  ✔  Archived ${contract.contractNumber} (${archived.length} contract(s) for reservationId ${contract.reservationId})`);
    } catch (err) {
      console.error(`  ❌  Failed to archive ${contract.contractNumber}: ${err.message}`);
    }
  }

  console.log("\n  Re-run with --dry-run afterward to confirm deterministic unresolved duplicates = 0.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
