import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";

const BUCKET = "lilycrest-test.firebasestorage.app";

function downloadUrlFor(path, bucket = BUCKET) {
  return `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(path)}?alt=media&token=test-token`;
}

function ownPath(userId, suffix = "government_id/1700-id.jpg") {
  return `tenant-documents/${userId}/${suffix}`;
}

function fakeUsersCollection({ findOneResult = null, updateOneResult = { matchedCount: 1, modifiedCount: 1 } } = {}) {
  return {
    findOne: jest.fn().mockResolvedValue(findOneResult),
    updateOne: jest.fn().mockResolvedValue(updateOneResult),
  };
}

function fakeReservationsCollection(findOneResult = null) {
  return { findOne: jest.fn().mockResolvedValue(findOneResult) };
}

describe("mobileUserDocumentService", () => {
  let usersCol;
  let reservationsCol;
  let mockDownload;
  let mockFileDelete;
  let mockFile;
  let mockBucket;

  function mockFirebaseModule() {
    jest.unstable_mockModule("../config/firebase.js", () => ({
      getFirebaseStorage: () => mockBucket,
      resolveFirebaseStorageBucket: () => BUCKET,
    }));
  }

  function mockMongoose() {
    jest.unstable_mockModule("mongoose", () => ({
      default: {
        connection: {
          db: {
            collection: (name) => (name === "users" ? usersCol : reservationsCol),
          },
        },
      },
    }));
  }

  beforeEach(async () => {
    jest.resetModules();
    usersCol = fakeUsersCollection();
    reservationsCol = fakeReservationsCollection();
    mockDownload = jest.fn();
    mockFileDelete = jest.fn().mockResolvedValue(undefined);
    mockFile = jest.fn(() => ({ download: mockDownload, delete: mockFileDelete }));
    mockBucket = { file: mockFile };

    mockMongoose();
    mockFirebaseModule();
  });

  afterEach(() => {
    jest.resetModules();
  });

  async function loadService() {
    return import("./mobileUserDocumentService.js");
  }

  // ── Upload / metadata registration ──────────────────────────────────────

  test("uploadUserDocument rejects a non-Firebase downloadUrl", async () => {
    const { uploadUserDocument } = await loadService();
    const result = await uploadUserDocument({ user_id: "tenant-a" }, {
      type: "government_id", downloadUrl: "https://evil.example.com/x.pdf",
      mimeType: "application/pdf", storagePath: "uploads/x.pdf", provider: "firebase-storage",
    });
    expect(result.error).toMatch(/Firebase Storage/);
    expect(usersCol.updateOne).not.toHaveBeenCalled();
  });

  test("uploadUserDocument rejects a disallowed mime type", async () => {
    const { uploadUserDocument } = await loadService();
    const result = await uploadUserDocument({ user_id: "tenant-a" }, {
      type: "government_id", downloadUrl: "https://firebasestorage.googleapis.com/v0/b/x/o/y",
      mimeType: "application/zip", storagePath: "uploads/x.zip", provider: "firebase-storage",
    });
    expect(result.error).toMatch(/image or PDF/);
  });

  test("uploadUserDocument rejects a file over the 5 MB limit", async () => {
    const { uploadUserDocument } = await loadService();
    const result = await uploadUserDocument({ user_id: "tenant-a" }, {
      type: "government_id", downloadUrl: "https://firebasestorage.googleapis.com/v0/b/x/o/y",
      mimeType: "application/pdf", storagePath: "uploads/x.pdf", provider: "firebase-storage",
      size: 6 * 1024 * 1024,
    });
    expect(result.error).toMatch(/too large/);
  });

  test("uploadUserDocument rejects an invalid document type", async () => {
    const { uploadUserDocument } = await loadService();
    const result = await uploadUserDocument({ user_id: "tenant-a" }, { type: "not_a_type" });
    expect(result.error).toMatch(/Invalid document type/);
  });

  test("uploadUserDocument accepts a valid Firebase-hosted PDF whose storagePath is genuinely the tenant's own object", async () => {
    const { uploadUserDocument } = await loadService();
    const path = ownPath("tenant-a");
    const result = await uploadUserDocument({ user_id: "tenant-a" }, {
      type: "government_id", label: "My ID",
      downloadUrl: downloadUrlFor(path),
      mimeType: "application/pdf", storagePath: path,
      provider: "firebase-storage", size: 1024,
    });
    expect(result.error).toBeUndefined();
    expect(result.value.doc_id).toMatch(/^doc_/);
    expect(result.value.status).toBe("pending_review");
    expect(usersCol.updateOne).toHaveBeenCalledWith(
      { user_id: "tenant-a" },
      expect.objectContaining({ $push: expect.objectContaining({ uploaded_documents: expect.objectContaining({ doc_id: result.value.doc_id }) }) }),
    );
  });

  // ── P0: storagePath ownership (MOB-P0-01) ───────────────────────────────

  test("uploadUserDocument rejects metadata registration when storagePath belongs to another tenant", async () => {
    const { uploadUserDocument } = await loadService();
    const foreignPath = ownPath("tenant-b");
    const result = await uploadUserDocument({ user_id: "tenant-a" }, {
      type: "government_id",
      downloadUrl: downloadUrlFor(foreignPath),
      storagePath: foreignPath,
      mimeType: "image/jpeg",
      provider: "firebase-storage",
    });
    expect(result.error).toMatch(/could not be verified/);
    expect(usersCol.updateOne).not.toHaveBeenCalled();
  });

  test("uploadUserDocument rejects own-URL-with-foreign-storagePath substitution attack", async () => {
    const { uploadUserDocument } = await loadService();
    const ownedPath = ownPath("tenant-a");
    const foreignPath = ownPath("tenant-b");
    const result = await uploadUserDocument({ user_id: "tenant-a" }, {
      type: "government_id",
      downloadUrl: downloadUrlFor(ownedPath), // tenant A's own genuinely valid URL
      storagePath: foreignPath, // but claims tenant B's object path
      mimeType: "image/jpeg",
      provider: "firebase-storage",
    });
    expect(result.error).toMatch(/could not be verified/);
    expect(usersCol.updateOne).not.toHaveBeenCalled();
  });

  test("uploadUserDocument rejects a download URL pointing at a different bucket", async () => {
    const { uploadUserDocument } = await loadService();
    const path = ownPath("tenant-a");
    const result = await uploadUserDocument({ user_id: "tenant-a" }, {
      type: "government_id",
      downloadUrl: downloadUrlFor(path, "attacker-bucket.firebasestorage.app"),
      storagePath: path,
      mimeType: "image/jpeg",
      provider: "firebase-storage",
    });
    expect(result.error).toMatch(/could not be verified/);
    expect(usersCol.updateOne).not.toHaveBeenCalled();
  });

  test("uploadUserDocument rejects encoded path traversal tricks", async () => {
    const { uploadUserDocument } = await loadService();
    const traversal = `tenant-documents/tenant-a/../tenant-documents/tenant-b/secret.jpg`;
    const result = await uploadUserDocument({ user_id: "tenant-a" }, {
      type: "government_id",
      downloadUrl: downloadUrlFor(traversal),
      storagePath: traversal,
      mimeType: "image/jpeg",
      provider: "firebase-storage",
    });
    expect(result.error).toMatch(/could not be verified/);
    expect(usersCol.updateOne).not.toHaveBeenCalled();
  });

  // ── Listing ──────────────────────────────────────────────────────────────

  test("listUserDocuments strips file_data/file_url/downloadUrl/storagePath from every entry", async () => {
    usersCol = fakeUsersCollection({
      findOneResult: {
        uploaded_documents: [
          { doc_id: "doc_1", type: "government_id", label: "ID", file_data: "data:application/pdf;base64,AAAA", downloadUrl: "https://x", storagePath: "uploads/x" },
        ],
      },
    });
    mockMongoose();
    const { listUserDocuments } = await loadService();
    const docs = await listUserDocuments({ user_id: "tenant-a", _id: "mongo-a" });
    expect(docs).toEqual([{ doc_id: "doc_1", type: "government_id", label: "ID" }]);
  });

  // ── Content read ─────────────────────────────────────────────────────────

  test("getUserDocumentContent serves legacy inline base64 documents (historical compatibility)", async () => {
    usersCol = fakeUsersCollection({
      findOneResult: { _id: "mongo-a", uploaded_documents: [{ doc_id: "doc_legacy", file_data: "data:application/pdf;base64,JVBERi0xLjQK" }] },
    });
    mockMongoose();
    const { getUserDocumentContent } = await loadService();
    const result = await getUserDocumentContent({ user_id: "tenant-a" }, "doc_legacy");
    expect(result.status).toBe(200);
    expect(result.contentType).toBe("application/pdf");
    expect(result.buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("getUserDocumentContent serves canonical Firebase-Storage-backed documents whose storagePath is verifiably the caller's own", async () => {
    const pdfBytes = Buffer.from("%PDF-1.4\n%%EOF");
    mockDownload.mockResolvedValue([pdfBytes]);
    const path = ownPath("tenant-a", "id.pdf");
    usersCol = fakeUsersCollection({
      findOneResult: { _id: "mongo-a", uploaded_documents: [{ doc_id: "doc_storage", storagePath: path, downloadUrl: downloadUrlFor(path), mimeType: "application/pdf" }] },
    });
    mockMongoose();
    mockFirebaseModule();
    const { getUserDocumentContent } = await loadService();
    const result = await getUserDocumentContent({ user_id: "tenant-a" }, "doc_storage");
    expect(result.status).toBe(200);
    expect(result.contentType).toBe("application/pdf");
    expect(mockFile).toHaveBeenCalledWith(path);
  });

  test("getUserDocumentContent validates image magic bytes against the declared mimeType (not hardcoded to PDF)", async () => {
    const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00]);
    mockDownload.mockResolvedValue([jpegBytes]);
    const path = ownPath("tenant-a", "photo.jpg");
    usersCol = fakeUsersCollection({
      findOneResult: { _id: "mongo-a", uploaded_documents: [{ doc_id: "doc_img", storagePath: path, downloadUrl: downloadUrlFor(path), mimeType: "image/jpeg" }] },
    });
    mockMongoose();
    mockFirebaseModule();
    const { getUserDocumentContent } = await loadService();
    const result = await getUserDocumentContent({ user_id: "tenant-a" }, "doc_img");
    expect(result.status).toBe(200);
    expect(result.contentType).toBe("image/jpeg");
  });

  test("getUserDocumentContent returns 404 (not another tenant's data) for a docId not owned by the caller", async () => {
    usersCol = fakeUsersCollection({ findOneResult: { _id: "mongo-a", uploaded_documents: [] } });
    reservationsCol = fakeReservationsCollection(null);
    mockMongoose();
    const { getUserDocumentContent } = await loadService();
    const result = await getUserDocumentContent({ user_id: "tenant-a" }, "doc_belongs_to_tenant_b");
    expect(result.status).toBe(404);
  });

  test("getUserDocumentContent fails closed (409) on unsafe/legacy metadata pointing at another tenant's storage path, and never calls Firebase Admin", async () => {
    const foreignPath = ownPath("tenant-b");
    // Simulates metadata written before the authorization invariant existed,
    // or tampered with directly in the database.
    usersCol = fakeUsersCollection({
      findOneResult: { _id: "mongo-a", uploaded_documents: [{ doc_id: "doc_legacy_unsafe", storagePath: foreignPath, downloadUrl: downloadUrlFor(foreignPath), mimeType: "application/pdf" }] },
    });
    mockMongoose();
    mockFirebaseModule();
    const { getUserDocumentContent } = await loadService();
    const result = await getUserDocumentContent({ user_id: "tenant-a" }, "doc_legacy_unsafe");
    expect(result.status).toBe(409);
    expect(result.detail).toMatch(/re-uploaded/);
    expect(mockFile).not.toHaveBeenCalled();
    expect(mockDownload).not.toHaveBeenCalled();
  });

  // ── Delete ────────────────────────────────────────────────────────────────

  test("deleteUserDocument deletes the Firebase object then pulls the metadata record when storagePath is verifiably the caller's own", async () => {
    const path = ownPath("tenant-a", "id.pdf");
    usersCol = fakeUsersCollection({
      findOneResult: { uploaded_documents: [{ doc_id: "doc_1", storagePath: path, downloadUrl: downloadUrlFor(path) }] },
    });
    mockMongoose();
    mockFirebaseModule();
    const { deleteUserDocument } = await loadService();
    const result = await deleteUserDocument({ user_id: "tenant-a" }, "doc_1");
    expect(result.status).toBe(200);
    expect(result.value).toEqual({ status: "deleted", doc_id: "doc_1" });
    expect(mockFileDelete).toHaveBeenCalledWith({ ignoreNotFound: true });
  });

  test("deleteUserDocument returns 404 for a docId not owned by the caller (cannot delete another tenant's document)", async () => {
    usersCol = fakeUsersCollection({ findOneResult: null });
    mockMongoose();
    const { deleteUserDocument } = await loadService();
    const result = await deleteUserDocument({ user_id: "tenant-a" }, "doc_belongs_to_tenant_b");
    expect(result.status).toBe(404);
  });

  test("deleteUserDocument refuses to delete reservation-sourced (res_) pseudo-documents", async () => {
    const { deleteUserDocument } = await loadService();
    const result = await deleteUserDocument({ user_id: "tenant-a" }, "res_507f1f77bcf86cd799439011_selfie");
    expect(result.status).toBe(404);
    expect(usersCol.findOne).not.toHaveBeenCalled();
  });

  test("deleteUserDocument fails closed on unsafe/legacy metadata, never touches the foreign storage object, and rolls back the pending-deletion marker", async () => {
    const foreignPath = ownPath("tenant-b");
    usersCol = fakeUsersCollection({
      findOneResult: { uploaded_documents: [{ doc_id: "doc_legacy_unsafe", storagePath: foreignPath, downloadUrl: downloadUrlFor(foreignPath) }] },
    });
    mockMongoose();
    mockFirebaseModule();
    const { deleteUserDocument } = await loadService();
    const result = await deleteUserDocument({ user_id: "tenant-a" }, "doc_legacy_unsafe");
    expect(result.status).toBe(409);
    expect(result.detail).toMatch(/re-uploaded/);
    // The privileged delete must never have been issued.
    expect(mockFileDelete).not.toHaveBeenCalled();
    // The pending-deletion marker set earlier in the flow must be rolled back.
    expect(usersCol.updateOne).toHaveBeenLastCalledWith(
      { user_id: "tenant-a", "uploaded_documents.doc_id": "doc_legacy_unsafe" },
      { $unset: { "uploaded_documents.$.deletion_pending": "", "uploaded_documents.$.deletion_requested_at": "" } },
    );
  });
});
