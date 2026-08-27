import mongoose from "mongoose";
import { assertStagingWriteTarget } from "./stagingWriteGuard.js";

import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { PDFDocument } from "pdf-lib";
import { Contract } from "../models/index.js";
import { canAutoFinalize, advanceStatusToPublished } from "../services/contractSigningService.js";
import { inspectSignedContractDocument } from "../services/contractDocumentStorageService.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const streamToBuffer = (stream) => new Promise((resolve, reject) => {
  const chunks = [];
  stream.on("data", (chunk) => chunks.push(chunk));
  stream.on("end", () => resolve(Buffer.concat(chunks)));
  stream.on("error", reject);
});

const pageCountForInspected = async (inspected, mimeType) => {
  if (mimeType !== "application/pdf") return 1;
  const bytes = await streamToBuffer(inspected.createReadStream());
  return (await PDFDocument.load(bytes, { updateMetadata: false })).getPageCount();
};

export async function reconcileFinalContractUploads(options = {}) {
  const { write = false, contractNumber = null } = options;

  const query = {
    finalDocument: null,
    "signedDocuments.0": { $exists: true },
  };

  if (contractNumber) {
    query.contractNumber = contractNumber;
  }

  const contracts = await Contract.find(query);

  const report = {
    scanned: contracts.length,
    eligible: 0,
    promoted: 0,
    skipped: 0,
    errors: [],
    details: [],
  };

  for (const contract of contracts) {
    try {
      if (!canAutoFinalize(contract)) {
        report.skipped++;
        report.details.push({
          contractNumber: contract.contractNumber,
          status: contract.status,
          action: "skipped_not_eligible",
        });
        continue;
      }

      const activeSignedDocs = (contract.signedDocuments || []).filter(
        (doc) => !doc.superseded && !doc.rejectedAt,
      );

      const latestSignedDoc = activeSignedDocs.length > 0
        ? activeSignedDocs[activeSignedDocs.length - 1]
        : contract.signedDocuments[contract.signedDocuments.length - 1];

      if (!latestSignedDoc) {
        report.skipped++;
        continue;
      }

      report.eligible++;

      // Never manufacture publication metadata for a missing/corrupt legacy
      // artifact. A successful storage inspection is the proof that the
      // exact bytes referenced by signedDocuments[] still exist and are safe
      // to promote into finalDocument.
      const inspected = await inspectSignedContractDocument(latestSignedDoc);
      if (!inspected || Number(inspected.size) !== Number(latestSignedDoc.fileSize)) {
        throw Object.assign(new Error("Legacy signed Contract artifact is unavailable or has a size mismatch."), {
          code: "LEGACY_SIGNED_ARTIFACT_UNAVAILABLE",
        });
      }
      const pageCount = await pageCountForInspected(
        inspected,
        latestSignedDoc.mimeType || "application/pdf",
      );

      const publisherId = latestSignedDoc.uploadedBy || contract.updatedBy || contract.createdBy;
      const now = new Date();

      contract.finalDocument = {
        storageKey: latestSignedDoc.storageKey,
        fileName: latestSignedDoc.fileName,
        fileHash: latestSignedDoc.fileHash,
        fileSize: latestSignedDoc.fileSize,
        mimeType: latestSignedDoc.mimeType || "application/pdf",
        pageCount: pageCount || 1,
        sourceType: "admin_scan",
        sourceVersion: latestSignedDoc.version,
        sourceUploadedAt: latestSignedDoc.uploadedAt || now,
        sourceVerifiedAt: null,
        sourceVerifiedBy: null,
        publishedAt: now,
        publishedBy: publisherId,
        tenantVisible: true,
      };

      contract.tenantVisible = true;
      advanceStatusToPublished(contract, publisherId, "Reconciled legacy admin-scan upload to final document");

      if (write) {
        await contract.save();
      }

      report.promoted++;
      report.details.push({
        contractNumber: contract.contractNumber,
        status: contract.status,
        action: write ? "promoted_and_saved" : "promoted_dry_run",
      });
    } catch (err) {
      report.errors.push({
        contractNumber: contract.contractNumber,
        error: err.message,
      });
    }
  }

  return report;
}

// CLI entry point
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  dotenv.config({ path: path.resolve(__dirname, "../.env") });
  assertStagingWriteTarget(process.env, { toolName: "reconcileFinalContractUploads.mjs" });
  const shouldWrite = process.argv.includes("--write");
  const contractArg = process.argv.find((arg) => arg.startsWith("--contract="));
  const contractNumber = contractArg ? contractArg.split("=")[1] : null;

  if (!mongoose.connection.readyState) {
    await mongoose.connect(process.env.MONGODB_URI);
  }

  console.log(`🔍 Reconciling final contract uploads (write=${shouldWrite})...`);
  const report = await reconcileFinalContractUploads({ write: shouldWrite, contractNumber });
  console.log("📊 Reconciliation Report:", JSON.stringify(report, null, 2));

  await mongoose.disconnect();
}
