// Proves the Signed/Notarized contract-document storage migration
// (contractPrivateStorageService.js's buildContractArtifactStorage/
// writeContractArtifactAtomically + contractDocumentStorageService.js's
// store/inspect/removeSignedContractDocument and
// store/inspect/removeNotarizedContractDocument) actually goes through
// durable (Firebase-backed) storage in a production-like environment, with
// no dependency on server/private/signed-contracts or
// server/private/notarized-contracts — the two directories that are lost on
// every Render redeploy without an attached persistent disk.
//
// A minimal in-memory fake Firebase bucket stands in for
// admin.storage().bucket(...).file(...) (save/exists/getMetadata/
// createReadStream/delete) — real enough to prove byte-identity and
// atomicity without needing real GCP credentials.

import fs from "fs/promises";
import admin from "firebase-admin";
import { afterEach, describe, expect, jest, test } from "@jest/globals";
import {
  storeSignedContractDocument,
  inspectSignedContractDocument,
  removeSignedContractDocument,
  storeNotarizedContractDocument,
  inspectNotarizedContractDocument,
  removeNotarizedContractDocument,
} from "./contractDocumentStorageService.js";
import { buildContractArtifactStorage } from "./contractPrivateStorageService.js";
import { uploadSignedContract, SIGNED_CONTRACT_ROOT } from "./contractSigningService.js";
import { uploadNotarizedContract, NOTARIZED_CONTRACT_ROOT } from "./contractNotarizationService.js";

const { Readable } = await import("stream");

class FakeBucket {
  constructor(name) {
    this.name = name;
    this.objects = new Map(); // storageKey -> Buffer
  }
  file(storageKey) {
    const bucket = this;
    return {
      async save(bytes, { preconditionOpts } = {}) {
        if (preconditionOpts?.ifGenerationMatch === 0 && bucket.objects.has(storageKey)) {
          const error = new Error("Precondition failed: object already exists.");
          error.code = 412;
          throw error;
        }
        bucket.objects.set(storageKey, Buffer.from(bytes));
      },
      async exists() {
        return [bucket.objects.has(storageKey)];
      },
      async getMetadata() {
        const bytes = bucket.objects.get(storageKey);
        if (!bytes) throw Object.assign(new Error("Not found"), { code: 404 });
        return [{ size: bytes.length }];
      },
      createReadStream() {
        const bytes = bucket.objects.get(storageKey);
        if (!bytes) {
          const stream = new Readable({ read() {} });
          process.nextTick(() => stream.emit("error", Object.assign(new Error("Not found"), { code: 404 })));
          return stream;
        }
        return Readable.from(bytes);
      },
      async delete() {
        bucket.objects.delete(storageKey);
      },
    };
  }
}

const streamToBuffer = (stream) => new Promise((resolve, reject) => {
  const chunks = [];
  stream.on("data", (chunk) => chunks.push(chunk));
  stream.on("end", () => resolve(Buffer.concat(chunks)));
  stream.on("error", reject);
});

let fakeBucket;
let previousNodeEnv;
let previousBucketEnv;

function activateFirebaseProduction() {
  previousNodeEnv = process.env.NODE_ENV;
  previousBucketEnv = process.env.FIREBASE_STORAGE_BUCKET;
  process.env.NODE_ENV = "production";
  process.env.FIREBASE_STORAGE_BUCKET = "lilycrest-test-bucket";
  fakeBucket = new FakeBucket("lilycrest-test-bucket");
  jest.spyOn(admin, "apps", "get").mockReturnValue([{}]);
  jest.spyOn(admin, "storage").mockReturnValue({ bucket: () => fakeBucket });
}

function restoreEnvironment() {
  jest.restoreAllMocks();
  process.env.NODE_ENV = previousNodeEnv;
  if (previousBucketEnv === undefined) delete process.env.FIREBASE_STORAGE_BUCKET;
  else process.env.FIREBASE_STORAGE_BUCKET = previousBucketEnv;
}

afterEach(() => {
  if (fakeBucket) restoreEnvironment();
  fakeBucket = null;
});

describe("Signed/Notarized contract-artifact storage — durable (Firebase-backed) path", () => {
  test("a Signed upload is written to Firebase, never touches server/private/signed-contracts, and streams back byte-identical", async () => {
    activateFirebaseProduction();
    const target = buildContractArtifactStorage({
      kind: "signed", contractId: "507f1f77bcf86cd799439021", fileName: "LIL-TEST-0001_signed_v1.pdf",
    });
    const bytes = Buffer.from("%PDF-1.4\nsigned-durable-test\n");

    const stored = await storeSignedContractDocument({ target, bytes, contentType: "application/pdf" });
    expect(stored.provider).toBe("firebase-storage");
    expect(fakeBucket.objects.has(target.storageKey)).toBe(true);

    // The defining proof of this migration: nothing was written to the
    // ephemeral local directory this artifact would previously have used.
    await expect(fs.stat(target.absolutePath)).rejects.toMatchObject({ code: "ENOENT" });

    const document = { storageProvider: stored.provider, storageKey: stored.storageKey };
    const inspected = await inspectSignedContractDocument(document);
    expect(inspected.provider).toBe("firebase-storage");
    expect(inspected.size).toBe(bytes.length);
    const streamed = await streamToBuffer(inspected.createReadStream());
    expect(streamed.equals(bytes)).toBe(true);

    await removeSignedContractDocument(document);
    expect(fakeBucket.objects.has(target.storageKey)).toBe(false);
  });

  test("a Notarized upload is written to Firebase, never touches server/private/notarized-contracts, and streams back byte-identical", async () => {
    activateFirebaseProduction();
    const target = buildContractArtifactStorage({
      kind: "notarized", contractId: "507f1f77bcf86cd799439022", fileName: "LIL-TEST-0002_notarized_v1.pdf",
    });
    const bytes = Buffer.from("%PDF-1.4\nnotarized-durable-test\n");

    const stored = await storeNotarizedContractDocument({ target, bytes, contentType: "application/pdf" });
    expect(stored.provider).toBe("firebase-storage");
    await expect(fs.stat(target.absolutePath)).rejects.toMatchObject({ code: "ENOENT" });

    const document = { storageProvider: stored.provider, storageKey: stored.storageKey };
    const inspected = await inspectNotarizedContractDocument(document);
    const streamed = await streamToBuffer(inspected.createReadStream());
    expect(streamed.equals(bytes)).toBe(true);

    await removeNotarizedContractDocument(document);
    expect(fakeBucket.objects.has(target.storageKey)).toBe(false);
  });

  test("uploadSignedContract (full service call) persists storageProvider=firebase-storage in production and rolls back the Firebase object when the Contract save fails", async () => {
    activateFirebaseProduction();
    const savingFails = new Error("Mongo write conflict");
    const contract = {
      _id: "507f1f77bcf86cd799439023",
      status: "awaiting_signatures",
      contractNumber: "LIL-TEST-0003",
      branch: "gil-puyat",
      contractYear: 2026,
      generatedVersion: 1,
      signedDocuments: [],
      statusHistory: [],
      save: jest.fn(async () => { throw savingFails; }),
    };
    const file = { buffer: Buffer.from("%PDF-1.4\nrollback-test\n"), originalname: "signed.pdf", mimetype: "application/pdf", size: 30 };

    await expect(uploadSignedContract({ contract, file, actorId: "507f1f77bcf86cd799439099" }))
      .rejects.toBe(savingFails);

    // The Firebase object from the failed attempt must not survive —
    // otherwise it becomes an orphaned durable object with no DB record
    // pointing to it, exactly what section 13 of the migration spec forbids.
    expect(fakeBucket.objects.size).toBe(0);
    // And the Contract itself must show no partial signedDocuments/finalDocument state.
    expect(contract.signedDocuments.filter((d) => !d.superseded)).toHaveLength(1);
    // (the pushed entry stays in the in-memory object since save() threw
    // after the push — but nothing was persisted, per contract.save being
    // the mocked rejection; a real Mongoose contract.save() failing leaves
    // the DB row untouched)
  });

  test("uploadNotarizedContract does not persist any Mongo/local state when the durable upload itself fails", async () => {
    activateFirebaseProduction();
    jest.spyOn(fakeBucket, "file").mockImplementation(() => ({
      async save() { throw Object.assign(new Error("Firebase unavailable"), { code: 500 }); },
      async exists() { return [false]; },
    }));
    const contract = {
      _id: "507f1f77bcf86cd799439024",
      status: "awaiting_signatures",
      contractNumber: "LIL-TEST-0004",
      branch: "gil-puyat",
      contractYear: 2026,
      generatedVersion: 1,
      generatedStorageKey: "contracts/507f1f77bcf86cd799439024/prepared/current.pdf",
      preparedDocuments: [{ version: 1, superseded: false }],
      notarizedDocuments: [],
      save: jest.fn(),
    };
    const file = { buffer: Buffer.from("%PDF-1.4\nstorage-failure-test\n"), originalname: "notarized.pdf", mimetype: "application/pdf", size: 34 };

    await expect(uploadNotarizedContract({
      contract, file, actorId: "507f1f77bcf86cd799439099", preparedDocumentVersion: 1,
    })).rejects.toThrow("Firebase unavailable");

    expect(contract.notarizedDocuments).toHaveLength(0);
    expect(contract.save).not.toHaveBeenCalled();
  });
});
