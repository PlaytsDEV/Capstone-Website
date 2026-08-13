import { afterEach, beforeEach, describe, expect, jest, test } from "@jest/globals";

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

  beforeEach(async () => {
    jest.resetModules();
    usersCol = fakeUsersCollection();
    reservationsCol = fakeReservationsCollection();
    mockDownload = jest.fn();
    mockFileDelete = jest.fn().mockResolvedValue(undefined);
    mockFile = jest.fn(() => ({ download: mockDownload, delete: mockFileDelete }));
    mockBucket = { file: mockFile };

    jest.unstable_mockModule("mongoose", () => ({
      default: {
        connection: {
          db: {
            collection: (name) => (name === "users" ? usersCol : reservationsCol),
          },
        },
      },
    }));
    jest.unstable_mockModule("../config/firebase.js", () => ({
      getFirebaseStorage: () => mockBucket,
    }));
  });

  afterEach(() => {
    jest.resetModules();
  });

  async function loadService() {
    return import("./mobileUserDocumentService.js");
  }

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

  test("uploadUserDocument accepts a valid Firebase-hosted PDF and pushes metadata scoped to the authenticated tenant", async () => {
    const { uploadUserDocument } = await loadService();
    const result = await uploadUserDocument({ user_id: "tenant-a" }, {
      type: "government_id", label: "My ID",
      downloadUrl: "https://firebasestorage.googleapis.com/v0/b/x/o/y?alt=media",
      mimeType: "application/pdf", storagePath: "uploads/tenant-a/id.pdf",
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

  test("listUserDocuments strips file_data/file_url/downloadUrl/storagePath from every entry", async () => {
    usersCol = fakeUsersCollection({
      findOneResult: {
        uploaded_documents: [
          { doc_id: "doc_1", type: "government_id", label: "ID", file_data: "data:application/pdf;base64,AAAA", downloadUrl: "https://x", storagePath: "uploads/x" },
        ],
      },
    });
    jest.unstable_mockModule("mongoose", () => ({
      default: { connection: { db: { collection: (name) => (name === "users" ? usersCol : reservationsCol) } } },
    }));
    const { listUserDocuments } = await loadService();
    const docs = await listUserDocuments({ user_id: "tenant-a", _id: "mongo-a" });
    expect(docs).toEqual([{ doc_id: "doc_1", type: "government_id", label: "ID" }]);
  });

  test("getUserDocumentContent serves legacy inline base64 documents (historical compatibility)", async () => {
    usersCol = fakeUsersCollection({
      findOneResult: { _id: "mongo-a", uploaded_documents: [{ doc_id: "doc_legacy", file_data: "data:application/pdf;base64,JVBERi0xLjQK" }] },
    });
    jest.unstable_mockModule("mongoose", () => ({
      default: { connection: { db: { collection: (name) => (name === "users" ? usersCol : reservationsCol) } } },
    }));
    const { getUserDocumentContent } = await loadService();
    const result = await getUserDocumentContent({ user_id: "tenant-a" }, "doc_legacy");
    expect(result.status).toBe(200);
    expect(result.contentType).toBe("application/pdf");
    expect(result.buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  test("getUserDocumentContent serves canonical Firebase-Storage-backed documents", async () => {
    const pdfBytes = Buffer.from("%PDF-1.4\n%%EOF");
    mockDownload.mockResolvedValue([pdfBytes]);
    usersCol = fakeUsersCollection({
      findOneResult: { _id: "mongo-a", uploaded_documents: [{ doc_id: "doc_storage", storagePath: "uploads/tenant-a/id.pdf", mimeType: "application/pdf" }] },
    });
    jest.unstable_mockModule("mongoose", () => ({
      default: { connection: { db: { collection: (name) => (name === "users" ? usersCol : reservationsCol) } } },
    }));
    jest.unstable_mockModule("../config/firebase.js", () => ({ getFirebaseStorage: () => mockBucket }));
    const { getUserDocumentContent } = await loadService();
    const result = await getUserDocumentContent({ user_id: "tenant-a" }, "doc_storage");
    expect(result.status).toBe(200);
    expect(result.contentType).toBe("application/pdf");
    expect(mockFile).toHaveBeenCalledWith("uploads/tenant-a/id.pdf");
  });

  test("getUserDocumentContent validates image magic bytes against the declared mimeType (not hardcoded to PDF)", async () => {
    const jpegBytes = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x00, 0x00, 0x00, 0x00]);
    mockDownload.mockResolvedValue([jpegBytes]);
    usersCol = fakeUsersCollection({
      findOneResult: { _id: "mongo-a", uploaded_documents: [{ doc_id: "doc_img", storagePath: "uploads/tenant-a/photo.jpg", mimeType: "image/jpeg" }] },
    });
    jest.unstable_mockModule("mongoose", () => ({
      default: { connection: { db: { collection: (name) => (name === "users" ? usersCol : reservationsCol) } } },
    }));
    jest.unstable_mockModule("../config/firebase.js", () => ({ getFirebaseStorage: () => mockBucket }));
    const { getUserDocumentContent } = await loadService();
    const result = await getUserDocumentContent({ user_id: "tenant-a" }, "doc_img");
    expect(result.status).toBe(200);
    expect(result.contentType).toBe("image/jpeg");
  });

  test("getUserDocumentContent returns 404 (not another tenant's data) for a docId not owned by the caller", async () => {
    usersCol = fakeUsersCollection({ findOneResult: { _id: "mongo-a", uploaded_documents: [] } });
    reservationsCol = fakeReservationsCollection(null);
    jest.unstable_mockModule("mongoose", () => ({
      default: { connection: { db: { collection: (name) => (name === "users" ? usersCol : reservationsCol) } } },
    }));
    const { getUserDocumentContent } = await loadService();
    const result = await getUserDocumentContent({ user_id: "tenant-a" }, "doc_belongs_to_tenant_b");
    expect(result.status).toBe(404);
  });

  test("deleteUserDocument deletes the Firebase object then pulls the metadata record", async () => {
    usersCol = fakeUsersCollection({
      findOneResult: { uploaded_documents: [{ doc_id: "doc_1", storagePath: "uploads/tenant-a/id.pdf" }] },
    });
    jest.unstable_mockModule("mongoose", () => ({
      default: { connection: { db: { collection: (name) => (name === "users" ? usersCol : reservationsCol) } } },
    }));
    jest.unstable_mockModule("../config/firebase.js", () => ({ getFirebaseStorage: () => mockBucket }));
    const { deleteUserDocument } = await loadService();
    const result = await deleteUserDocument({ user_id: "tenant-a" }, "doc_1");
    expect(result.status).toBe(200);
    expect(result.value).toEqual({ status: "deleted", doc_id: "doc_1" });
    expect(mockFileDelete).toHaveBeenCalledWith({ ignoreNotFound: true });
  });

  test("deleteUserDocument returns 404 for a docId not owned by the caller (cannot delete another tenant's document)", async () => {
    usersCol = fakeUsersCollection({ findOneResult: null });
    jest.unstable_mockModule("mongoose", () => ({
      default: { connection: { db: { collection: (name) => (name === "users" ? usersCol : reservationsCol) } } },
    }));
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
});
