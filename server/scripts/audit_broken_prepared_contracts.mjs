import mongoose from "mongoose";
import dotenv from "dotenv";
import { Contract } from "../models/index.js";
import {
  resolveCurrentPreparedDocument,
  selectCurrentPreparedDocument,
} from "../services/preparedContractDocumentService.js";
import { validateContractForGeneration } from "../services/contractService.js";

dotenv.config();

const contractNumber = process.argv.find((argument) =>
  argument.startsWith("--contract="))?.split("=").slice(1).join("=") || "";
if (process.argv.some((argument) => ["--write", "--apply", "--repair"].includes(argument))) {
  throw new Error(
    "This command is intentionally dry-run only. Use the audited admin Regenerate Prepared Copy action for repairs.",
  );
}
if (!process.env.MONGODB_URI) throw new Error("MONGODB_URI is required.");

await mongoose.connect(process.env.MONGODB_URI);
try {
  const query = {
    status: { $in: [
      "generated", "awaiting_signatures", "partially_signed", "signed",
      "awaiting_notarization", "notarized", "ready_for_publication",
      "published", "active", "expiring_soon", "expired",
    ] },
    ...(contractNumber ? { contractNumber } : {}),
  };
  const contracts = await Contract.find(query).sort({ createdAt: 1 });
  const report = [];
  for (const contract of contracts) {
    const current = selectCurrentPreparedDocument(contract);
    let issue = null;
    if (!current) {
      issue = "PREPARED_DOCUMENT_METADATA_MISSING";
    } else {
      await resolveCurrentPreparedDocument(contract).catch((error) => {
        issue = error.code || "PREPARED_DOCUMENT_UNAVAILABLE";
      });
    }
    if (!issue) continue;
    const validation = await validateContractForGeneration(contract).catch((error) => ({
      valid: false,
      missingFields: [],
      error: error.code || error.message,
    }));
    report.push({
      contractId: String(contract._id),
      contractNumber: contract.contractNumber,
      currentStatus: contract.status,
      preparedDocumentRecordFound: Boolean(current),
      storageFileFound: false,
      storageProvider: current?.storageProvider || "legacy-local",
      detectedIssue: issue,
      regenerationPossible:
        ["ready_for_generation", "generated"].includes(contract.status)
        && validation.valid === true,
      missingRequiredData: validation.missingFields || [],
      proposedRepairAction:
        contract.status === "generated" && validation.valid
          ? "Use the admin Regenerate Prepared Copy action."
          : "Correct the reported data or workflow state before regeneration.",
    });
  }
  process.stdout.write(`${JSON.stringify({
    dryRun: true,
    scanned: contracts.length,
    broken: report.length,
    contracts: report,
  }, null, 2)}\n`);
} finally {
  await mongoose.disconnect();
}
