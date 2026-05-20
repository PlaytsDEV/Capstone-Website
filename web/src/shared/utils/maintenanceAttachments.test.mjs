import test from "node:test";
import assert from "node:assert/strict";

import {
  getMaintenanceAttachmentKind,
  getMaintenanceAttachmentName,
  getMaintenanceAttachmentType,
  getMaintenanceAttachmentUri,
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
