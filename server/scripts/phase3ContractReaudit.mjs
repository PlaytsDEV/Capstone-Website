/**
 * phase3ContractReaudit.mjs
 * ============================================================================
 * READ-ONLY. Re-audits the 12 flagged contracts (LIL-GP-2026-00004/00005/
 * 00010/00014/00017/00022/00023/00024/00027, LIL-GUAD-2026-00003/00004/00008)
 * against the corrected resolveReservationContractEligibility /
 * getContractValidation logic merged in PR #133 (commits 4b05f19f/366069db,
 * live in production as of merge commit affd10bf).
 *
 * This script has NO write path. It only ever calls .find()/.findOne()/.lean()
 * on Contract/Reservation/Room, imports the same pure eligibility function
 * production uses, and prints a JSON report to stdout. Nothing is ever
 * .save()d, .updateOne()d, or .create()d. It does not import or call any
 * orchestration/generation service (autoContractOrchestratorService,
 * contractPdfService, contractPublicationService, etc.) — only the pure
 * eligibility/validation functions are imported.
 *
 * Usage: node scripts/phase3ContractReaudit.mjs
 * ============================================================================
 */

import "dotenv/config";
import mongoose from "mongoose";
import { Contract, Reservation, Room } from "../models/index.js";
import { resolveReservationContractEligibility } from "../services/reservationContractEligibilityService.js";
import { getContractValidation } from "../services/contractService.js";

const TARGET_CONTRACT_NUMBERS = [
  "LIL-GP-2026-00004", "LIL-GP-2026-00005", "LIL-GP-2026-00010",
  "LIL-GP-2026-00014", "LIL-GP-2026-00017", "LIL-GP-2026-00022",
  "LIL-GP-2026-00023", "LIL-GP-2026-00024", "LIL-GP-2026-00027",
  "LIL-GUAD-2026-00003", "LIL-GUAD-2026-00004", "LIL-GUAD-2026-00008",
];

const short = (id) => (id ? String(id).slice(-6) : null);

const documentState = (contract) => {
  const prepared = contract.preparedDocuments?.length
    ? { count: contract.preparedDocuments.length, latestVersion: contract.preparedDocuments.at(-1)?.version ?? null }
    : null;
  const signed = contract.signedDocuments?.length
    ? { count: contract.signedDocuments.length, version: contract.signedDocumentVersion }
    : null;
  const notarized = contract.notarizedDocuments?.length
    ? { count: contract.notarizedDocuments.length, version: contract.notarizedDocumentVersion, notarizedAt: contract.notarizedAt }
    : null;
  const final = contract.finalDocument
    ? { sourceType: contract.finalDocument.sourceType, uploadedAt: contract.finalDocument.uploadedAt || null }
    : null;
  return { prepared, signed, notarized, final, generatedStorageKey: contract.generatedStorageKey || null };
};

async function main() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.error(`[phase3] connected to: ${mongoose.connection.name} (read-only session)`);

  const results = [];

  for (const contractNumber of TARGET_CONTRACT_NUMBERS) {
    const contract = await Contract.findOne({ contractNumber }).lean();
    if (!contract) {
      results.push({ contractNumber, found: false });
      console.error(`[phase3] ${contractNumber}: NOT_FOUND`);
      continue;
    }

    const [reservation, room] = await Promise.all([
      contract.reservationId ? Reservation.findById(contract.reservationId).lean() : null,
      contract.roomId ? Room.findById(contract.roomId).lean() : null,
    ]);

    const eligibility = reservation
      ? resolveReservationContractEligibility(reservation, {
          tenantExists: Boolean(contract.tenantId),
          roomExists: Boolean(room),
          bedExists: Boolean(contract.bedId || contract.bedLabel),
          // Authoritative room type — never reservation.preferredRoomType,
          // which the historical audit proved can be stale (three Private
          // contracts whose preferredRoomType said "quadruple").
          roomType: room?.type || contract.roomType,
        })
      : null;

    const fieldValidation = getContractValidation(contract);

    results.push({
      contractNumber,
      found: true,
      contractId: String(contract._id),
      reservationId: contract.reservationId ? String(contract.reservationId) : null,
      reservationFound: Boolean(reservation),
      roomId: contract.roomId ? String(contract.roomId) : null,
      roomFound: Boolean(room),
      branch: contract.branch,
      roomType: contract.roomType,
      roomNumber: contract.roomNumber,
      actualRoomType: room?.type || null,
      contractStatus: contract.status,
      isCurrent: contract.isCurrent,
      reservationStatus: reservation?.status || null,
      applicationReviewedAt: reservation?.applicationReviewedAt || null,
      applicationReviewedByRef: short(reservation?.applicationReviewedBy),
      cancellationRequested: Boolean(reservation?.cancellationRequested),
      cancellationStatus: reservation?.cancellationStatus || null,
      leaseType: contract.leaseType,
      leaseStartDate: contract.leaseStartDate,
      leaseEndDate: contract.leaseEndDate,
      leaseDurationMonths: contract.leaseDurationMonths,
      bedId: contract.bedId || "",
      bedLabel: contract.bedLabel || "",
      selectedBedRef: reservation?.selectedBed?.id || reservation?.selectedBed?.code || null,
      regularMonthlyRate: contract.regularMonthlyRate,
      approvedMonthlyRate: contract.approvedMonthlyRate,
      discountAmount: contract.discountAmount,
      advanceRentAmount: contract.advanceRentAmount,
      securityDepositAmount: contract.securityDepositAmount,
      pricingApprovedByRef: short(contract.pricingApprovedBy),
      documentState: documentState(contract),
      fieldValidation: {
        valid: fieldValidation.valid,
        missingFields: fieldValidation.missingFields.map((f) => f.field),
      },
      eligibility: eligibility
        ? {
            eligible: eligibility.eligible,
            approvalState: eligibility.approvalState,
            blockerCode: eligibility.blockers[0]?.code || null,
            blockerCategory: eligibility.blockers[0]?.category || null,
            retryable: eligibility.blockers[0]?.retryable ?? null,
            humanActionRequired: eligibility.blockers[0]?.humanActionRequired ?? null,
            legacyCompatibilityApplied: eligibility.legacyCompatibilityApplied,
            sourceEvidence: eligibility.sourceEvidence,
          }
        : { note: "no reservation found — eligibility not computable" },
      reservationPaymentStatus: reservation?.paymentStatus || null,
      reservationInitialPaymentStatus: reservation?.initialPaymentStatus || null,
      reservationMoveInDate: reservation?.confirmedMoveInDate || reservation?.moveInDate || null,
    });
    console.error(`[phase3] ${contractNumber}: read complete`);
  }

  console.log(JSON.stringify(results, null, 2));

  console.error(`\n[phase3] Production reservations modified: 0`);
  console.error(`[phase3] Production contracts modified: 0`);
  console.error(`[phase3] Production PDFs generated: 0`);
  console.error(`[phase3] Tenant notifications sent: 0`);

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[phase3] script failed:", err);
  process.exit(1);
});
