import mongoose from "mongoose";
import dotenv from "dotenv";
import { Contract, User } from "../models/index.js";
import auditLogger from "../utils/auditLogger.js";
import { resetPreparedTestDocuments } from "../services/contractPreparedDocumentCleanupService.js";
import { generatePreparedContractPdf } from "../services/contractPdfService.js";

dotenv.config();

const contractNumber = process.argv[2];
const confirmed = process.argv.includes("--confirm-reset-and-regenerate");
if (!contractNumber || !confirmed) {
  throw new Error(
    "Usage: node scripts/reset_test_contract_prepared_pdf.mjs <contract-number> --confirm-reset-and-regenerate",
  );
}
if (process.env.NODE_ENV === "production") {
  throw new Error("This maintenance command is disabled in production.");
}

await mongoose.connect(process.env.MONGODB_URI);
try {
  const contract = await Contract.findOne({ contractNumber });
  if (!contract) throw new Error(`Contract ${contractNumber} was not found.`);
  const owner = await User.findOne({ role: "owner" }).select("_id role branch email").lean();
  if (!owner) throw new Error("An owner account is required for this reset.");
  const before = contract.toObject();
  const reason = "Aligned LESSEE and LESSOR signature table 3.0.3 clean Version 1 regeneration";
  const reset = await resetPreparedTestDocuments({
    contractId: contract._id,
    actorRole: owner.role,
    actorId: owner._id,
    reason,
  });
  const resetSnapshot = reset.contract.toObject();
  await auditLogger.logModification(
    {
      user: {
        email: owner.email,
        mongoId: owner._id,
        role: owner.role,
        branch: owner.branch || "",
      },
      headers: { "user-agent": "contract-maintenance-script" },
      ip: "local-maintenance",
    },
    "contract",
    contract._id,
    before,
    resetSnapshot,
    `Reset prepared test documents: ${reason}`,
  );
  const generated = await generatePreparedContractPdf({
    contractId: contract._id,
    actorId: owner._id,
  });
  const fresh = await Contract.findById(contract._id).lean();
  await auditLogger.logModification(
    {
      user: {
        email: owner.email,
        mongoId: owner._id,
        role: owner.role,
        branch: owner.branch || "",
      },
      headers: { "user-agent": "contract-maintenance-script" },
      ip: "local-maintenance",
    },
    "contract",
    contract._id,
    resetSnapshot,
    fresh,
    "Generated corrected typography prepared Contract Version 1",
  );
  console.log(JSON.stringify({
    reset: reset.report,
    generated: {
      status: fresh.status,
      version: generated.document.version,
      preparedDocumentCount: fresh.preparedDocuments.length,
      coordinateVersion: generated.document.coordinateVersion,
      templateVersion: generated.document.templateVersion,
      executionDate: fresh.executionDate,
      storageKey: generated.document.storageKey,
      fileHash: generated.document.fileHash,
    },
  }, null, 2));
} finally {
  await mongoose.disconnect();
}
