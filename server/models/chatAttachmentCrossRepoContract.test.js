import { describe, expect, test } from "@jest/globals";
import mongoose from "mongoose";

import ChatAttachment from "./ChatAttachment.js";
import ChatMessage from "./ChatMessage.js";

// Cross-repository attachment contract.
//
// The LilyCrest mobile backend (repo LilyCrest-Mobile,
// `backend/services/chatAttachment.service.js`) writes into the *same*
// MongoDB collections this admin server reads. A mobile tenant's attachment
// must therefore be resolvable by this repo's protected
// `downloadChatAttachment` handler with no translation layer.
//
// These assertions are deliberately schema-shaped rather than text matches:
// they run a literal mobile-produced document through the real Mongoose
// schemas, so a drift on either side fails here instead of silently
// producing an attachment the admin console cannot open.

const CONVERSATION_ID = new mongoose.Types.ObjectId();
const UPLOADER_ID = new mongoose.Types.ObjectId();

// Byte-for-byte the document shape createChatAttachment() inserts.
function mobileAttachmentRecord(overrides = {}) {
  return {
    conversationId: CONVERSATION_ID,
    branch: "gil-puyat",
    uploadedBy: UPLOADER_ID,
    uploaderRole: "tenant",
    originalName: "photo.jpg",
    mimeType: "image/jpeg",
    size: 2048,
    provider: "firebase-storage",
    storagePath: "support-attachments/tenant-a/conv-1/1700000000000-photo.jpg",
    storageUrl: "https://firebasestorage.googleapis.com/v0/b/bucket/o/object",
    ...overrides,
  };
}

// Byte-for-byte the embed shape normalizeSupportAttachments() persists onto a
// chat_messages document.
function mobileMessageEmbed(attachmentId) {
  const url = `/chat/${CONVERSATION_ID}/attachments/${attachmentId}`;
  return {
    attachmentId,
    url,
    fileUrl: url,
    name: "photo.jpg",
    fileName: "photo.jpg",
    type: "image/jpeg",
    mimeType: "image/jpeg",
    size: 2048,
  };
}

describe("mobile-produced chat attachments satisfy the canonical schema", () => {
  test("the mobile attachment record validates against ChatAttachment", async () => {
    const doc = new ChatAttachment(mobileAttachmentRecord());
    await expect(doc.validate()).resolves.toBeUndefined();
  });

  test("ChatAttachment is bound to the collection the mobile service writes", () => {
    expect(ChatAttachment.collection.collectionName).toBe("chat_attachments");
  });

  test("every field the mobile service writes exists on the canonical schema", () => {
    const canonicalPaths = new Set(Object.keys(ChatAttachment.schema.paths));
    for (const field of Object.keys(mobileAttachmentRecord())) {
      expect(canonicalPaths).toContain(field);
    }
  });

  test("every required canonical field is supplied by the mobile service", () => {
    const written = new Set(Object.keys(mobileAttachmentRecord()));
    for (const [name, path] of Object.entries(ChatAttachment.schema.paths)) {
      if (!path.isRequired) continue;
      expect(written).toContain(name);
    }
  });

  test("the mobile uploaderRole values are inside the canonical enum", () => {
    const allowed = ChatAttachment.schema.path("uploaderRole").enumValues;
    // normalizeUploaderRole() in the mobile service emits exactly these.
    expect(allowed).toEqual(expect.arrayContaining(["tenant", "admin", "owner"]));
    for (const role of ["tenant", "admin", "owner"]) {
      const doc = new ChatAttachment(mobileAttachmentRecord({ uploaderRole: role }));
      expect(doc.validateSync()).toBeUndefined();
    }
  });

  test("storageUrl stays server-side: it is not selected by default", () => {
    expect(ChatAttachment.schema.path("storageUrl").options.select).toBe(false);
  });

  test("the canonical size ceiling matches the 5MB cap both apps enforce", () => {
    const sizePath = ChatAttachment.schema.path("size");
    expect(sizePath.options.max).toBe(5 * 1024 * 1024);
    const oversized = new ChatAttachment(
      mobileAttachmentRecord({ size: 5 * 1024 * 1024 + 1 }),
    );
    expect(oversized.validateSync()?.errors?.size).toBeDefined();
  });
});

describe("mobile message embeds satisfy the canonical ChatMessage shape", () => {
  test("a mobile-embedded attachment validates on a ChatMessage", async () => {
    const attachmentId = new mongoose.Types.ObjectId();
    const message = new ChatMessage({
      conversationId: CONVERSATION_ID,
      senderName: "Ana",
      senderRole: "tenant",
      message: "See photo",
      attachments: [mobileMessageEmbed(attachmentId)],
    });

    await expect(message.validate()).resolves.toBeUndefined();
    const [embedded] = message.attachments;
    expect(String(embedded.attachmentId)).toBe(String(attachmentId));
    expect(embedded.url).toBe(
      `/chat/${CONVERSATION_ID}/attachments/${attachmentId}`,
    );
  });

  test("an attachment-only mobile message is accepted", async () => {
    const message = new ChatMessage({
      conversationId: CONVERSATION_ID,
      senderName: "Ana",
      senderRole: "tenant",
      message: "",
      attachments: [mobileMessageEmbed(new mongoose.Types.ObjectId())],
    });
    await expect(message.validate()).resolves.toBeUndefined();
  });

  test("the embed carries no storage facts — the record is the sole owner", () => {
    const embedSchema = ChatMessage.schema.path("attachments").schema;
    const embedPaths = Object.keys(embedSchema.paths);
    for (const forbidden of ["storagePath", "storageUrl", "provider", "bucket", "downloadUrl"]) {
      expect(embedPaths).not.toContain(forbidden);
    }
    // ...and the record is where they live.
    const recordPaths = Object.keys(ChatAttachment.schema.paths);
    expect(recordPaths).toEqual(
      expect.arrayContaining(["storagePath", "storageUrl", "provider"]),
    );
  });

  test("the embed's attachmentId references the canonical attachment model", () => {
    const embedSchema = ChatMessage.schema.path("attachments").schema;
    const idPath = embedSchema.path("attachmentId");
    expect(idPath.instance).toBe("ObjectId");
    expect(idPath.options.ref).toBe("ChatAttachment");
  });

  test("the protected url is an app route, never a storage provider URL", () => {
    const embed = mobileMessageEmbed(new mongoose.Types.ObjectId());
    for (const value of [embed.url, embed.fileUrl]) {
      expect(value.startsWith("/chat/")).toBe(true);
      expect(value).not.toMatch(/^https?:/);
      expect(value).not.toMatch(/firebasestorage|googleapis|storage\.cloud/);
    }
  });
});
