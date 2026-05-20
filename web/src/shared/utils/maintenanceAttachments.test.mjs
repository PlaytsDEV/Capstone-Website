import test from "node:test";
import assert from "node:assert/strict";

import {
  getMaintenanceAttachmentKind,
  getMaintenanceAttachmentName,
  getMaintenanceAttachmentType,
  getMaintenanceAttachmentUri,
  isLegacyLocalMaintenanceUploadUri,
  isViewableMaintenanceAttachmentUri,
  normalizeMaintenanceAttachments,
} from "./maintenanceAttachments.js";

test("maintenance attachments resolve Firebase download URL aliases", () => {
  const attachment = {
    fileName: "leak-photo.jpg",
    downloadUrl: "https://storage.example.com/maintenance/leak-photo.jpg?token=abc",
    contentType: "image/jpeg",
  };

  assert.equal(
    getMaintenanceAttachmentUri(attachment),
    "https://storage.example.com/maintenance/leak-photo.jpg?token=abc",
  );
  assert.equal(getMaintenanceAttachmentName(attachment), "leak-photo.jpg");
  assert.equal(getMaintenanceAttachmentType(attachment), "image/jpeg");
  assert.equal(getMaintenanceAttachmentKind(attachment), "image");
});

test("maintenance attachment normalization keeps recognized remote aliases", () => {
  const normalized = normalizeMaintenanceAttachments([
    {
      originalName: "invoice.pdf",
      secure_url: "https://cdn.example.com/maintenance/invoice.pdf",
    },
    {
      name: "local-only.jpg",
      uri: "file:///local/device/photo.jpg",
      type: "image/jpeg",
    },
  ]);

  assert.equal(normalized[0].name, "invoice.pdf");
  assert.equal(normalized[0].uri, "https://cdn.example.com/maintenance/invoice.pdf");
  assert.equal(normalized[0].type, "application/pdf");
  assert.equal(normalized[0].fileType, "pdf");
  assert.equal(normalized[1].name, "local-only.jpg");
  assert.equal(normalized[1].uri, "file:///local/device/photo.jpg");
  assert.equal(normalized[1].type, "image/jpeg");
  assert.equal(normalized[1].fileType, "image");
});

test("maintenance attachments prefer public urls over stale uri fields", () => {
  const attachment = {
    uri: "https://api.lilycrest.space/uploads/attachments/gil-puyat/maintenance_reply/old.png",
    url: "https://firebasestorage.googleapis.com/v0/b/app/o/attachments%2Fnew.png?alt=media&token=abc",
    type: "image/png",
  };

  assert.equal(
    getMaintenanceAttachmentUri(attachment),
    "https://firebasestorage.googleapis.com/v0/b/app/o/attachments%2Fnew.png?alt=media&token=abc",
  );
});

test("production local upload urls are treated as legacy unavailable assets", () => {
  const uri = "https://api.lilycrest.space/uploads/attachments/gil-puyat/maintenance_reply/file.png";

  assert.equal(isLegacyLocalMaintenanceUploadUri(uri), true);
  assert.equal(isViewableMaintenanceAttachmentUri(uri), false);
  assert.equal(
    isViewableMaintenanceAttachmentUri(
      "https://firebasestorage.googleapis.com/v0/b/app/o/attachments%2Ffile.png?alt=media&token=abc",
    ),
    true,
  );
});
