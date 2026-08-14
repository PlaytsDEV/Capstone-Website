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
import { mobileTenantAuth } from "../middleware/mobileTenantAuth.js";
import admin, { resolveFirebaseStorageBucket } from "../config/firebase.js";

const router = express.Router();

const MAX_FIREBASE_UPLOAD_BYTES = 10 * 1024 * 1024;
export const MAINTENANCE_MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
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
  if (!raw || !/^[a-zA-Z0-9+/]+={0,2}$/.test(raw)) return null;
  return Buffer.from(raw, "base64");
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
    const contextCeiling = context === "maintenance" ? MAINTENANCE_MAX_UPLOAD_BYTES : MAX_FIREBASE_UPLOAD_BYTES;
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

    const folder = sanitizePathSegment(req.body?.folder, "tenant-uploads");
    const tenantId = sanitizePathSegment(req.mobileTenant.user_id || "unknown-tenant", "unknown-tenant");
    const entityId = sanitizePathSegment(req.body?.entityId, "temp");
    const storagePath = [folder, tenantId, entityId, `${Date.now()}-${fileName}`].join("/");

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
