import dotenv from "dotenv";
dotenv.config();
import connectDB from "../config/database.js";
import { Contract } from "../models/index.js";
import { renderContractHtmlPdf } from "../services/contractHtmlPdfService.js";
import { storePreparedContractDocument } from "../services/contractDocumentStorageService.js";
import { buildPreparedContractStorage, removePrivateContractFile } from "../services/contractPrivateStorageService.js";
import { PDFDocument } from "pdf-lib";
import crypto from "crypto";

async function main() {
  await connectDB();
  const contracts = await Contract.find({ status: "generated" });
  for (const contract of contracts) {
    if (!contract.preparedDocuments?.length) continue;
    const doc = contract.preparedDocuments[0];
    const duration = Number(doc.generationSnapshot?.fields?.leaseDurationNumber || contract.leaseDurationMonths || 12);
    const leaseType = duration < 6 ? "short-term" : "long-term";
    const roomType = String(contract.roomType || "double-sharing").toLowerCase().includes("quad")
      ? "quadruple-sharing"
      : String(contract.roomType || "").toLowerCase().includes("private")
      ? "private"
      : "double-sharing";
    const templateId = `${roomType}-${leaseType}`;

    const property = {
      branch: contract.branch,
      propertyName: contract.branch === "guadalupe" ? "LILYCREST GUADALUPE" : "LILYCREST GIL PUYAT",
      propertyAddress: contract.branch === "guadalupe"
        ? "9431 Magallanes Street, 1212 Makati, Metro Manila"
        : "#7 Gil Puyat Ave. corner Marconi St., Makati City",
    };
    const template = {
      templateId,
      roomType,
      leaseType,
    };
    const payload = {
      property,
      template,
      fields: doc.generationSnapshot?.fields || {},
    };
    const bytes = await renderContractHtmlPdf(payload);
    const pdf = await PDFDocument.load(bytes);

    const target = buildPreparedContractStorage({
      contractId: String(contract._id),
      branch: contract.branch,
      year: contract.contractYear,
      contractNumber: contract.contractNumber,
      tenantLegalName: contract.tenantLegalName,
      roomType: contract.roomType,
      leaseType: contract.leaseType,
      contractDate: "2026-08-28",
      version: Number(doc.version) || 1,
    });

    await removePrivateContractFile(target.absolutePath);
    const fileHash = crypto.createHash("sha256").update(bytes).digest("hex");
    const storedResult = await storePreparedContractDocument({
      target,
      bytes,
      metadata: {
        contractId: contract._id,
        contractNumber: contract.contractNumber,
        documentType: "prepared",
        version: doc.version,
        fileHash,
      },
    });

    doc.pageCount = pdf.getPageCount();
    doc.fileSize = bytes.length;
    doc.storageKey = storedResult.storageKey;
    doc.storageProvider = storedResult.provider;
    doc.fileHash = fileHash;
    doc.generatedAt = new Date();
    await contract.save();
    console.log(`✓ Updated ${contract.contractNumber} (${contract.tenantLegalName}) to pageCount: ${pdf.getPageCount()}`);
  }
  process.exit(0);
}

main().catch(console.error);
