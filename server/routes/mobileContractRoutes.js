import express from "express";
import fs from "fs";
import fsPromises from "fs/promises";
import mongoose from "mongoose";
import Contract from "../models/Contract.js";
import { resolvePrivateContractStorageKey } from "../services/contractPrivateStorageService.js";
import { toTenantContractView } from "../services/tenantContractViewService.js";
import { resolvePublishedFinalDocument } from "../services/contractPublicationService.js";
import auditLogger from "../utils/auditLogger.js";
import {
  resolveCurrentPreparedDocument,
  selectCurrentPreparedDocument,
} from "../services/preparedContractDocumentService.js";

const router = express.Router();
const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

const mobileTenant = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : req.cookies?.session_token;
    if (!token) return res.status(401).json({ detail: "Not authenticated" });
    const session = await mongoose.connection.db.collection("user_sessions").findOne({
      session_token: token,
      expires_at: { $gt: new Date() },
    });
    if (!session?.user_id) return res.status(401).json({ detail: "Invalid or expired session" });
    const user = await mongoose.connection.db.collection("users").findOne({ user_id: session.user_id });
    if (!user || !["tenant", "applicant"].includes(user.role)) {
      return res.status(403).json({ detail: "Tenant Contract access denied" });
    }
    req.mobileTenant = user;
    req.user = {
      mongoId: user._id,
      email: user.email,
      role: user.role,
      branch: user.branch || "",
    };
    return next();
  } catch {
    return res.status(401).json({ detail: "Authentication error" });
  }
};

const ownedCurrentContract = (tenantId) =>
  Contract.findOne({ tenantId, isCurrent: true }).sort({ createdAt: -1 });

const streamPdf = async (res, storageKey, fileName, disposition = "inline") => {
  const absolutePath = resolvePrivateContractStorageKey(storageKey);
  const stat = await fsPromises.stat(absolutePath).catch(() => null);
  if (!stat?.isFile()) return res.status(404).json({ detail: "Contract document not found" });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Length", stat.size);
  res.setHeader("Content-Disposition", `${disposition}; filename="${fileName.replaceAll('"', "")}"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Pragma", "no-cache");
  return fs.createReadStream(absolutePath).pipe(res);
};

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
    emptyState: contract ? null : "Contract is being prepared.",
  });
}));

router.get("/contracts/:contractId/documents/prepared", mobileTenant, asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.contractId)) {
    return res.status(404).json({ detail: "Prepared Contract is not available" });
  }
  const contract = await Contract.findOne({ _id: req.params.contractId, tenantId: req.mobileTenant._id, isCurrent: true });
  if (!contract) return res.status(404).json({
    detail: "Contract not found.", code: "CONTRACT_NOT_FOUND",
  });
  const { document, absolutePath, stat } = await resolveCurrentPreparedDocument(contract);
  const disposition = req.query.download === "1" ? "attachment" : "inline";
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Length", stat.size);
  res.setHeader("Content-Disposition", `${disposition}; filename="${document.fileName.replaceAll('"', "")}"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Pragma", "no-cache");
  return fs.createReadStream(absolutePath).pipe(res);
}));

router.get("/contracts/:contractId/documents/final", mobileTenant, asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.contractId)) {
    return res.status(404).json({ detail: "Final Contract is not available" });
  }
  const contract = await Contract.findOne({
    _id: req.params.contractId,
    tenantId: req.mobileTenant._id,
    isCurrent: true,
    status: { $in: ["published", "active", "expiring_soon", "expired"] },
    notarizationVerifiedAt: { $ne: null },
    finalDocument: { $ne: null },
    tenantVisible: true,
  });
  if (!contract) return res.status(404).json({ detail: "Final Contract is not available" });
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
  const { document, absolutePath, stat } = await resolveCurrentPreparedDocument(contract);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Length", stat.size);
  res.setHeader("Content-Disposition", `attachment; filename="${document.fileName.replaceAll('"', "")}"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("Pragma", "no-cache");
  return fs.createReadStream(absolutePath).pipe(res);
}));

export default router;
