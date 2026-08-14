import logger from "../middleware/logger.js";
import { Contract, Reservation, Room, User } from "../models/index.js";
import { notify } from "../utils/notificationService.js";
import {
  createDraftContract,
  createReplacementContractForTransfer,
  transitionContract,
  validateContractForGeneration,
} from "./contractService.js";
import { generatePreparedContractPdf } from "./contractPdfService.js";

/**
 * Automatically creates and generates a prepared PDF contract when a tenant
 * moves in (status: 'moveIn').
 *
 * Runs asynchronously to prevent blocking the check-in HTTP response.
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.reservationId
 * @param {string|mongoose.Types.ObjectId} params.actorId
 * @returns {Promise<{ success: boolean, contractId?: string, error?: string }>}
 */
export async function autoGenerateMoveInContract({ reservationId, actorId }) {
  try {
    const reservation = await Reservation.findById(reservationId).lean();
    if (!reservation) {
      logger.warn({ reservationId }, "[AutoContract] Move-in contract skipped: Reservation not found");
      return { success: false, error: "RESERVATION_NOT_FOUND" };
    }

    let contract = await Contract.findOne({
      reservationId: reservation._id,
      isCurrent: true,
    });

    if (!contract) {
      logger.info({ reservationId: reservation._id }, "[AutoContract] Creating initial draft for Move-In");
      contract = await createDraftContract({
        reservationId: reservation._id,
        stayId: reservation.currentStayId || null,
        actorId,
        allowedBranch: null,
      });
    }

    if (["draft", "incomplete", "ready_for_generation"].includes(contract.status)) {
      if (contract.status !== "ready_for_generation") {
        const validation = await validateContractForGeneration(contract);
        if (validation.valid) {
          await transitionContract(contract, "ready_for_generation", actorId, "Contract auto-validated for PDF generation");
          Object.assign(contract, validation.generationData.pricing);
          contract.templateType = validation.template.templateId;
          contract.templateVersion = validation.template.templateVersion;
          contract.legalContentVersion = validation.template.legalContentVersion;
          contract.validatedGenerationData = validation.generationData;
          contract.lastValidatedAt = new Date();
          contract.updatedBy = actorId;
          await contract.save();
        } else {
          logger.warn(
            { contractId: contract._id, missing: validation.missingFields, errors: validation.errors },
            "[AutoContract] Contract validation incomplete; draft created for administrator review",
          );

          try {
            const tenant = await User.findById(contract.tenantId).select("firstName lastName email").lean();
            const tenantName = tenant ? `${tenant.firstName} ${tenant.lastName}`.trim() : contract.tenantLegalName || "Tenant";
            const missingSummary = validation.missingFields.map((f) => f.label).join(", ")
              || validation.errors.map((e) => e.message).join(", ")
              || "additional information";
            await notifyBranchAdminsSafe(
              contract.branch,
              "contract_incomplete",
              "Contract Needs Information Before It Can Be Generated",
              `Move-in contract for ${tenantName} (Room ${contract.roomNumber}) could not be auto-generated: missing ${missingSummary}. Complete it in the Contracts workspace.`,
              { entityType: "contract", entityId: String(contract._id), actionUrl: "/admin/contracts" },
            );
          } catch (notifErr) {
            logger.warn({ err: notifErr }, "[AutoContract] Incomplete-contract notification error (non-fatal)");
          }

          return {
            success: true,
            contractId: String(contract._id),
            contractNumber: contract.contractNumber,
            status: contract.status,
            incomplete: true,
          };
        }
      }

      logger.info({ contractId: contract._id, contractNumber: contract.contractNumber }, "[AutoContract] Generating prepared PDF on Move-In");
      const result = await generatePreparedContractPdf({
        contractId: contract._id,
        actorId,
        regenerationReason: "Auto-generated upon Move-In confirmation",
      });

      try {
        const tenant = await User.findById(contract.tenantId).select("firstName lastName email").lean();
        const tenantName = tenant ? `${tenant.firstName} ${tenant.lastName}`.trim() : contract.tenantLegalName || "Tenant";
        notifyBranchAdminsSafe(
          contract.branch,
          "contract_prepared",
          "Prepared Contract Ready for Signing",
          `Move-in contract for ${tenantName} (Room ${contract.roomNumber}) was auto-generated and is ready to print.`,
          { entityType: "contract", entityId: String(contract._id), actionUrl: "/admin/contracts" },
        );
      } catch (notifErr) {
        logger.warn({ err: notifErr }, "[AutoContract] Post-generation notification error (non-fatal)");
      }

      return { success: true, contractId: String(result.contract._id), contractNumber: result.contract.contractNumber };
    }

    logger.info({ contractId: contract._id, status: contract.status }, "[AutoContract] Contract already progressed beyond draft stage");
    return { success: true, contractId: String(contract._id), status: contract.status };
  } catch (error) {
    logger.error({ err: error, reservationId }, "[AutoContract] Failed to auto-generate Move-In contract");
    try {
      const reservation = await Reservation.findById(reservationId).select("roomId").populate("roomId", "branch").lean();
      const branch = reservation?.roomId?.branch || "";
      notifyBranchAdminsSafe(
        branch,
        "contract_error",
        "Contract Auto-Generation Alert",
        `Move-in contract auto-generation encountered an issue: ${error.message || "Unknown error"}. Review required in Contracts workspace.`,
        { entityType: "reservation", entityId: String(reservationId), actionUrl: "/admin/contracts" },
      );
    } catch (alertErr) {
      // Non-fatal
    }
    return { success: false, error: error.message, code: error.code };
  }
}

/**
 * Automatically supersedes the old contract and generates a full replacement
 * contract when a tenant transfers rooms (transferStayWorkflow).
 *
 * @param {Object} params
 * @param {string|mongoose.Types.ObjectId} params.reservationId
 * @param {Object} params.activeStay
 * @param {Object} params.targetRoom
 * @param {Object} params.targetBed
 * @param {Date} [params.effectiveTransferDate]
 * @param {string|mongoose.Types.ObjectId} params.actorId
 * @returns {Promise<{ success: boolean, replacementContractId?: string, error?: string }>}
 */
export async function autoGenerateTransferContract({
  reservationId,
  activeStay,
  targetRoom,
  targetBed = {},
  effectiveTransferDate = new Date(),
  actorId,
}) {
  try {
    const oldContract = await Contract.findOne({
      reservationId,
      isCurrent: true,
    }).sort({ version: -1, createdAt: -1 });

    let replacementContract;
    if (oldContract) {
      logger.info(
        { oldContractId: oldContract._id, oldContractNumber: oldContract.contractNumber },
        "[AutoContract] Creating replacement contract for room transfer",
      );
      replacementContract = await createReplacementContractForTransfer({
        reservationId,
        stayId: activeStay?._id || oldContract.stayId,
        oldContract,
        targetRoom,
        targetBed,
        effectiveTransferDate,
        actorId,
      });
    } else {
      logger.info({ reservationId }, "[AutoContract] No previous current contract found; creating fresh draft for target room");
      replacementContract = await createDraftContract({
        reservationId,
        stayId: activeStay?._id || null,
        actorId,
      });
    }

    if (replacementContract.status !== "ready_for_generation") {
      const validation = await validateContractForGeneration(replacementContract);
      if (validation.valid) {
        await transitionContract(replacementContract, "ready_for_generation", actorId, "Transfer replacement contract auto-validated");
        Object.assign(replacementContract, validation.generationData.pricing);
        replacementContract.templateType = validation.template.templateId;
        replacementContract.templateVersion = validation.template.templateVersion;
        replacementContract.legalContentVersion = validation.template.legalContentVersion;
        replacementContract.validatedGenerationData = validation.generationData;
        replacementContract.lastValidatedAt = new Date();
        replacementContract.updatedBy = actorId;
        await replacementContract.save();
      } else {
        logger.warn(
          { contractId: replacementContract._id, missing: validation.missingFields, errors: validation.errors },
          "[AutoContract] Transfer contract validation incomplete; draft created for administrator review",
        );
        return {
          success: true,
          replacementContractId: String(replacementContract._id),
          contractNumber: replacementContract.contractNumber,
          status: replacementContract.status,
          incomplete: true,
        };
      }
    }

    logger.info(
      { contractId: replacementContract._id, contractNumber: replacementContract.contractNumber },
      "[AutoContract] Generating prepared PDF for room transfer replacement contract",
    );
    const result = await generatePreparedContractPdf({
      contractId: replacementContract._id,
      actorId,
      regenerationReason: `Auto-generated replacement for Room Transfer to Room ${targetRoom.roomNumber || targetRoom.name}`,
    });

    try {
      const tenant = await User.findById(replacementContract.tenantId).select("firstName lastName").lean();
      const tenantName = tenant ? `${tenant.firstName} ${tenant.lastName}`.trim() : replacementContract.tenantLegalName || "Tenant";
      notifyBranchAdminsSafe(
        replacementContract.branch,
        "contract_prepared",
        "Room Transfer Contract Ready",
        `Replacement contract for ${tenantName} (Room ${replacementContract.roomNumber}) was auto-generated and is ready for signing.`,
        { entityType: "contract", entityId: String(replacementContract._id), actionUrl: "/admin/contracts" },
      );
    } catch (notifErr) {
      logger.warn({ err: notifErr }, "[AutoContract] Post-transfer notification error (non-fatal)");
    }

    return {
      success: true,
      replacementContractId: String(result.contract._id),
      contractNumber: result.contract.contractNumber,
    };
  } catch (error) {
    logger.error({ err: error, reservationId }, "[AutoContract] Failed to auto-generate Transfer contract");
    try {
      notifyBranchAdminsSafe(
        targetRoom?.branch || "",
        "contract_error",
        "Transfer Contract Auto-Generation Alert",
        `Room transfer contract auto-generation encountered an issue: ${error.message || "Unknown error"}. Review required in Contracts workspace.`,
        { entityType: "reservation", entityId: String(reservationId), actionUrl: "/admin/contracts" },
      );
    } catch (alertErr) {
      // Non-fatal
    }
    return { success: false, error: error.message, code: error.code };
  }
}

async function notifyBranchAdminsSafe(branch, type, title, message, options = {}) {
  try {
    const { notifyBranchAdmins } = await import("./notifications/notificationService.js");
    await notifyBranchAdmins(branch, type, title, message, options);
  } catch (e) {
    // Non-fatal notification failure
  }
}
