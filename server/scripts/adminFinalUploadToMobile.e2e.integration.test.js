// End-to-end proof that a pre-existing tenant whose wet-signed contract scan
// was uploaded through the legacy signedDocuments[]-only flow (before the
// auto-finalize-on-upload fix in uploadAndFinalizeNotarizedContract existed)
// is recovered by scripts/reconcileFinalContractUploads.mjs — becoming the
// canonical tenant-facing Final document, with no re-upload required.
//
// The "fresh upload is immediately final" behavior itself (single-action
// notarized upload -> canonical finalDocument -> byte-identical Web/Mobile
// retrieval) already has real end-to-end coverage in
// tenantContractDocumentResolver.e2e.integration.test.js (Scenario D), which
// drives the actual admin upload function
// (contractNotarizationService.uploadAndFinalizeNotarizedContract) through a
// fully generation-ready Contract. That coverage is not duplicated here.
//
// This exercises real Mongo (mongodb-memory-server) and the real filesystem
// signed-contracts storage root — nothing here is mocked — so it stands in
// for a browser-driven Admin Web + Mobile QA pass in an environment with no
// browser available.

import { afterAll, afterEach, beforeAll, describe, expect, test } from "@jest/globals";
import mongoose from "mongoose";
import fs from "fs/promises";
import { MongoMemoryServer } from "mongodb-memory-server";
import { Contract } from "../models/index.js";
import { SIGNED_CONTRACT_ROOT } from "../services/contractSigningService.js";
import { resolveTenantCanonicalContract } from "../services/tenantContractSelectionService.js";
import { toTenantContractView } from "../services/tenantContractViewService.js";
import { resolvePublishedFinalDocument } from "../services/contractPublicationService.js";
import { reconcileFinalContractUploads } from "./reconcileFinalContractUploads.mjs";

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri(), { dbName: "admin_final_upload_e2e" });
}, 60_000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod?.stop();
  await fs.rm(`${SIGNED_CONTRACT_ROOT}/gil-puyat`, { recursive: true, force: true }).catch(() => {});
}, 60_000);

afterEach(async () => {
  await Contract.deleteMany({});
});

const seedContract = async (overrides = {}) => {
  const tenantId = new mongoose.Types.ObjectId();
  const adminId = new mongoose.Types.ObjectId();
  const doc = new Contract({
    tenantId, createdBy: adminId, updatedBy: adminId,
    reservationId: new mongoose.Types.ObjectId(), roomId: new mongoose.Types.ObjectId(),
    branch: "gil-puyat", contractNumber: overrides.contractNumber || "E2E-0001",
    contractYear: 2026, contractSequence: 1,
    roomType: "private", leaseType: "long_term",
    propertyName: "Gil Puyat", propertyAddress: "123 St", roomNumber: "101",
    leaseStartDate: new Date("2026-09-01"), leaseEndDate: new Date("2027-09-01"),
    status: overrides.status || "awaiting_signatures",
  });
  await doc.save();
  return { contract: doc, tenantId, adminId };
};

const PDF_MIN = Buffer.concat([
  Buffer.from("%PDF-1.4\n"),
  Buffer.from("1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n"),
  Buffer.from("2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n"),
  Buffer.from("3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\n"),
  Buffer.from("trailer<</Root 1 0 R>>\n"),
  Buffer.from("%%EOF"),
]);

describe("Admin Web final upload -> canonical publication -> Mobile retrieval (Definition of Done)", () => {
  test("existing pre-fix tenant: an old signedDocuments-only record becomes retrievable via reconciliation, with no re-upload", async () => {
    const { contract, tenantId } = await seedContract({ contractNumber: "E2E-LEGACY-0001", status: "signed" });
    // Simulate a pre-fix admin upload: signedDocuments populated the old way,
    // with no finalDocument (exactly what the bug report described).
    const adminId = contract.createdBy;
    const storageKey = "gil-puyat/2026/E2E-LEGACY-0001/signed_v1.pdf";
    const absolute = `${SIGNED_CONTRACT_ROOT}/${storageKey}`;
    await fs.mkdir(absolute.slice(0, absolute.lastIndexOf("/")), { recursive: true });
    await fs.writeFile(absolute, PDF_MIN);
    contract.signedDocuments.push({
      version: 1, storageKey, fileName: "signed_v1.pdf", fileHash: "legacyhash",
      fileSize: PDF_MIN.length, mimeType: "application/pdf",
      uploadedAt: new Date("2026-07-01"), uploadedBy: adminId,
      preparedDocumentVersion: 1, superseded: false,
    });
    await contract.save();

    // Before reconciliation: mobile would still show "being prepared".
    const beforeView = toTenantContractView(
      await resolveTenantCanonicalContract(tenantId, { includeEarlyStages: true }),
      new Date(), { documentBasePath: "/api/m/contracts" },
    );
    expect(beforeView.tenantDocument.available).toBe(false);

    const report = await reconcileFinalContractUploads({ write: true, contractNumber: "E2E-LEGACY-0001" });
    expect(report.promoted).toBe(1);

    // What GET /api/m/contracts/current does, after reconciliation.
    const canonical = await resolveTenantCanonicalContract(tenantId, { includeEarlyStages: true });
    expect(String(canonical._id)).toBe(String(contract._id));
    const view = toTenantContractView(canonical, new Date(), { documentBasePath: "/api/m/contracts" });
    expect(view.tenantDocument.available).toBe(true);
    expect(view.tenantDocument.label).not.toMatch(/Preparing|Processing/i);
    expect(view.tenantDocument.viewUrl).toBe(`/api/m/contracts/${contract._id}/documents/final`);

    // What GET /api/m/contracts/:id/documents/final does.
    const resolved = await resolvePublishedFinalDocument(canonical);
    expect(resolved.finalDocument.mimeType).toBe("application/pdf");
    const streamedBytes = await new Promise((resolve, reject) => {
      const chunks = [];
      resolved.createReadStream()
        .on("data", (chunk) => chunks.push(chunk))
        .on("end", () => resolve(Buffer.concat(chunks)))
        .on("error", reject);
    });
    expect(streamedBytes.equals(PDF_MIN)).toBe(true);
  });
});
