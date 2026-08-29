import express from "express";
import mongoose from "mongoose";
import { toTenantContractView } from "../services/tenantContractViewService.js";
import { resolvePublishedFinalDocument } from "../services/contractPublicationService.js";
import {
  resolveTenantCanonicalContract,
  resolveTenantUpcomingContract,
} from "../services/tenantContractSelectionService.js";
import { getOpenScheduledRoomTransferForReservation } from "../services/scheduledRoomTransferView.js";
import auditLogger from "../utils/auditLogger.js";
import logger from "../middleware/logger.js";
import {
  resolveCurrentPreparedDocument,
  selectCurrentPreparedDocument,
} from "../services/preparedContractDocumentService.js";
import { inspectSignedContractDocument } from "../services/contractDocumentStorageService.js";
import { resolveTenantContractDocument } from "../services/tenantContractDocumentResolver.js";
import { mobileTenantAuth as mobileTenant } from "../middleware/mobileTenantAuth.js";
import {
  acknowledgeContract,
  getAcknowledgementStatus,
  getAcknowledgementStatusForContract,
} from "../services/contractAcknowledgementService.js";

const router = express.Router();
const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

// Session validation (expiry, account-restriction, securityVersion
// revocation) now lives in one place — middleware/mobileTenantAuth.js —
// instead of being duplicated inline here. See that file's header comment
// for why. Local alias keeps every `mobileTenant` call site below unchanged.

// Mobile must show the tenant's authoritative Contract starting from draft,
// not only once it reaches "generated"/signed/published — unlike the Web "My
// Contract" page (contractController.js getMyCurrentContract), which keeps
// the default (early-stage-excluded) behavior intentionally.
const ownedCurrentContract = (tenantId) =>
  resolveTenantCanonicalContract(tenantId, { includeEarlyStages: true });

const resolveMobileFinalDocument = async (contract) => {
  if (contract?.finalDocument) {
    const resolved = await resolvePublishedFinalDocument(contract);
    return {
      document: resolved.finalDocument,
      size: resolved.finalDocument.fileSize,
      sourceVersion: resolved.finalDocument.sourceVersion,
      createReadStream: resolved.createReadStream,
    };
  }
  const canonicalDocument = resolveTenantContractDocument(contract);
  if (canonicalDocument.type !== "final_signed") {
    throw Object.assign(new Error("Final Contract is unavailable."), {
      code: "FINAL_DOCUMENT_UNAVAILABLE",
      statusCode: 404,
    });
  }
  const inspected = await inspectSignedContractDocument(canonicalDocument.document);
  return {
    document: canonicalDocument.document,
    size: inspected.size || canonicalDocument.document.fileSize,
    sourceVersion: canonicalDocument.version,
    createReadStream: inspected.createReadStream,
  };
};

router.get("/contracts/current", mobileTenant, asyncRoute(async (req, res) => {
  // Contract lifecycle changes are authoritative server state. Prevent an
  // intermediary or platform cache from pinning a generated draft after an
  // admin has uploaded a newer signed/final copy.
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Pragma", "no-cache");
  const contract = await ownedCurrentContract(req.mobileTenant._id);
  let preparedDocument = null;
  let preparedDocumentIssue = null;
  if (selectCurrentPreparedDocument(contract)) {
    try {
      const resolved = await resolveCurrentPreparedDocument(contract);
      preparedDocument = resolved?.document || null;
    } catch (error) {
      logger.warn(
        { err: error, contractId: contract?._id, tenantId: req.mobileTenant?._id },
        "Mobile contract prepared document resolution failed (non-fatal)",
      );
      preparedDocumentIssue = error.code || "PREPARED_DOCUMENT_UNAVAILABLE";
    }
  }
  // Same resolveTenantUpcomingContract used by the web endpoint
  // (contractController.js getMyCurrentContract) — no mobile-only renewal/
  // transfer logic.
  let upcomingView = null;
  if (contract) {
    try {
      const upcomingContract = await resolveTenantUpcomingContract(req.mobileTenant._id);
      if (upcomingContract) {
        let upcomingPrepared = null;
        if (selectCurrentPreparedDocument(upcomingContract)) {
          try {
            upcomingPrepared = (await resolveCurrentPreparedDocument(upcomingContract))?.document || null;
          } catch {
            // Non-fatal — upcoming view still returns without a prepared document
          }
        }
        upcomingView = toTenantContractView(upcomingContract, new Date(), {
          preparedDocument: upcomingPrepared,
          documentBasePath: "/api/m/contracts",
        });
      }
    } catch (error) {
      logger.warn({ err: error, tenantId: req.mobileTenant?._id }, "Mobile upcoming contract resolution failed (non-fatal)");
    }
  }

  // Canonical acknowledgement state (draft or final) embedded in the same
  // payload — identical shape to the web endpoint; mobile keeps its
  // standalone GET .../acknowledgement for live refetch.
  let acknowledgement = null;
  if (contract) {
    try {
      acknowledgement = await getAcknowledgementStatusForContract(contract, req.mobileTenant._id);
    } catch (error) {
      logger.warn({ err: error, contractId: contract?._id }, "Mobile acknowledgement resolution failed (non-fatal)");
    }
  }

  // Upcoming Room Transfer (mobile) — same canonical serializer as web; no
  // mobile-only calculation. Display-only; current room/rent stay source.
  let scheduledRoomTransfer = null;
  if (contract?.reservationId) {
    try {
      scheduledRoomTransfer = await getOpenScheduledRoomTransferForReservation(contract.reservationId);
    } catch (error) {
      logger.warn({ err: error, tenantId: req.mobileTenant?._id }, "Mobile scheduled room transfer resolution failed (non-fatal)");
    }
  }

  return res.json({
    contract: toTenantContractView(contract, new Date(), {
      preparedDocument,
      preparedDocumentIssue,
      acknowledgement,
      documentBasePath: "/api/m/contracts",
    }),
    state: contract ? "CONTRACT_AVAILABLE" : "NO_PUBLISHED_CONTRACT",
    emptyState: contract ? null : "Contract Not Available Yet",
    upcoming: upcomingView,
    scheduledRoomTransfer,
  });
}));

router.post("/contracts/:contractId/acknowledge", mobileTenant, asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.contractId)) {
    return res.status(404).json({ detail: "Contract not found.", code: "CONTRACT_NOT_FOUND" });
  }
  const contract = await ownedCurrentContract(req.mobileTenant._id);
  if (!contract || String(contract._id) !== String(req.params.contractId)) {
    return res.status(404).json({ detail: "Contract not found.", code: "CONTRACT_NOT_FOUND" });
  }
  const record = await acknowledgeContract({
    contractId: contract._id,
    tenantId: req.mobileTenant._id,
    req,
  });
  return res.json({
    acknowledged: true,
    acknowledgedAt: record.acknowledgedAt,
    documentVersion: record.documentVersion,
  });
}));

router.get("/contracts/:contractId/acknowledgement", mobileTenant, asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.contractId)) {
    return res.status(404).json({ detail: "Contract not found.", code: "CONTRACT_NOT_FOUND" });
  }
  const contract = await ownedCurrentContract(req.mobileTenant._id);
  if (!contract || String(contract._id) !== String(req.params.contractId)) {
    return res.status(404).json({ detail: "Contract not found.", code: "CONTRACT_NOT_FOUND" });
  }
  const status = await getAcknowledgementStatus({ contractId: contract._id, tenantId: req.mobileTenant._id });
  return res.json(status);
}));

router.get("/contracts/:contractId/documents/prepared", mobileTenant, asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.contractId)) {
    return res.status(404).json({ detail: "Prepared Contract is not available" });
  }
  const contract = await ownedCurrentContract(req.mobileTenant._id);
  if (!contract || String(contract._id) !== String(req.params.contractId)) {
    return res.status(404).json({
    detail: "Contract not found.", code: "CONTRACT_NOT_FOUND",
  });
  }
  const { document, size, createReadStream } = await resolveCurrentPreparedDocument(contract);
  const disposition = req.query.download === "1" ? "attachment" : "inline";
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Length", size);
  res.setHeader("Content-Disposition", `${disposition}; filename="${document.fileName.replaceAll('"', "")}"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Pragma", "no-cache");
  return createReadStream().pipe(res);
}));

router.get("/contracts/:contractId/documents/final", mobileTenant, asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.contractId)) {
    return res.status(404).json({ detail: "Final Contract is not available" });
  }
  const contract = await ownedCurrentContract(req.mobileTenant._id);
  if (!contract || String(contract._id) !== String(req.params.contractId)) {
    return res.status(404).json({ detail: "Final Contract is not available" });
  }
  const resolved = await resolveMobileFinalDocument(contract);
  const download = req.query.download === "1";
  await auditLogger.logModification(
    req, "contract", contract._id, null, null,
    `${download ? "Downloaded" : "Previewed"} final Contract; channel=mobile; ` +
    `contract=${contract.contractNumber}; branch=${contract.branch}; tenant=${contract.tenantId}; ` +
    `sourceVersion=${resolved.sourceVersion}; finalHash=${resolved.document.fileHash}`,
  );
  res.setHeader("Content-Type", resolved.document.mimeType || "application/pdf");
  if (resolved.size) res.setHeader("Content-Length", resolved.size);
  res.setHeader("Content-Disposition",
    `${download ? "attachment" : "inline"}; filename="${resolved.document.fileName.replaceAll('"', "")}"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Pragma", "no-cache");
  return resolved.createReadStream().pipe(res);
}));

router.get("/contracts/:contractId/documents/signed/:version", mobileTenant, asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.contractId)) {
    return res.status(404).json({ detail: "Signed Contract is not available" });
  }
  const requestedVersion = Number(req.params.version);
  if (!Number.isSafeInteger(requestedVersion) || requestedVersion < 1) {
    return res.status(404).json({ detail: "Signed Contract is not available" });
  }
  const contract = await ownedCurrentContract(req.mobileTenant._id);
  if (!contract || String(contract._id) !== String(req.params.contractId)) {
    return res.status(404).json({ detail: "Signed Contract is not available" });
  }
  const resolvedDocument = resolveTenantContractDocument(contract);
  if (
    resolvedDocument.type !== "final_signed" ||
    Number(resolvedDocument.version) !== requestedVersion
  ) {
    return res.status(404).json({ detail: "Signed Contract is not available" });
  }
  const inspected = await inspectSignedContractDocument(resolvedDocument.document);
  const download = req.query.download === "1";
  const mimeType = resolvedDocument.document.mimeType || "application/pdf";
  const size = inspected.size || resolvedDocument.document.fileSize;
  res.setHeader("Content-Type", mimeType);
  if (size) res.setHeader("Content-Length", size);
  res.setHeader(
    "Content-Disposition",
    `${download ? "attachment" : "inline"}; filename="${resolvedDocument.fileName.replaceAll('"', "")}"`,
  );
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Pragma", "no-cache");
  return inspected.createReadStream().pipe(res);
}));

// Backward-compatible replacement for the former hard-coded mobile lease PDF.
router.get("/documents/contract", mobileTenant, asyncRoute(async (req, res) => {
  const contract = await ownedCurrentContract(req.mobileTenant._id);
  if (!contract) return res.status(404).json({ detail: "Contract is being prepared." });

  // Stream the final document whenever one exists — an admin_scan (wet-signed
  // upload) finalDocument is final on upload. The canonical resolver also
  // recognizes one strict legacy signed-only compatibility tier. Never catch
  // a missing final artifact and fall back to an older prepared draft: the
  // 410 storage error must reach Mobile so it can show recovery guidance.
  const tenantDocument = resolveTenantContractDocument(contract);
  if (["final_notarized", "final_signed"].includes(tenantDocument.type)) {
    const resolved = await resolveMobileFinalDocument(contract);
    const download = req.query.download === "1";
    res.setHeader("Content-Type", resolved.document.mimeType || "application/pdf");
    if (resolved.size) res.setHeader("Content-Length", resolved.size);
    res.setHeader("Content-Disposition", `${download ? "attachment" : "inline"}; filename="${resolved.document.fileName.replaceAll('"', "")}"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Pragma", "no-cache");
    return resolved.createReadStream().pipe(res);
  }

  // Otherwise stream the current prepared draft
  const { document, size, createReadStream } = await resolveCurrentPreparedDocument(contract);
  const disposition = req.query.download === "1" ? "attachment" : "inline";
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Length", size);
  res.setHeader("Content-Disposition", `${disposition}; filename="${document.fileName.replaceAll('"', "")}"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Pragma", "no-cache");
  return createReadStream().pipe(res);
}));

export default router;
