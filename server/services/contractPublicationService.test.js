import fs from "fs/promises";
import path from "path";
import { PDFDocument } from "pdf-lib";
import { jest } from "@jest/globals";
import {
  PUBLICATION_CHECKLIST_KEYS,
  markContractReadyForPublication,
  publishFinalContract,
  resolveContractDisplayLifecycle,
  resolvePublishedFinalDocument,
} from "./contractPublicationService.js";
import {
  NOTARIZED_CONTRACT_ROOT,
  resolveNotarizedContractPath,
} from "./contractNotarizationService.js";

const storageKey = "publication-tests/LC-TEST/final-source-v1.pdf";
const absolutePath = resolveNotarizedContractPath(storageKey);
const actorId = "507f1f77bcf86cd799439011";
const tenantId = "507f1f77bcf86cd799439012";

const makePdf = async () => {
  const pdf = await PDFDocument.create();
  pdf.addPage([612, 936]);
  const bytes = Buffer.from(await pdf.save());
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  await fs.writeFile(absolutePath, bytes);
  return bytes;
};

const contract = (status = "notarized", extras = {}) => ({
  _id: "507f1f77bcf86cd799439013",
  tenantId,
  contractNumber: "LC-TEST",
  branch: "gil_puyat",
  roomId: "507f1f77bcf86cd799439014",
  roomNumber: "301",
  bedLabel: "Upper",
  leaseStartDate: new Date("2026-08-01"),
  leaseEndDate: new Date("2027-01-31"),
  status,
  generatedVersion: 1,
  preparedDocuments: [{ version: 1, superseded: false, storageKey: "prepared.pdf" }],
  notarizedDocumentVersion: 1,
  notarizedStorageKey: storageKey,
  notarizedFileHash: "hash-1",
  notarizationVerifiedAt: new Date("2026-07-20"),
  notarizedDocuments: [{
    version: 1,
    storageKey,
    fileName: "signed-notarized.pdf",
    fileHash: "hash-1",
    fileSize: extras.fileSize || 1,
    mimeType: "application/pdf",
    uploadedAt: new Date("2026-07-19"),
    verifiedAt: new Date("2026-07-20"),
    verifiedBy: actorId,
    preparedDocumentVersion: 1,
    superseded: false,
    rejectedAt: null,
  }],
  statusHistory: [],
  save: jest.fn().mockResolvedValue(undefined),
  ...extras,
});
const checklist = Object.fromEntries(PUBLICATION_CHECKLIST_KEYS.map((key) => [key, true]));

beforeAll(async () => {
  await makePdf();
});
afterAll(async () => fs.rm(path.join(NOTARIZED_CONTRACT_ROOT, "publication-tests"), {
  recursive: true, force: true,
}));

describe("final Contract publication", () => {
  let bytes;
  beforeAll(async () => { bytes = await fs.readFile(absolutePath); });

  test("verified notarized Contract becomes ready, but unverified does not", async () => {
    const item = contract("notarized");
    item.notarizedDocuments[0].fileSize = bytes.length;
    await markContractReadyForPublication({ contract: item, actorId });
    expect(item.status).toBe("ready_for_publication");
    expect(item.readyForPublicationBy).toBe(actorId);
    const unverified = contract("notarized", { notarizationVerifiedAt: null });
    unverified.notarizedDocuments[0].fileSize = bytes.length;
    unverified.notarizedDocuments[0].verifiedAt = null;
    await expect(markContractReadyForPublication({ contract: unverified, actorId }))
      .rejects.toMatchObject({ code: "VERIFIED_NOTARIZED_DOCUMENT_REQUIRED" });
  });

  test("rejected, superseded, and missing notarized sources are blocked", async () => {
    for (const mutation of [
      (item) => { item.notarizedDocuments[0].rejectedAt = new Date(); },
      (item) => { item.notarizedDocuments[0].superseded = true; },
      (item) => { item.notarizedDocuments = []; },
    ]) {
      const item = contract();
      item.notarizedDocuments[0].fileSize = bytes.length;
      mutation(item);
      await expect(markContractReadyForPublication({ contract: item, actorId })).rejects.toBeTruthy();
    }
  });

  test("publication requires every checklist item", async () => {
    const item = contract("ready_for_publication");
    item.notarizedDocuments[0].fileSize = bytes.length;
    await expect(publishFinalContract({ contract: item, actorId, checklist: {} }))
      .rejects.toMatchObject({ code: "PUBLICATION_CHECKLIST_INCOMPLETE" });
  });

  test("publishes an immutable snapshot of the verified notarized source", async () => {
    const item = contract("ready_for_publication");
    item.notarizedDocuments[0].fileSize = bytes.length;
    await publishFinalContract({ contract: item, actorId, checklist, notes: "Reviewed." });
    expect(item.status).toBe("published");
    expect(item.tenantVisible).toBe(true);
    expect(item.finalStorageKey).toBe(storageKey);
    expect(item.finalDocument).toMatchObject({
      sourceType: "notarized",
      sourceVersion: 1,
      fileHash: "hash-1",
      fileName: "signed-notarized.pdf",
      tenantVisible: true,
      publishedBy: actorId,
    });
    const resolved = await resolvePublishedFinalDocument(item);
    expect(resolved.size).toBe(bytes.length);
    const streamed = await new Promise((resolve, reject) => {
      const chunks = [];
      resolved.createReadStream()
        .on("data", (chunk) => chunks.push(chunk))
        .on("end", () => resolve(Buffer.concat(chunks)))
        .on("error", reject);
    });
    expect(streamed.equals(bytes)).toBe(true);
    await expect(publishFinalContract({ contract: item, actorId, checklist }))
      .rejects.toMatchObject({ code: "CONTRACT_NOT_READY_FOR_PUBLICATION" });
  });

  test("read-time lifecycle separates publication from lease dates", () => {
    const item = contract("published");
    expect(resolveContractDisplayLifecycle(item, new Date("2026-07-27")).key).toBe("published_future");
    expect(resolveContractDisplayLifecycle(item, new Date("2026-10-01")).key).toBe("active");
    expect(resolveContractDisplayLifecycle(item, new Date("2027-01-15")).key).toBe("expiring_soon");
    expect(resolveContractDisplayLifecycle(item, new Date("2027-02-01")).key).toBe("expired");
    expect(item.status).toBe("published");
  });

  // Regression for a real production record (finalDocument metadata intact,
  // sourceType "admin_scan", but the backing signedDocuments[] file was
  // gone from storage): resolvePublishedFinalDocument previously collapsed
  // this into a generic 409 CURRENT_SIGNED_DOCUMENT_UNAVAILABLE, the same
  // code used for superseded/rejected/hash-mismatch cases. That made it
  // impossible for a client to distinguish "this record is broken, contact
  // support" from "the file is specifically missing, replace it" — the
  // distinction items 34/35 of the contract-lifecycle audit require.
  test("an admin_scan final document backed by a missing storage file surfaces a distinct 410, not the generic 409", async () => {
    const item = contract("published", {
      finalStorageKey: "signed-missing/does-not-exist.pdf",
      finalDocument: {
        storageKey: "signed-missing/does-not-exist.pdf",
        fileName: "does-not-exist.pdf",
        fileHash: "hash-missing",
        fileSize: 1,
        mimeType: "application/pdf",
        pageCount: 1,
        sourceType: "admin_scan",
        sourceVersion: 1,
        sourceUploadedAt: new Date("2026-08-01"),
        publishedAt: new Date("2026-08-01"),
        publishedBy: actorId,
        tenantVisible: true,
      },
      signedDocuments: [{
        version: 1,
        storageProvider: "local",
        storageKey: "signed-missing/does-not-exist.pdf",
        fileName: "does-not-exist.pdf",
        fileHash: "hash-missing",
        fileSize: 1,
        mimeType: "application/pdf",
        uploadedAt: new Date("2026-08-01"),
        uploadedBy: actorId,
        preparedDocumentVersion: 1,
        superseded: false,
      }],
      tenantVisible: true,
    });
    await expect(resolvePublishedFinalDocument(item)).rejects.toMatchObject({
      code: "FINAL_DOCUMENT_STORAGE_MISSING",
      statusCode: 410,
    });
  });
});
