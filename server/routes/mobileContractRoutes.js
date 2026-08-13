import express from "express";
import fs from "fs";
import mongoose from "mongoose";
import { toTenantContractView } from "../services/tenantContractViewService.js";
import { resolvePublishedFinalDocument } from "../services/contractPublicationService.js";
import { resolveTenantCanonicalContract } from "../services/tenantContractSelectionService.js";
import auditLogger from "../utils/auditLogger.js";
import {
  resolveCurrentPreparedDocument,
  selectCurrentPreparedDocument,
} from "../services/preparedContractDocumentService.js";
import { mobileTenantAuth as mobileTenant } from "../middleware/mobileTenantAuth.js";

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

router.get("/contracts/current", mobileTenant, asyncRoute(async (req, res) => {
  const contract = await ownedCurrentContract(req.mobileTenant._id);
  let preparedDocument = null;
  if (selectCurrentPreparedDocument(contract)) {
    preparedDocument = await resolveCurrentPreparedDocument(contract)
      .then((resolved) => resolved.document)
      .catch(() => null);
  }
  return res.json({
    contract: toTenantContractView(contract, new Date(), {
      preparedDocument,
      documentBasePath: "/api/m/contracts",
    }),
    state: contract ? "CONTRACT_AVAILABLE" : "NO_PUBLISHED_CONTRACT",
    emptyState: contract ? null : "Contract Not Available Yet",
  });
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
  const resolved = await resolvePublishedFinalDocument(contract);
  const download = req.query.download === "1";
  await auditLogger.logModification(
    req, "contract", contract._id, null, null,
    `${download ? "Downloaded" : "Previewed"} final Contract; channel=mobile; ` +
    `contract=${contract.contractNumber}; branch=${contract.branch}; tenant=${contract.tenantId}; ` +
    `sourceNotarizedVersion=${resolved.finalDocument.sourceVersion}; finalHash=${resolved.finalDocument.fileHash}`,
  );
  res.setHeader("Content-Type", resolved.finalDocument.mimeType);
  res.setHeader("Content-Length", resolved.finalDocument.fileSize);
  res.setHeader("Content-Disposition",
    `${download ? "attachment" : "inline"}; filename="${resolved.finalDocument.fileName.replaceAll('"', "")}"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Pragma", "no-cache");
  return fs.createReadStream(resolved.absolutePath).pipe(res);
}));

// Backward-compatible replacement for the former hard-coded mobile lease PDF.
router.get("/documents/contract", mobileTenant, asyncRoute(async (req, res) => {
  const contract = await ownedCurrentContract(req.mobileTenant._id);
  if (!contract) return res.status(404).json({ detail: "Contract is being prepared." });
  const { document, size, createReadStream } = await resolveCurrentPreparedDocument(contract);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Length", size);
  res.setHeader("Content-Disposition", `attachment; filename="${document.fileName.replaceAll('"', "")}"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Pragma", "no-cache");
  return createReadStream().pipe(res);
}));

export default router;
