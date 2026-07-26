import mongoose from "mongoose";
import dotenv from "dotenv";
import { Contract, User } from "../models/index.js";
import auditLogger from "../utils/auditLogger.js";
import { resetPreparedTestDocuments } from "../services/contractPreparedDocumentCleanupService.js";

dotenv.config();
if (!process.argv.includes("--confirm-new-official-v1-migration")) {
  throw new Error("Explicit migration confirmation is required.");
}
if (process.env.NODE_ENV === "production") {
  throw new Error("Run this controlled migration in a maintenance environment.");
}

await mongoose.connect(process.env.MONGODB_URI);
try {
  const owner = await User.findOne({ role: "owner" }).select("_id role branch email").lean();
  if (!owner) throw new Error("An owner account is required.");
  const contracts = await Contract.find({});
  const report = { archivedLegalRecords: [], resetUnsignedContracts: [] };
  for (let contract of contracts) {
    const legal = Boolean(
      contract.signedStorageKey || contract.notarizedStorageKey ||
      contract.finalStorageKey || contract.signingVerifiedAt ||
      contract.notarizationVerifiedAt ||
      ["signed", "awaiting_notarization", "notarized", "published", "active"].includes(contract.status),
    );
    if (legal) {
      contract.isCurrent = false;
      contract.status = "archived";
      contract.statusHistory.push({
        status: "archived", changedBy: owner._id,
        reason: "Archived historical legal Contract during official-template replacement",
      });
      await contract.save();
      report.archivedLegalRecords.push(contract.contractNumber);
      continue;
    }
    const before = contract.toObject();
    if ((contract.preparedDocuments?.length || 0) > 0) {
      await resetPreparedTestDocuments({
        contractId: contract._id,
        actorRole: owner.role,
        actorId: owner._id,
        reason: "Replace obsolete unsigned generated copy with new official template Version 1",
      });
      contract = await Contract.findById(contract._id);
    }
    contract.status = "incomplete";
    contract.applicationId = contract.reservationId;
    contract.templateVersion = "1.0.0";
    contract.legalContentVersion = "2026-07-27";
    contract.validatedGenerationData = null;
    contract.lastValidatedAt = null;
    contract.pricingApprovalId = null;
    contract.pricingApprovedBy = null;
    contract.pricingApprovedAt = null;
    if (
      Number.isFinite(Number(contract.regularMonthlyRate)) &&
      Number.isFinite(Number(contract.approvedMonthlyRate))
    ) {
      contract.discountAmount = Math.max(
        0,
        Number(contract.regularMonthlyRate) - Number(contract.approvedMonthlyRate),
      );
    }
    contract.updatedBy = owner._id;
    contract.statusHistory.push({
      status: "incomplete", changedBy: owner._id,
      reason: "New official Version 1 template requires approved legal pricing review",
    });
    await contract.save();
    await auditLogger.logModification(
      {
        user: { email: owner.email, mongoId: owner._id, role: owner.role, branch: owner.branch || "" },
        headers: { "user-agent": "official-template-migration" },
        ip: "local-maintenance",
      },
      "contract", contract._id, before, contract.toObject(),
      "Template replaced; obsolete unsigned Contract deleted; pricing reapproval required",
    );
    report.resetUnsignedContracts.push(contract.contractNumber);
  }
  console.log(JSON.stringify(report, null, 2));
} finally {
  await mongoose.disconnect();
}
