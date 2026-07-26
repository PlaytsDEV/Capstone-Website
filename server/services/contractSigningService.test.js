import { beforeEach, describe, expect, jest, test } from "@jest/globals";

const mkdir = jest.fn();
const writeFile = jest.fn();
const transitionContract = jest.fn(async (contract, status, actorId, reason) => {
  contract.status = status;
  contract.updatedBy = actorId;
  contract.statusHistory.push({ status, changedBy: actorId, reason });
  await contract.save();
  return contract;
});
await jest.unstable_mockModule("fs/promises", () => ({ default: { mkdir, writeFile } }));
await jest.unstable_mockModule("../models/index.js", () => ({ Contract: {} }));
await jest.unstable_mockModule("./contractService.js", () => ({ transitionContract }));

const {
  SIGNED_CONTRACT_MAX_BYTES,
  markContractPrinted,
  requiredSignaturesComplete,
  resolvePhysicalSigningStage,
  resolveSignedContractPath,
  updatePhysicalSignature,
  uploadSignedContract,
  validateSignedDocumentUpload,
  verifySignedContract,
  rejectSignedContract,
} = await import("./contractSigningService.js");

const doc = (changes = {}) => Object.assign({
  status: "generated",
  branch: "gil-puyat",
  contractYear: 2026,
  contractNumber: "TEST-CONTRACT-0001",
  generatedVersion: 1,
  printedAt: null,
  tenantSignatureStatus: "pending",
  lessorSignatureStatus: "pending",
  witnessSignatureStatus: "pending",
  signedDocuments: [],
  statusHistory: [],
  save: jest.fn().mockResolvedValue(undefined),
}, changes);
const pdf = (changes = {}) => Object.assign({
  originalname: "signed.pdf",
  mimetype: "application/pdf",
  buffer: Buffer.from("%PDF-1.7 signed"),
  size: 15,
}, changes);
const checklist = Object.fromEntries([
  "tenantSignatureVisible", "lessorSignatureVisible", "witnessesSatisfied",
  "contractNumberMatches", "tenantNameMatches", "allPagesComplete",
  "scanReadable", "preparedVersionMatches", "legalTextUnaltered",
].map((key) => [key, true]));

beforeEach(() => {
  mkdir.mockReset().mockResolvedValue(undefined);
  writeFile.mockReset().mockResolvedValue(undefined);
  transitionContract.mockClear();
});

describe("physical signing state", () => {
  test("generated Contract can be marked printed with actor and timestamp", async () => {
    const contract = doc();
    await markContractPrinted({ contract, actorId: "admin" });
    expect(contract.status).toBe("awaiting_signatures");
    expect(contract.printedBy).toBe("admin");
    expect(contract.printedAt).toBeInstanceOf(Date);
  });
  test.each(["draft", "incomplete"])("%s cannot be marked printed", async (status) => {
    await expect(markContractPrinted({ contract: doc({ status }), actorId: "admin" }))
      .rejects.toMatchObject({ code: "CONTRACT_NOT_READY_FOR_PRINTING" });
  });
  test.each([
    ["tenant", "tenantSignatureStatus"],
    ["lessor", "lessorSignatureStatus"],
    ["witnesses", "witnessSignatureStatus"],
  ])("%s signature completion produces partially_signed", async (signer, field) => {
    const contract = doc({ status: "awaiting_signatures", printedAt: new Date() });
    await updatePhysicalSignature({ contract, signer, value: "completed", actorId: "admin" });
    expect(contract[field]).toBe("completed");
    expect(contract.status).toBe("partially_signed");
  });
  test("witnesses may be not required and signatures may revert before verification", async () => {
    const contract = doc({ status: "awaiting_signatures", printedAt: new Date() });
    await updatePhysicalSignature({ contract, signer: "witnesses", value: "not_required", actorId: "admin" });
    expect(contract.witnessSignatureStatus).toBe("not_required");
    await updatePhysicalSignature({ contract, signer: "witnesses", value: "pending", actorId: "admin" });
    expect(contract.status).toBe("awaiting_signatures");
  });
  test("all signatures without verified upload remain partially signed", () => {
    const contract = doc({ printedAt: new Date(), tenantSignatureStatus: "completed", lessorSignatureStatus: "completed", witnessSignatureStatus: "completed" });
    expect(requiredSignaturesComplete(contract)).toBe(true);
    expect(resolvePhysicalSigningStage(contract)).toBe("partially_signed");
  });
  test("signature changes are blocked after signed", async () => {
    await expect(updatePhysicalSignature({
      contract: doc({ status: "signed" }), signer: "tenant", value: "pending", actorId: "admin",
    })).rejects.toMatchObject({ code: "CONTRACT_SIGNATURE_UPDATE_NOT_ALLOWED" });
  });
});

describe("signed document upload and versioning", () => {
  test("PDF, JPG, and PNG signatures are accepted", () => {
    expect(validateSignedDocumentUpload(pdf()).mimeType).toBe("application/pdf");
    expect(validateSignedDocumentUpload(pdf({
      originalname: "scan.jpg", mimetype: "image/jpeg",
      buffer: Buffer.from([0xff, 0xd8, 0xff, 0x01]), size: 4,
    })).mimeType).toBe("image/jpeg");
    expect(validateSignedDocumentUpload(pdf({
      originalname: "scan.png", mimetype: "image/png",
      buffer: Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1]), size: 9,
    })).mimeType).toBe("image/png");
  });
  test("invalid, oversized, and signature-mismatch files are rejected", () => {
    expect(() => validateSignedDocumentUpload(pdf({ buffer: Buffer.from("bad"), size: 3 })))
      .toThrow(expect.objectContaining({ code: "SIGNED_DOCUMENT_UNSUPPORTED_TYPE" }));
    expect(() => validateSignedDocumentUpload(pdf({ size: SIGNED_CONTRACT_MAX_BYTES + 1 })))
      .toThrow(expect.objectContaining({ code: "SIGNED_DOCUMENT_TOO_LARGE" }));
    expect(() => validateSignedDocumentUpload(pdf({ originalname: "fake.jpg" })))
      .toThrow(expect.objectContaining({ code: "SIGNED_DOCUMENT_TYPE_MISMATCH" }));
  });
  test("upload writes privately and does not automatically mark signed", async () => {
    const contract = doc({ status: "awaiting_signatures", printedAt: new Date() });
    const uploaded = await uploadSignedContract({ contract, file: pdf(), actorId: "admin" });
    expect(writeFile).toHaveBeenCalledWith(expect.stringContaining("signed-contracts"), expect.any(Buffer), { flag: "wx" });
    expect(uploaded.version).toBe(1);
    expect(uploaded.storageKey).not.toContain("..");
    expect(contract.status).toBe("partially_signed");
  });
  test("replacement requires reason and preserves superseded version", async () => {
    const contract = doc({ status: "partially_signed", printedAt: new Date() });
    await uploadSignedContract({ contract, file: pdf(), actorId: "admin" });
    await expect(uploadSignedContract({ contract, file: pdf(), actorId: "admin" }))
      .rejects.toMatchObject({ code: "SIGNED_DOCUMENT_REPLACEMENT_REASON_REQUIRED" });
    await uploadSignedContract({ contract, file: pdf(), actorId: "admin", replacementReason: "Clearer scan" });
    expect(contract.signedDocuments).toHaveLength(2);
    expect(contract.signedDocuments[0].superseded).toBe(true);
    expect(contract.signedDocuments[1].version).toBe(2);
  });
  test("path traversal is rejected", () => {
    expect(() => resolveSignedContractPath("../secret.pdf"))
      .toThrow(expect.objectContaining({ code: "INVALID_SIGNED_STORAGE_KEY" }));
  });
});

describe("verification and rejection", () => {
  const complete = () => doc({
    status: "partially_signed", printedAt: new Date(),
    tenantSignatureStatus: "completed", lessorSignatureStatus: "completed",
    witnessSignatureStatus: "not_required",
    signedStorageKey: "gil-puyat/2026/x/signed.pdf", signedDocumentVersion: 1,
    signedDocuments: [{ version: 1, superseded: false }],
  });
  test.each([
    ["tenant", { tenantSignatureStatus: "pending" }],
    ["lessor", { lessorSignatureStatus: "pending" }],
    ["witness", { witnessSignatureStatus: "pending" }],
  ])("verification requires %s signature", async (_name, changes) => {
    await expect(verifySignedContract({
      contract: Object.assign(complete(), changes), actorId: "admin", checklist,
    })).rejects.toMatchObject({ code: "REQUIRED_SIGNATURES_INCOMPLETE" });
  });
  test("verification requires an upload and complete checklist", async () => {
    await expect(verifySignedContract({
      contract: Object.assign(complete(), { signedStorageKey: null }), actorId: "admin", checklist,
    })).rejects.toMatchObject({ code: "SIGNED_DOCUMENT_REQUIRED" });
    await expect(verifySignedContract({
      contract: complete(), actorId: "admin", checklist: {},
    })).rejects.toMatchObject({ code: "SIGNED_DOCUMENT_CHECKLIST_INCOMPLETE" });
  });
  test("successful verification alone moves Contract to signed", async () => {
    const contract = complete();
    await verifySignedContract({ contract, actorId: "admin", notes: "Readable", checklist });
    expect(contract.status).toBe("signed");
    expect(contract.signingVerifiedAt).toBeInstanceOf(Date);
  });
  test("rejection preserves history, clears current file, and remains partial", async () => {
    const contract = complete();
    await rejectSignedContract({ contract, actorId: "admin", reason: "Blurry or unreadable" });
    expect(contract.status).toBe("partially_signed");
    expect(contract.signedDocuments[0]).toEqual(expect.objectContaining({
      superseded: true, rejectionReason: "Blurry or unreadable",
    }));
    expect(contract.signedStorageKey).toBeNull();
  });
});
