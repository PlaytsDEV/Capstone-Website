/**
 * ============================================================================
 * MOBILE FIREBASE-STORAGE UPLOAD BRIDGE (closes a Phase 4 cutover gap)
 * ============================================================================
 *
 * The Phase 4 cutover-readiness audit found NO canonical route answered
 * POST /api/m/upload/firebase-storage — neither a bridge nor the vendored
 * mobile router defines it — even though it's an ACTIVE mobile feature
 * (src/services/firebaseStorageUpload.js, used for maintenance-reply and
 * chat attachment uploads). Against this backend it would 404 today.
 *
 * Mounted at /api/m BEFORE mobileRoutes (the vendored mobile backend copy),
 * same pattern as every other bridge here. Business logic is a direct port
 * of the currently-live standalone mobile backend's routes/upload.routes.js
 * POST /firebase-storage handler, substituted onto the canonical Firebase
 * Admin app / verified bucket resolver (config/firebase.js
 * resolveFirebaseStorageBucket(), built in Phase 3.5) instead of the
 * standalone backend's own resolveStorageBucket().
 *
 * Tenant identity for the storage path namespace comes exclusively from the
 * resolved mobile session (req.mobileTenant.user_id) — never from client
 * input — so one tenant's uploads can never collide with or overwrite
 * another's path.
 *
 * MAINTENANCE CONTEXT CLAMP (canonical-mobile reconciliation audit): the
 * mobile-only sibling backend enforces a hard 5MB ceiling specifically for
 * inquiry/maintenance attachments, separate from this endpoint's generic
 * 10MB ceiling (legitimately needed for other document uploads). A client
 * that sets `context: "maintenance"` can only ever get that 5MB ceiling here
 * — `maxBytes` may still tighten it further, exactly like the generic path,
 * but can never loosen it back toward 10MB. This is enforced against the
 * real decoded `buffer.length` (server-computed from the request body, never
 * client-reported), so the byte count checked here is trustworthy. See
 * mobile/controllers/maintenance.controller.js for the second, independent
 * check performed against the actual stored object's Firebase Storage
 * metadata when a maintenance request/reply references this upload's
 * storagePath — defense in depth against a client that skips this clamp
 * entirely by not going through this endpoint at all.
 */

import crypto from "crypto";
import express from "express";
import mongoose from "mongoose";
import { mobileTenantAuth } from "../middleware/mobileTenantAuth.js";
import admin, { resolveFirebaseStorageBucket } from "../config/firebase.js";

const router = express.Router();

const MAX_FIREBASE_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAINTENANCE_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const PROFILE_MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
const PROFILE_UPLOAD_MIME_TYPES = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif",
]);
const CHAT_UPLOAD_MIME_TYPES = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif",
  "application/pdf",
]);
const ALLOWED_FIREBASE_UPLOAD_MIME_TYPES = new Set([
  "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp", "image/bmp",
  "image/heic", "image/heif", "application/pdf", "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain", "text/csv",
]);

const MIME_TYPE_EXTENSION_MAP = {
  "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/png": ".png", "image/gif": ".gif",
  "image/webp": ".webp", "image/bmp": ".bmp", "image/heic": ".heic", "image/heif": ".heif",
  "application/pdf": ".pdf", "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
  "text/plain": ".txt", "text/csv": ".csv",
};

function sanitizePathSegment(value = "", fallback = "upload") {
  const clean = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return clean || fallback;
}

function safeFileName(fileName = "", mimeType = "application/octet-stream") {
  const cleanName = sanitizePathSegment(fileName, "attachment");
  if (/\.[a-z0-9]+$/i.test(cleanName)) return cleanName;
  return `${cleanName}${MIME_TYPE_EXTENSION_MAP[mimeType] || ".bin"}`;
}

function decodeBase64Payload(value = "") {
  const normalized = String(value || "").trim();
  const raw = normalized.replace(/^data:[^;]+;base64,/i, "");
  if (!raw) return null;

  // Avoid a single quantified regexp over multi-megabyte input: under the
  // complete test workload V8 can overflow its regexp call stack before the
  // byte ceiling is evaluated. Validate content and terminal padding with
  // bounded operations instead.
  const firstPadding = raw.indexOf("=");
  const content = firstPadding >= 0 ? raw.slice(0, firstPadding) : raw;
  const padding = firstPadding >= 0 ? raw.slice(firstPadding) : "";
  if (!content || /[^a-zA-Z0-9+/]/.test(content)) return null;
  if (padding && padding !== "=" && padding !== "==") return null;
  return Buffer.from(raw, "base64");
}

function hasExpectedFileSignature(buffer, mimeType) {
  const ascii = buffer.subarray(0, 16).toString("ascii");
  const isoBrand = ascii.slice(8, 12);
  if (["image/jpeg", "image/jpg"].includes(mimeType)) {
    return buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  }
  if (mimeType === "image/webp") return ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP";
  if (["image/heic", "image/heif"].includes(mimeType)) {
    return ascii.slice(4, 8) === "ftyp"
      && new Set(["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"]).has(isoBrand);
  }
  if (mimeType === "application/pdf") return ascii.startsWith("%PDF-");
  return true;
}

function requestedMimeTypes(body = {}) {
  if (!Array.isArray(body.allowedMimeTypes) || body.allowedMimeTypes.length === 0) return null;
  return new Set(body.allowedMimeTypes.map((value) => String(value || "").trim().toLowerCase()).filter(Boolean));
}

router.post("/upload/firebase-storage", mobileTenantAuth, async (req, res) => {
  try {
    const mimeType = String(req.body?.mimeType || req.body?.type || "").trim().toLowerCase();
    const fileName = safeFileName(req.body?.fileName || req.body?.name, mimeType);
    const buffer = decodeBase64Payload(req.body?.dataBase64);
    const requestedAllowedTypes = requestedMimeTypes(req.body);
    const context = String(req.body?.context || "").trim().toLowerCase();
    // Client input may only tighten this ceiling, never loosen it — the
    // maintenance context ceiling is a server-defined maximum, not a
    // suggestion the client can override upward.
    const contextCeiling = context === "maintenance" || context === "chat"
      ? MAINTENANCE_MAX_UPLOAD_BYTES
      : context === "profile"
        ? PROFILE_MAX_UPLOAD_BYTES
        : MAX_FIREBASE_UPLOAD_BYTES;
    const requestedMaxBytes = Number(req.body?.maxBytes);
    const maxBytes = Number.isFinite(requestedMaxBytes)
      ? Math.min(Math.max(1, requestedMaxBytes), contextCeiling)
      : contextCeiling;

    if (!buffer) {
      return res.status(400).json({ detail: "Upload file data is required." });
    }
    if (!ALLOWED_FIREBASE_UPLOAD_MIME_TYPES.has(mimeType)) {
      return res.status(400).json({ detail: "Unsupported file type." });
    }
    if (context === "profile" && !PROFILE_UPLOAD_MIME_TYPES.has(mimeType)) {
      return res.status(400).json({ detail: "Profile picture must be a supported image." });
    }
    if (context === "chat" && !CHAT_UPLOAD_MIME_TYPES.has(mimeType)) {
      return res.status(400).json({ detail: "Chat attachments must be JPEG, PNG, WebP, HEIC, HEIF, or PDF files." });
    }
    if (context === "chat" && !hasExpectedFileSignature(buffer, mimeType)) {
      return res.status(400).json({ detail: "The file content does not match its declared type." });
    }
    if (requestedAllowedTypes && !requestedAllowedTypes.has(mimeType)) {
      return res.status(400).json({ detail: "Unsupported file type." });
    }
    if (buffer.length > maxBytes) {
      return res.status(400).json({ detail: `Attachment exceeds ${Math.round(maxBytes / (1024 * 1024))} MB limit.` });
    }

    const bucketName = resolveFirebaseStorageBucket();
    if (!admin.apps.length || !bucketName) {
      return res.status(503).json({ detail: "File uploads are not configured." });
    }

    // Profile uploads have a server-owned namespace as well as a server-owned
    // size/type policy. Client input cannot redirect them into another area.
    let chatConversation = null;
    if (context === "chat") {
      const conversationId = String(req.body?.conversationId || req.body?.entityId || "").trim();
      if (!mongoose.Types.ObjectId.isValid(conversationId)) {
        return res.status(404).json({ detail: "Conversation not found." });
      }
      chatConversation = await mongoose.connection.db.collection("chat_conversations").findOne({
        _id: new mongoose.Types.ObjectId(conversationId),
        $or: [
          { tenantId: req.mobileTenant._id },
          { tenantUserId: req.mobileTenant.user_id },
        ],
      });
      if (!chatConversation) {
        return res.status(403).json({ detail: "You do not have access to this conversation." });
      }
      if (chatConversation.status === "closed") {
        return res.status(400).json({ detail: "This conversation is closed." });
      }
    }

    const folder = context === "profile"
      ? "profile-images"
      : context === "chat"
        ? "chat-attachments"
      : sanitizePathSegment(req.body?.folder, "tenant-uploads");
    const tenantId = sanitizePathSegment(req.mobileTenant.user_id || "unknown-tenant", "unknown-tenant");
    const entityId = context === "profile"
      ? "profile"
      : sanitizePathSegment(req.body?.entityId, "temp");
    const storagePath = [folder, tenantId, entityId, `${Date.now()}-${crypto.randomUUID()}-${fileName}`].join("/");

    const downloadToken = crypto.randomUUID();
    const bucket = admin.storage().bucket(bucketName);
    const file = bucket.file(storagePath);

    await file.save(buffer, {
      resumable: false,
      metadata: {
        contentType: mimeType,
        metadata: {
          firebaseStorageDownloadTokens: downloadToken,
          originalName: fileName,
          provider: "firebase-storage",
          tenantId,
        },
      },
    });

    const downloadUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucketName)}/o/${encodeURIComponent(storagePath)}?alt=media&token=${downloadToken}`;
    const uploadedAt = new Date().toISOString();

    if (context === "chat") {
      const attachmentId = new mongoose.Types.ObjectId();
      const protectedUrl = `/chat/${chatConversation._id}/attachments/${attachmentId}`;
      await mongoose.connection.db.collection("chat_attachments").insertOne({
        _id: attachmentId,
        conversationId: chatConversation._id,
        branch: chatConversation.branch,
        uploadedBy: req.mobileTenant._id,
        uploaderRole: "tenant",
        originalName: fileName,
        mimeType,
        size: buffer.length,
        provider: "firebase-storage",
        storagePath,
        storageUrl: downloadUrl,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      return res.status(201).json({
        attachmentId: String(attachmentId),
        id: String(attachmentId),
        name: fileName,
        originalName: fileName,
        mimeType,
        type: mimeType,
        size: buffer.length,
        url: protectedUrl,
        fileUrl: protectedUrl,
        downloadUrl: protectedUrl,
        uri: protectedUrl,
      });
    }

    return res.status(201).json({
      downloadUrl,
      storagePath,
      originalName: fileName,
      mimeType,
      size: buffer.length,
      uploadedAt,
      provider: "firebase-storage",
      name: fileName,
      uri: downloadUrl,
      type: mimeType,
    });
  } catch (error) {
    console.error("Firebase Storage upload error:", error);
    return res.status(500).json({ detail: "Upload failed, please retry." });
  }
});

export default router;
