import { describe, expect, it } from "@jest/globals";
import {
  resolveOwnSignedScan,
  resolveSignedScanForContract,
} from "./signedContractScanResolver.js";

const adminScanFinalDoc = (version = 1) => ({
  fileName: `LIL-GP-2026-00091_signed_v${version}.pdf`,
  mimeType: "application/pdf",
  sourceType: "admin_scan",
  sourceVersion: version,
  storageKey: `contracts/final/scan-v${version}.pdf`,
});

const signedDoc = (version, { superseded = false, rejectedAt = null } = {}) => ({
  version,
  fileName: `LIL-GP-2026-00091_signed_v${version}.pdf`,
  mimeType: "application/pdf",
  storageKey: `contracts/signed/scan-v${version}.pdf`,
  uploadedAt: new Date(2026, 0, version).toISOString(),
  superseded,
  rejectedAt,
});

describe("resolveOwnSignedScan", () => {
  it("returns null for a nullish contract", () => {
    expect(resolveOwnSignedScan(null)).toBeNull();
  });

  it("returns null for a generated Draft with no scan", () => {
    expect(
      resolveOwnSignedScan({ _id: "c1", contractPurpose: "initial", status: "generated" }),
    ).toBeNull();
  });

  it("returns the admin_scan finalDocument identity", () => {
    const out = resolveOwnSignedScan({
      _id: "c1",
      contractNumber: "LIL-GP-2026-00091",
      finalDocument: adminScanFinalDoc(1),
    });
    expect(out).toMatchObject({
      contractId: "c1",
      contractNumber: "LIL-GP-2026-00091",
      version: 1,
      fileName: "LIL-GP-2026-00091_signed_v1.pdf",
      source: "admin_scan",
    });
  });

  it("returns the newest non-superseded, non-rejected signedDocuments[] entry", () => {
    const out = resolveOwnSignedScan({
      _id: "c1",
      contractNumber: "LIL-GP-2026-00091",
      signedDocuments: [
        signedDoc(1, { superseded: true }),
        signedDoc(2, { rejectedAt: new Date().toISOString() }),
        signedDoc(3),
      ],
    });
    expect(out).toMatchObject({ version: 3, source: "signed_document" });
  });

  it("ignores signed docs with no stored file", () => {
    const out = resolveOwnSignedScan({
      _id: "c1",
      signedDocuments: [{ version: 1, fileName: "x.pdf" /* no storageKey */ }],
    });
    expect(out).toBeNull();
  });
});

describe("resolveSignedScanForContract — lineage walk", () => {
  it("Draft-only current contract -> null (Signed Scan unavailable)", async () => {
    const out = await resolveSignedScanForContract(
      { _id: "c1", contractPurpose: "initial", status: "generated" },
      { loadContractById: async () => null },
    );
    expect(out).toBeNull();
  });

  it("current contract with an admin_scan finalDocument -> available, not inherited", async () => {
    const out = await resolveSignedScanForContract(
      {
        _id: "c1",
        contractNumber: "LIL-GP-2026-00091",
        contractPurpose: "initial",
        finalDocument: adminScanFinalDoc(1),
      },
      { loadContractById: async () => null },
    );
    expect(out).toMatchObject({
      contractId: "c1",
      version: 1,
      source: "admin_scan",
      inherited: false,
      inheritedFromContractId: null,
    });
  });

  it("Room Transfer Addendum + original signed lease -> inherited scan from the original", async () => {
    const original = {
      _id: "lease1",
      contractNumber: "LIL-GP-2026-00091",
      contractPurpose: "initial",
      finalDocument: adminScanFinalDoc(1),
    };
    const addendum = {
      _id: "add1",
      contractNumber: "LIL-GP-2026-00091-A1",
      contractPurpose: "amendment",
      replacesContractId: "lease1",
      parentContractId: "lease1",
    };
    const out = await resolveSignedScanForContract(addendum, {
      loadContractById: async (id) => (String(id) === "lease1" ? original : null),
    });
    expect(out).toMatchObject({
      contractId: "lease1",
      version: 1,
      source: "admin_scan",
      inherited: true,
      inheritedFromContractId: "lease1",
      inheritedFromContractNumber: "LIL-GP-2026-00091",
    });
  });

  it("walks two levels (Addendum #2 -> Addendum #1 -> original)", async () => {
    const original = { _id: "lease1", contractNumber: "L1", contractPurpose: "initial", finalDocument: adminScanFinalDoc(1) };
    const add1 = { _id: "add1", contractPurpose: "amendment", replacesContractId: "lease1", parentContractId: "lease1" };
    const add2 = { _id: "add2", contractPurpose: "amendment", replacesContractId: "add1", parentContractId: "lease1" };
    const db = { lease1: original, add1, add2 };
    const out = await resolveSignedScanForContract(add2, {
      loadContractById: async (id) => db[String(id)] || null,
    });
    expect(out).toMatchObject({ contractId: "lease1", inherited: true });
  });

  it("an `initial`/`renewal` contract with no scan of its own does NOT inherit", async () => {
    const out = await resolveSignedScanForContract(
      { _id: "r1", contractPurpose: "renewal", replacesContractId: "lease1", parentContractId: "lease1" },
      { loadContractById: async () => ({ _id: "lease1", contractPurpose: "initial", finalDocument: adminScanFinalDoc(1) }) },
    );
    expect(out).toBeNull();
  });

  it("no signed scan anywhere in the lineage -> null (clean empty state)", async () => {
    const original = { _id: "lease1", contractPurpose: "initial", status: "generated" };
    const addendum = { _id: "add1", contractPurpose: "amendment", replacesContractId: "lease1" };
    const out = await resolveSignedScanForContract(addendum, {
      loadContractById: async (id) => (String(id) === "lease1" ? original : null),
    });
    expect(out).toBeNull();
  });

  it("is cycle-safe if replacesContractId points back into the chain", async () => {
    const a = { _id: "a", contractPurpose: "amendment", replacesContractId: "b" };
    const b = { _id: "b", contractPurpose: "amendment", replacesContractId: "a" };
    const db = { a, b };
    const out = await resolveSignedScanForContract(a, {
      loadContractById: async (id) => db[String(id)] || null,
    });
    expect(out).toBeNull();
  });

  it("legacy `replacement` purpose also inherits", async () => {
    const original = { _id: "lease1", contractNumber: "L1", contractPurpose: "initial", finalDocument: adminScanFinalDoc(2) };
    const legacy = { _id: "rep1", contractPurpose: "replacement", replacesContractId: "lease1" };
    const out = await resolveSignedScanForContract(legacy, {
      loadContractById: async (id) => (String(id) === "lease1" ? original : null),
    });
    expect(out).toMatchObject({ contractId: "lease1", inherited: true, source: "admin_scan" });
  });

  it("a REPLACEMENT signed scan on the current contract wins (newest version, not inherited)", async () => {
    const out = await resolveSignedScanForContract(
      {
        _id: "c1",
        contractNumber: "L1",
        contractPurpose: "initial",
        signedDocuments: [signedDoc(1, { superseded: true }), signedDoc(2)],
      },
      { loadContractById: async () => null },
    );
    expect(out).toMatchObject({ contractId: "c1", version: 2, inherited: false });
  });
});
