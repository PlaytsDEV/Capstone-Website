import mongoose from "mongoose";
import logger from "../middleware/logger.js";
import { Contract } from "../models/index.js";
import { transitionContract } from "./contractService.js";
import { notify } from "./notifications/notificationService.js";

/**
 * ============================================================================
 * RENEWAL EFFECTIVE-DATE ACTIVATION
 * ============================================================================
 * A renewal successor Contract is created FINAL-but-not-yet-effective
 * (status "published" once wet-signed, isCurrent: false) by
 * createSuccessorContractForRenewal/autoGenerateRenewalContract, and stays
 * that way — visible as "upcoming" via
 * tenantContractSelectionService.resolveTenantUpcomingContract — until its
 * leaseStartDate actually arrives. This is the one function that flips both
 * sides of the transition at that moment:
 *
 *   successor:   published -> active,   isCurrent: false -> true
 *   predecessor: active    -> replaced, isCurrent: true  -> false
 *
 * Idempotent: the query only matches contracts still at "published", so a
 * contract already activated by a previous run is never matched again.
 * Intended to be invoked by a scheduled job (server/utils/scheduler.js) and
 * is DB-connection-agnostic so it can also run from a test/manual trigger.
 * ============================================================================
 */
export async function activateDueRenewalContracts({ now = new Date() } = {}) {
  const report = { scanned: 0, activated: 0, errors: 0, records: [] };

  const due = await Contract.find({
    status: "published",
    contractPurpose: "renewal",
    leaseStartDate: { $lte: now },
    finalDocument: { $ne: null },
  }).select("_id contractNumber").sort({ leaseStartDate: 1 }).lean();
  report.scanned = due.length;

  for (const { _id: contractId, contractNumber } of due) {
    const entry = { contractId: String(contractId), contractNumber };
    const session = await mongoose.startSession();
    // Re-fetch fresh inside the transaction (not reused from the `due` scan
    // above) — session.withTransaction() automatically retries this
    // callback on a transient transaction error, and Mongoose document
    // mutations (statusHistory.push, etc.) live in JS memory, not just the
    // DB: mutating a document fetched OUTSIDE the callback would double-
    // apply on retry even though the DB-side write of the aborted attempt
    // is rolled back. Fetching inside means every attempt starts clean.
    let outcome = null;
    let notifyTarget = null;
    try {
      await session.withTransaction(async () => {
        const successor = await Contract.findById(contractId).session(session);
        if (!successor || successor.status !== "published") {
          // Already handled by a concurrent/earlier retry attempt.
          outcome = { activated: false };
          return;
        }
        const predecessor = successor.replacesContractId
          ? await Contract.findById(successor.replacesContractId).session(session)
          : null;

        successor.isCurrent = true;
        await transitionContract(
          successor,
          "active",
          successor.updatedBy || successor.createdBy,
          "Renewal effective date reached; successor Contract activated",
          session,
        );

        let predecessorId = null;
        if (predecessor && predecessor.status === "active") {
          predecessor.supersededByContractId = successor._id;
          await transitionContract(
            predecessor,
            "replaced",
            successor.updatedBy || successor.createdBy,
            `Superseded by renewal successor Contract ${successor.contractNumber}`,
            session,
          );
          predecessorId = String(predecessor._id);
        }

        outcome = {
          activated: true,
          predecessorId,
          tenantId: successor.tenantId,
          roomNumber: successor.roomNumber,
        };
      });

      if (outcome?.activated) {
        report.activated += 1;
        entry.outcome = "ACTIVATED";
        entry.predecessorId = outcome.predecessorId;
        notifyTarget = outcome;
      } else {
        entry.outcome = "SKIPPED_ALREADY_ACTIVE";
      }
    } catch (activationError) {
      report.errors += 1;
      entry.outcome = "ERROR";
      entry.error = activationError.message;
      logger.error(
        { err: activationError, contractId },
        "[RenewalActivation] Failed to activate renewal successor Contract",
      );
    } finally {
      await session.endSession();
    }

    if (notifyTarget) {
      try {
        await notify.renewalEffective(notifyTarget.tenantId, notifyTarget.roomNumber, contractId);
      } catch (notifyError) {
        entry.notifyError = notifyError.message;
        logger.warn(
          { err: notifyError, contractId },
          "[RenewalActivation] Tenant notification failed (non-fatal)",
        );
      }
    }

    report.records.push(entry);
  }

  return report;
}
