/**
import { assertStagingWriteTarget } from "./stagingWriteGuard.js";
assertStagingWriteTarget(process.env, { toolName: "audit_normalize_addresses.mjs" });

 * audit_normalize_addresses.mjs
 * ============================================================================
 * Scans persisted addresses (User.address, Reservation.address,
 * Contract.tenantAddress) for deterministic duplication/formatting issues
 * (e.g. "17, 17 St. Mary St., ..., City of Bacoor, Cavite, City of Bacoor,
 * Cavite") using the shared normalizeAddress() utility, and reports what
 * would be auto-fixed.
 *
 * SAFETY:
 *   - Defaults to --dry-run behavior UNLESS --confirm=NORMALIZE is passed.
 *   - Always run with no flags (dry-run) first and review the report.
 *   - Mutation is asymmetric by design:
 *       User.address        -> mutated in live mode when changed.
 *       Reservation.address -> REPORT ONLY, never mutated (it is a
 *                               structured object; normalization only
 *                               applies at the joined-string boundary, so
 *                               overwriting it with a joined string would
 *                               destroy structured data).
 *       Contract.tenantAddress -> mutated in live mode ONLY when the
 *                               Contract has no finalDocument (i.e. it is
 *                               not yet a finalized/signed legal document).
 *                               Contracts with finalDocument set are
 *                               reported as FINAL_DOCUMENT_PRESERVED and
 *                               never touched — metadata must never
 *                               disagree with an already-signed document.
 *   - Never deletes anything, never touches finalDocument or any signed
 *     PDF/document binary.
 *   - Ambiguous cases (e.g. "San Jose, San Jose del Monte") are left
 *     unchanged by normalizeAddress() itself and reported as such — there
 *     is no manual review queue; ambiguous means "leave alone", not
 *     "flag for approval".
 *
 * Usage:
 *   node scripts/audit_normalize_addresses.mjs                    # dry run (default)
 *   node scripts/audit_normalize_addresses.mjs --confirm=NORMALIZE   # applies fixes
 * ============================================================================
 */

import dotenv from "dotenv";
import mongoose from "mongoose";

import { User, Reservation, Contract } from "../models/index.js";
import { normalizeAddress, joinAddressParts, ADDRESS_NORMALIZE_STATUS } from "../utils/addressUtils.js";

dotenv.config();

const args = process.argv.slice(2);
const confirmFlag = args.find((a) => a.startsWith("--confirm="));
const DRY_RUN = confirmFlag?.split("=")[1] !== "NORMALIZE";

const line = (c = "=") => c.repeat(70);
const ok = (msg) => console.log(`  ✔  ${msg}`);
const info = (msg) => console.log(`  ℹ  ${msg}`);
const warn = (msg) => console.log(`  ⚠  ${msg}`);
const skip = (msg) => console.log(`  —  ${msg}`);

const counts = {
  User: { scanned: 0, alreadyClean: 0, autoFixed: 0, ambiguous: 0, empty: 0 },
  Reservation: { scanned: 0, alreadyClean: 0, autoFixed: 0, ambiguous: 0, empty: 0 },
  Contract: { scanned: 0, alreadyClean: 0, autoFixed: 0, ambiguous: 0, empty: 0, finalPreserved: 0 },
};

const reasonFor = (status, reasons) => {
  if (status === ADDRESS_NORMALIZE_STATUS.ALREADY_CLEAN) return "ALREADY_CLEAN";
  if (status === ADDRESS_NORMALIZE_STATUS.UNCHANGED) return "AMBIGUOUS_UNCHANGED";
  return reasons.join("+") || "AUTO_FIXED";
};

async function auditUsers() {
  console.log(line("-"));
  info("Scanning User.address ...");
  const users = await User.find({ address: { $exists: true, $ne: "" } }).select("_id address").lean();
  for (const user of users) {
    counts.User.scanned += 1;
    const original = user.address;
    if (!original || !String(original).trim()) {
      counts.User.empty += 1;
      continue;
    }
    const { value, status, reasons } = normalizeAddress(original);
    const changed = value !== original;
    if (status === ADDRESS_NORMALIZE_STATUS.ALREADY_CLEAN) counts.User.alreadyClean += 1;
    else if (status === ADDRESS_NORMALIZE_STATUS.UNCHANGED) counts.User.ambiguous += 1;
    else counts.User.autoFixed += 1;

    if (changed) {
      console.log(`  [User ${user._id}] "${original}" -> "${value}" (${reasonFor(status, reasons)})`);
      if (!DRY_RUN) {
        await User.updateOne({ _id: user._id }, { $set: { address: value } });
        ok(`  Updated User ${user._id}`);
      } else {
        skip(`  [DRY-RUN] Would update User ${user._id}`);
      }
    }
  }
  info(`User: scanned=${counts.User.scanned} alreadyClean=${counts.User.alreadyClean} autoFixed=${counts.User.autoFixed} ambiguous=${counts.User.ambiguous} empty=${counts.User.empty}`);
}

async function auditReservations() {
  console.log(line("-"));
  info("Scanning Reservation.address (report only — structured field, never mutated) ...");
  const reservations = await Reservation.find({ address: { $exists: true } }).select("_id address").lean();
  for (const reservation of reservations) {
    counts.Reservation.scanned += 1;
    const joined = joinAddressParts(reservation.address);
    if (!joined) {
      counts.Reservation.empty += 1;
      continue;
    }
    const { value, status, reasons } = normalizeAddress(joined);
    const changed = value !== joined;
    if (status === ADDRESS_NORMALIZE_STATUS.ALREADY_CLEAN) counts.Reservation.alreadyClean += 1;
    else if (status === ADDRESS_NORMALIZE_STATUS.UNCHANGED) counts.Reservation.ambiguous += 1;
    else counts.Reservation.autoFixed += 1;

    if (changed) {
      console.log(`  [Reservation ${reservation._id}] "${joined}" -> "${value}" (${reasonFor(status, reasons)}) [report only, not mutated]`);
    }
  }
  info(`Reservation: scanned=${counts.Reservation.scanned} alreadyClean=${counts.Reservation.alreadyClean} autoFixed=${counts.Reservation.autoFixed} ambiguous=${counts.Reservation.ambiguous} empty=${counts.Reservation.empty}`);
}

async function auditContracts() {
  console.log(line("-"));
  info("Scanning Contract.tenantAddress ...");
  const contracts = await Contract.find({ tenantAddress: { $exists: true, $ne: "" } })
    .select("_id tenantAddress finalDocument status")
    .lean();
  for (const contract of contracts) {
    counts.Contract.scanned += 1;
    const original = contract.tenantAddress;
    if (!original || !String(original).trim()) {
      counts.Contract.empty += 1;
      continue;
    }
    const { value, status, reasons } = normalizeAddress(original);
    const changed = value !== original;
    if (status === ADDRESS_NORMALIZE_STATUS.ALREADY_CLEAN) counts.Contract.alreadyClean += 1;
    else if (status === ADDRESS_NORMALIZE_STATUS.UNCHANGED) counts.Contract.ambiguous += 1;
    else counts.Contract.autoFixed += 1;

    if (contract.finalDocument) {
      if (changed) {
        counts.Contract.finalPreserved += 1;
        console.log(`  [Contract ${contract._id} status=${contract.status}] "${original}" -> "${value}" (${reasonFor(status, reasons)}) [FINAL_DOCUMENT_PRESERVED — metadata not mutated]`);
      }
      continue;
    }

    if (changed) {
      console.log(`  [Contract ${contract._id} status=${contract.status}] "${original}" -> "${value}" (${reasonFor(status, reasons)})`);
      if (!DRY_RUN) {
        // Mongoose 5.13+ silently strips `immutable: true` paths from a
        // query-level $set unless overwriteImmutable is explicitly passed —
        // this is the correct, deliberate, narrowly-scoped mechanism for a
        // one-time data-migration write to an immutable field. Never do
        // this via contract.save() (that path is correctly blocked).
        await Contract.updateOne(
          { _id: contract._id },
          { $set: { tenantAddress: value } },
          { overwriteImmutable: true },
        );
        ok(`  Updated Contract ${contract._id}`);
      } else {
        skip(`  [DRY-RUN] Would update Contract ${contract._id}`);
      }
    }
  }
  info(`Contract: scanned=${counts.Contract.scanned} alreadyClean=${counts.Contract.alreadyClean} autoFixed=${counts.Contract.autoFixed} ambiguous=${counts.Contract.ambiguous} empty=${counts.Contract.empty} finalDocumentPreserved=${counts.Contract.finalPreserved}`);
}

async function main() {
  console.log(line());
  console.log(`  AUDIT / NORMALIZE ADDRESSES${DRY_RUN ? " [DRY-RUN — no data will be modified]" : " [LIVE RUN]"}`);
  console.log(line());

  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  info(`Connected to MongoDB: ${mongoose.connection.name}`);

  await auditUsers();
  await auditReservations();
  await auditContracts();

  console.log(line());
  console.log("  SUMMARY");
  console.log(line());
  for (const [model, c] of Object.entries(counts)) {
    console.log(`  ${model}: ${JSON.stringify(c)}`);
  }
  console.log(line());
  console.log(
    DRY_RUN
      ? "  ✅  DRY-RUN complete. No data was modified. Re-run with --confirm=NORMALIZE to apply fixes."
      : "  ✅  Normalization complete. User.address and pre-final Contract.tenantAddress records updated where deterministically safe.",
  );
  console.log(line());

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("❌  Script failed:", err);
  mongoose.disconnect();
  process.exit(1);
});
