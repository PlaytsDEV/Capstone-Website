/**
 * trackBApprovalActorRepair.mjs
 * ============================================================================
 * Applies ONLY the deterministic, cross-corroborated applicationReviewedBy
 * backfill for the 8 Track B candidate contracts identified by
 * auditHistoricalContractApprovalBackfill.mjs (re-confirmed with zero drift
 * immediately before this script was written).
 *
 * Scope — narrowly limited to what eligibility logic actually requires:
 *   - reservation.applicationReviewedBy ONLY.
 *   - applicationReviewedAt is already set on all 8 records; untouched.
 *   - contract.pricingApprovedBy is deliberately NOT backfilled here: the
 *     audit script itself labels that evidence "circumstantial" (derived
 *     formula, not independently corroborated), and getContractValidation
 *     no longer requires it for generation readiness.
 *   - bedId/bedLabel/roomId/roomType/pricing/lease dates/tenant identity/
 *     documents/cancellation state are never touched by this script.
 *
 * Safety:
 *   - Each update is a single atomic findOneAndUpdate guarded by
 *     applicationReviewedBy: null — if the record changed since the last
 *     audit (drift) or this script is re-run, the guard simply fails to
 *     match and the record is skipped, never overwritten.
 *   - Idempotent: re-running after a successful apply is a no-op for every
 *     already-repaired record (guard no longer matches).
 *
 * Usage: node scripts/trackBApprovalActorRepair.mjs --apply
 * (no --apply => dry-run only, prints the plan and exits without writing)
 * ============================================================================
 */
import "dotenv/config";
import mongoose from "mongoose";
import { Contract, Reservation } from "../models/index.js";

const APPLY = process.argv.includes("--apply");

const OWNER_ID = "69bb9249dcab8f0bf467a0f4"; // Dormitory Owner
const GIL_PUYAT_ADMIN_ID = "69ac1ed91c79bd7cba28de2a"; // Gil Puyat Branch Admin

const PLAN = [
  { contractNumber: "LIL-GP-2026-00014", reservationId: "6a80582acb5e42a2515013d0", actor: GIL_PUYAT_ADMIN_ID },
  { contractNumber: "LIL-GP-2026-00017", reservationId: "6a841c50bab985d00b295e7a", actor: OWNER_ID },
  { contractNumber: "LIL-GP-2026-00027", reservationId: "6a8bb8f2480bdb9affbc6ee8", actor: OWNER_ID },
  { contractNumber: "LIL-GP-2026-00028", reservationId: "6a8bef972fbb5eae57c634ae", actor: OWNER_ID },
  { contractNumber: "LIL-GP-2026-00022", reservationId: "6a87e2cc8c270e5500f9cca3", actor: OWNER_ID },
  { contractNumber: "LIL-GP-2026-00023", reservationId: "6a880238d9c8f6f82ebea2e9", actor: OWNER_ID },
  { contractNumber: "LIL-GP-2026-00004", reservationId: "6a7455a1f21f1d94dd8502ae", actor: OWNER_ID },
  { contractNumber: "LIL-GP-2026-00010", reservationId: "6a74c85c92f8a8ed70b2c51f", actor: OWNER_ID },
];

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log(`Connected to: ${mongoose.connection.name}`);
  console.log(APPLY ? "MODE: APPLY (will write)" : "MODE: DRY-RUN (no writes)");
  console.log("================================================================\n");

  const results = [];
  for (const item of PLAN) {
    const contract = await Contract.findOne({ contractNumber: item.contractNumber }).select("_id reservationId").lean();
    if (!contract) {
      console.log(`${item.contractNumber}: CONTRACT NOT FOUND — skipping`);
      results.push({ ...item, outcome: "CONTRACT_NOT_FOUND" });
      continue;
    }
    if (String(contract.reservationId) !== item.reservationId) {
      console.log(`${item.contractNumber}: DATA_DRIFT_DETECTED — reservationId changed since plan was built — skipping`);
      results.push({ ...item, outcome: "DATA_DRIFT_DETECTED" });
      continue;
    }

    const before = await Reservation.findById(item.reservationId).select("applicationReviewedBy applicationReviewedAt").lean();
    if (!before) {
      console.log(`${item.contractNumber}: RESERVATION_NOT_FOUND — skipping`);
      results.push({ ...item, outcome: "RESERVATION_NOT_FOUND" });
      continue;
    }
    if (before.applicationReviewedBy) {
      console.log(`${item.contractNumber}: DATA_DRIFT_DETECTED — applicationReviewedBy already set to ${before.applicationReviewedBy} — skipping (not overwriting)`);
      results.push({ ...item, outcome: "DATA_DRIFT_DETECTED", currentValue: String(before.applicationReviewedBy) });
      continue;
    }

    if (!APPLY) {
      console.log(`${item.contractNumber}: DRY-RUN — would set reservation.applicationReviewedBy = ${item.actor}`);
      results.push({ ...item, outcome: "DRY_RUN_WOULD_APPLY" });
      continue;
    }

    const updated = await Reservation.findOneAndUpdate(
      { _id: item.reservationId, applicationReviewedBy: null },
      { $set: { applicationReviewedBy: item.actor } },
      { new: true },
    ).select("applicationReviewedBy applicationReviewedAt").lean();

    if (!updated) {
      console.log(`${item.contractNumber}: DATA_DRIFT_DETECTED at write time — guard did not match — skipping`);
      results.push({ ...item, outcome: "DATA_DRIFT_DETECTED_AT_WRITE" });
      continue;
    }

    console.log(`${item.contractNumber}: APPLIED — reservation.applicationReviewedBy = ${item.actor}`);
    results.push({ ...item, outcome: "APPLIED" });
  }

  console.log("\n================================================================");
  console.log("SUMMARY");
  console.log("================================================================");
  const counts = results.reduce((acc, r) => {
    acc[r.outcome] = (acc[r.outcome] || 0) + 1;
    return acc;
  }, {});
  console.log(JSON.stringify(counts, null, 2));

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
