/**
 * Firebase Storage Upload Utility
 *
 * Replaces ImageKit for all applicant file uploads.
 * Uploads directly to Firebase Storage and returns an HTTPS download URL
 * that is safe to store in MongoDB.
 *
 * Storage path:  applicant-documents/{firebaseUid}/{documentType}/{timestamp}-{safeFilename}
 * Provider tag:  "firebase-storage"
 */

import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import app, { auth } from "../../firebase/config";
import { authFetch } from "../api/httpClient";

// ── File validation ────────────────────────────────────────────────────────
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
];

const BACKEND_ATTACHMENT_DOCUMENT_TYPES = new Set([
  "maintenance-attachment",
  "maintenance-reply-attachment",
]);

const shouldUseBackendAttachmentUpload = (opts = {}) =>
  opts.useBackend !== false &&
  (opts.context ||
    BACKEND_ATTACHMENT_DOCUMENT_TYPES.has(String(opts.documentType || "").trim()));

const getDefaultAttachmentContext = (documentType) => {
  if (documentType === "maintenance-reply-attachment") return "maintenance_reply";
  if (documentType === "maintenance-attachment") return "maintenance_request";
  return "";
};

async function uploadToBackendAttachmentService(file, opts = {}) {
  const formData = new FormData();
  formData.append("file", file);

  const fields = {
    documentType: opts.documentType,
    context: opts.context || getDefaultAttachmentContext(opts.documentType),
    visibility: opts.visibility,
    relatedId: opts.relatedId,
    relatedType: opts.relatedType,
    maintenanceRequestId: opts.maintenanceRequestId,
    requestId: opts.requestId,
    conversationId: opts.conversationId,
    branchId: opts.branchId,
  };

  Object.entries(fields).forEach(([key, value]) => {
    if (value !== undefined && value !== null && String(value).trim()) {
      formData.append(key, String(value));
    }
  });

  const response = await authFetch("/attachments", {
    method: "POST",
    body: formData,
  });
  const attachment = response?.attachment || response;

  if (!attachment?.url && !attachment?.downloadUrl && !attachment?.uri) {
    throw new Error("Upload completed but the returned URL is invalid. Please try again.");
  }

  return {
    downloadUrl: attachment.downloadUrl || attachment.url || attachment.uri,
    storagePath: attachment.storagePath,
    originalName: attachment.originalName || file.name,
    mimeType: attachment.mimeType || file.type,
    size: attachment.size ?? file.size,
    uploadedAt: attachment.uploadedAt || new Date().toISOString(),
    provider: attachment.provider || "server-attachment",
    attachment,
    ...attachment,
  };
}

/**
 * Validate a File object before uploading.
 * @param {File} file
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateFile(file) {
  if (!file || !(file instanceof File)) {
    return { valid: false, error: "No file selected." };
  }
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    return { valid: false, error: `File too large (${sizeMB} MB). Maximum is 5 MB.` };
  }
  if (!ALLOWED_MIME_TYPES.includes(file.type)) {
    return {
      valid: false,
      error: "Only JPEG, PNG, WebP, and PDF files are allowed.",
    };
  }
  return { valid: true };
}

// ── URL validation ─────────────────────────────────────────────────────────

const BLOCKED_URL_PREFIXES = ["file://", "content://", "blob:"];

/**
 * Returns true only for valid HTTPS download URLs (safe to store in MongoDB).
 * Rejects local paths, blob URLs, content URIs, and empty strings.
 * @param {*} url
 * @returns {boolean}
 */
export function isValidDownloadUrl(url) {
  if (!url || typeof url !== "string" || !url.trim()) return false;
  const lower = url.toLowerCase().trim();
  if (BLOCKED_URL_PREFIXES.some((p) => lower.startsWith(p))) return false;
  return lower.startsWith("https://");
}

/**
 * Validate a URL before saving to MongoDB.
 * @param {string} url
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateDownloadUrl(url) {
  if (!url) return { valid: false, error: "No URL provided." };
  if (!isValidDownloadUrl(url)) {
    return {
      valid: false,
      error:
        "Invalid file URL. Only HTTPS download links from Firebase Storage are allowed.",
    };
  }
  return { valid: true };
}

// ── Upload ─────────────────────────────────────────────────────────────────

/**
 * Upload a File to Firebase Storage.
 *
 * @param {File}   file                        File object from <input type="file">
 * @param {{ uid?: string, documentType?: string }} [opts]
 *   uid          — Firebase UID of the uploading user (for folder structure)
 *   documentType — Folder name, e.g. "selfie-photo", "valid-id-front"
 * @param {(percent: number) => void} [onProgress]  0–100 callback
 *
 * @returns {Promise<{
 *   downloadUrl:   string,
 *   storagePath:   string,
 *   originalName:  string,
 *   mimeType:      string,
 *   size:          number,
 *   uploadedAt:    string,
 *   provider:      "firebase-storage"
 * }>}
 */
export async function uploadToFirebaseStorage(file, opts = {}, onProgress) {
  const validation = validateFile(file);
  if (!validation.valid) throw new Error(validation.error);

  if (shouldUseBackendAttachmentUpload(opts)) {
    return uploadToBackendAttachmentService(file, opts);
  }

  if (!auth?.currentUser) {
    throw new Error("You must be signed in to upload files. Please refresh and try again.");
  }

  const { uid = auth.currentUser.uid, documentType = "document" } = opts;

  // Sanitise the filename for storage path safety
  const safeFilename = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const timestamp = Date.now();
  const storagePath = `applicant-documents/${uid}/${documentType}/${timestamp}-${safeFilename}`;

  const storage = getStorage(app);
  const storageRef = ref(storage, storagePath);
  const uploadTask = uploadBytesResumable(storageRef, file, {
    contentType: file.type,
  });

  return new Promise((resolve, reject) => {
    uploadTask.on(
      "state_changed",
      (snapshot) => {
        if (onProgress) {
          const pct = Math.round(
            (snapshot.bytesTransferred / snapshot.totalBytes) * 100,
          );
          onProgress(pct);
        }
      },
      (storageError) => {
        const code = storageError?.code ?? "unknown";
        console.error("[firebaseStorage] upload error:", code, storageError);
        let message = "Upload failed. Please check your connection and try again.";
        if (code === "storage/unauthorized") {
          message = "Upload permission denied. Please refresh the page and try again.";
        } else if (code === "storage/canceled") {
          message = "Upload was cancelled.";
        }
        reject(new Error(message));
      },
      async () => {
        try {
          const downloadUrl = await getDownloadURL(uploadTask.snapshot.ref);

          // Hard guard — never return a non-HTTPS URL to the caller
          if (!isValidDownloadUrl(downloadUrl)) {
            reject(
              new Error(
                "Upload completed but the returned URL is invalid. Please try again.",
              ),
            );
            return;
          }

          resolve({
            downloadUrl,
            storagePath,
            originalName: file.name,
            mimeType: file.type,
            size: file.size,
            uploadedAt: new Date().toISOString(),
            provider: "firebase-storage",
          });
        } catch {
          reject(
            new Error(
              "Upload completed but we couldn't retrieve the download URL. Please try again.",
            ),
          );
        }
      },
    );
  });
}

/**
 * Upload a value if it is still a File object; otherwise validate and pass
 * through the existing URL unchanged.
 *
 * This is the safe replacement for the old ImageKit `uploadIfFile`.
 *
 * @param {File|string|null} value
 * @param {{ uid?: string, documentType?: string }} [opts]
 * @param {(percent: number) => void}               [onProgress]
 * @returns {Promise<string|null>}  Always resolves to an HTTPS URL or null.
 */
export async function uploadIfFile(value, opts = {}, onProgress) {
  if (value instanceof File) {
    const result = await uploadToFirebaseStorage(value, opts, onProgress);
    return result.downloadUrl;
  }

  // Pass-through: validate that the stored URL is safe before returning
  if (value) {
    const check = validateDownloadUrl(value);
    if (!check.valid) {
      throw new Error(
        `Stored file URL is not a valid HTTPS download link: ${value}`,
      );
    }
  }

  return value || null;
}
