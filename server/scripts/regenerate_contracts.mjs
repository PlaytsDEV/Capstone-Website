import dotenv from "dotenv";
dotenv.config();
import connectDB from "../config/database.js";
import { Contract } from "../models/index.js";
import { buildContractGenerationData } from "../services/contractGenerationDataService.js";
import { renderPreparedContractPdf } from "../services/contractPdfService.js";
import { removePrivateContractFile } from "../services/contractPrivateStorageService.js";
import { storePreparedContractDocument } from "../services/contractDocumentStorageService.js";
import { buildPreparedContractStorage } from "../services/contractPrivateStorageService.js";
import { PDFDocument } from "pdf-lib";

async function main() {
  await connectDB();
  const contracts = await Contract.find({
    status: { $in: ["generated", "awaiting_signatures", "partially_signed", "signed", "active"] },
  });
  console.log(`Found ${contracts.length} contracts to re-render.`);

  for (const contract of contracts) {
    try {
      const activeDoc = contract.preparedDocuments?.find((d) => !d.superseded);
      if (!activeDoc) continue;

      console.log(`Re-rendering contract: ${contract.contractNumber} (${contract.tenantLegalName})`);
      const generationData = await buildContractGenerationData(contract);
      const rendered = await renderPreparedContractPdf(generationData);

      const doc = await PDFDocument.load(rendered.bytes);
      const newPageCount = doc.getPageCount();
      console.log(`-> New Page Count: ${newPageCount}`);

      const target = buildPreparedContractStorage({
        contractId: String(contract._id),
        branch: contract.branch,
        year: contract.contractYear,
        contractNumber: contract.contractNumber,
        tenantLegalName: contract.tenantLegalName,
        roomType: contract.roomType,
        leaseType: contract.leaseType,
        contractDate: (generationData.lease?.executionDate || new Date()).toISOString().slice(0, 10),
        version: Number(activeDoc.version) || 1,
      });

      await removePrivateContractFile(target.absolutePath);

      const fileHash = (await import("crypto")).createHash("sha256").update(rendered.bytes).digest("hex");

      const storedResult = await storePreparedContractDocument({
        target,
        bytes: rendered.bytes,
        metadata: {
          contractId: contract._id,
          contractNumber: contract.contractNumber,
          documentType: "prepared",
          version: activeDoc.version,
          fileHash,
        },
      });

      activeDoc.pageCount = newPageCount;
      activeDoc.fileSize = rendered.bytes.length;
      activeDoc.storageKey = storedResult.storageKey;
      activeDoc.storageProvider = storedResult.provider;
      activeDoc.fileHash = fileHash;
      activeDoc.generatedAt = new Date();

      // Also ensure existing entries in preparedDocuments have valid fileHash if missing
      for (const d of contract.preparedDocuments || []) {
        if (!d.fileHash) d.fileHash = fileHash;
      }

      await contract.save();
      console.log(`✓ Successfully updated contract ${contract.contractNumber} to 1 page in storage & database.`);
    } catch (err) {
      console.error(`Error re-rendering contract ${contract.contractNumber}:`, err);
    }
  }

  process.exit(0);
}

main().catch(console.error);
